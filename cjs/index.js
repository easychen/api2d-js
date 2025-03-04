const fetchSSE = require('./fetchSSE.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = class Api2d {
    // 设置key和apiBaseUrl
    constructor(key = null, apiBaseUrl = null, timeout = 60000, version = '2023-07-01-preview', deployments = {
        'gpt-3.5-turbo':'gpt-35-turbo',
        'gpt-3.5-turbo-0301':'gpt-35-turbo-0301',
        'gpt-3.5-turbo-0613':'gpt-35-turbo-0613',
        'gpt-3.5-16k':'gpt-35-16k',
        'gpt-3.5-16k-0613':'gpt-35-16k-0613',
        'gpt-4':'gpt-4',
        'text-embedding-ada-002':'text-embedding-ada-002',
    }) {
        this.key = key || '';
        this.apiBaseUrl = apiBaseUrl || (key && key.startsWith('fk') ? 'https://oa.api2d.net' : 'https://api.openai.com');
        this.deployments = deployments;
        this.version = version;

        this._updateHeaders()
        this.timeout = timeout;
        this.controller = new AbortController();
        this.apiVersion = 1;
    }

    // 根据 key 和 apiBaseUrl，更新请求 headers
    _updateHeaders() {
        // 如果 apiBaseUrl 包含 openai.azure.com
        if( this.apiBaseUrl.includes('openai.azure.com') )
        {
            this.by = 'azure';
            this.authHeader = {'api-key': this.key};
            this.refHeader = {};
        }else
        {
            // openai 默认配置
            this.by = this.key.startsWith('fk')  ? 'api2d' : 'openai';
            this.authHeader = {"Authorization": "Bearer " + this.key};

            if( this.key.startsWith('sk-or-') )
            {
                this.refHeader = {"HTTP-Referer":"https://ai0c.com"};
            }else
            {
                this.refHeader = {};
            }
        }
    }

    // set key
    setKey(key) {
        this.key = key || '';
        this._updateHeaders()
    }

    // set apiBaseUrl
    setApiBaseUrl(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this._updateHeaders()
    }

    // set apiVersion
    setApiVersion(apiVersion) {
        this.apiVersion = apiVersion;
    }

    setTimeout(timeout) {
        this.timeout = parseInt(timeout) || 60 * 1000;
    }

    abort() {
        this.controller.abort();
        this.controller = new AbortController();
    }

    api2dOnly( openaiOk = false )
    {
        if( openaiOk )
        {
            if( this.by != 'api2d'&& this.by != 'openai' )
            {
                throw new Error('Only support api2d');
            }
        }else
        {
            if( this.by != 'api2d' )
            {
                throw new Error('Only support api2d');
            }
        }
        
    }

    buildUrlByModel(model)
    {
        // console.log( "model", model );
        if( this.by == 'azure' )
        {
            const deployment = this.deployments[model]||"GPT35";
            if( String(model).toLowerCase().startsWith('text-embedding') )
            {
                return this.apiBaseUrl + '/openai/deployments/'+deployment+'/embeddings?api-version='+this.version;
            }else
            {
                // if( model.toLowerCase().startsWith('gpt') )
                // {
                return this.apiBaseUrl + '/openai/deployments/'+deployment+'/chat/completions?api-version='+this.version;
                // }
            }
        }
        else
        {
            const trimmedUrl = this.apiBaseUrl.replace(/\/*$/, '');
            if( String(model).toLowerCase().startsWith('text-embedding') || String(model).toLowerCase().endsWith('bge-m3') )
            {
                if (trimmedUrl.match(/\/v\d+$/))
                    return `${trimmedUrl}/embeddings`;
                return `${trimmedUrl}/v${this.apiVersion}/embeddings`;
            }else
            {
                if (trimmedUrl.match(/\/v\d+$/))
                    return `${trimmedUrl}/chat/completions`;
                return `${trimmedUrl}/v${this.apiVersion}/chat/completions`;
            }
        }
    }

    

    // Completion
    async completion(options) {
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            ...this.authHeader,...this.refHeader,
        };

        const {onMessage, onReasoning, onEnd, model, noCache, ...otherOptions} = options;

        // 拼接目标URL
        const url = this.buildUrlByModel(model || 'gpt-3.5-turbo');
        const modelObj = this.by == 'azure' ? {} : {model: model || 'gpt-3.5-turbo'};

        const { moderation, moderation_stop, ...optionsWithoutModeration } = otherOptions;
        
        const restOptions = this.by == 'api2d' ? otherOptions : optionsWithoutModeration;

        if (noCache) headers['x-api2d-no-cache'] = 1;

        // 如果是流式返回，且有回调函数
        if (restOptions.stream && onMessage) {
            // 返回一个 Promise
            return new Promise(async (resolve, reject) => {
                try {
                    let chars = '';
                    // console.log('in stream');
                    // 使用 fetchEventSource 发送请求
                    const timeout_handle = setTimeout(() => {
                        this.controller.abort();
                        this.controller = new AbortController();
                        // throw new Error( "Timeout "+ this.timeout );
                        reject(new Error(`[408]:Timeout by ${this.timeout} ms`));
                    }, this.timeout);

                    // console.log( "url", url, "opt", JSON.stringify({...restOptions, ...modelObj}));
                        
                    const response = await fetchSSE(url, {
                        signal: this.controller.signal,
                        method: 'POST',
                        openWhenHidden: true,
                        fetch: fetch,
                        headers: {...headers, Accept: 'text/event-stream'},
                        body: JSON.stringify({...restOptions, ...modelObj }),
                        async onopen(response) {
                            if (response.status != 200) {
                                const info = await response.text();
                                throw new Error(`[${response.status}]:${response.statusText} ${info}`);
                            }
                        },
                        onmessage: (data) => {
                            if (timeout_handle) {
                                clearTimeout(timeout_handle);
                            }
                            if (data == '[DONE]') {
                                // console.log( 'DONE' );
                                if (onEnd) onEnd(chars);
                                resolve(chars);
                            } else {
                                if( !isJSON(data) ) return;
                                const event = JSON.parse(data);
                                if( event.error )
                                {
                                    throw new Error(event.error.message);
                                }else
                                {
                                    if( event.choices && event.choices.length > 0 )
                                    {
                                        const char = event.choices[0].delta.content;
                                        const reasoning_char = event.choices[0].delta.reasoning_content || '';
                                        if (char)
                                        {
                                            chars += char;
                                            if (onMessage) onMessage(chars,char);
                                        }else if(reasoning_char)
                                        {
                                            if(onReasoning) onReasoning(reasoning_char);
                                        }

                                        if( event.action && event.action === 'clean' )
                                        {
                                            chars = "";
                                        }
                                        
                                        // azure 不返回 [DONE]，而是返回 finish_reason
                                        if( event.choices[0].finish_reason )
                                        {
                                            // end
                                            if (onEnd) onEnd(chars);
                                            resolve(chars);
                                        }
                                    }
                                } 
                            }
                        },
                        onerror: error => {
                            console.log(error);
                            let error_string = String(error);
                            if (error_string && error_string.match(/\[(\d+)\]/)) {
                                const matchs = error_string.match(/\[(\d+)\]/);
                                error_string = `[${matchs[1]}]:${error_string}`;
                            }
                            throw new Error(error_string);
                        }
                    }, global.fetch || fetch);

                    // const ret = await response.json();
                } catch (error) {
                    console.log(error);
                    reject(error);
                }
            });
        } else {
            // 使用 fetch 发送请求
            const timeout_handle = setTimeout(() => {
                this.controller.abort();
                this.controller = new AbortController();
            }, this.timeout);
            const response = await fetch(url, {
                signal: this.controller.signal,
                method: 'POST',
                headers: headers,
                body: JSON.stringify({...restOptions,...modelObj})
            });
            const ret = await response.json();
            clearTimeout(timeout_handle);
            return ret;
        }
    }

    async completionWithRetry ( data, retry = 2 ) 
    {
      return new Promise( (resolve, reject) => {
        try {
          this.completion(data).then( resolve ).catch( (error) => {
            console.log( "error in completion", error );
            if( retry > 0 && String(error).includes("retry") )
            {
              setTimeout( () => {
                this.completionWithRetry( data, retry-1 ).then( resolve ).catch( reject );
              }, 1000 );
            }
            else
            {
              console.log( "error in completion", error );
              reject(error);
            }
          });
          
        } catch (error) {
          console.log( "err in completion", error );
        }
        
      });
    }

    async embeddings(options) {
        
        // 拼接headers
        const headers = {
            'Content-Type': 'application/json',
            ...this.authHeader,...this.refHeader,
        };
        const {model, ...restOptions} = options;
        const modelObj = this.by == 'azure' ? {} : {model: model || 'text-embedding-ada-002'};

        // 拼接目标URL
        const url = this.buildUrlByModel(model || 'text-embedding-ada-002');
        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: 'POST',
            headers: headers,
            body: JSON.stringify({...restOptions, ...modelObj})
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async billing() {
        this.api2dOnly(true);
        const url = this.apiBaseUrl + '/dashboard/billing/credit_grants';
        const headers = {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.key
        };
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: 'GET',
            headers: headers
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async vectorSave(options) {
        this.api2dOnly();
        // text, embedding, uuid = "", meta = ""
        const {text, embedding, uuid, meta} = options;
        // 拼接目标URL
        const url = this.apiBaseUrl + "/vector";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            ...this.authHeader,...this.refHeader,
        };
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        // 使用 fetch 发送请求
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                text: text,
                uuid: uuid || "",
                embedding: embedding,
                meta: meta || ""
            })
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async vectorSearch(options) {
        this.api2dOnly();
        const {searchable_id, embedding, topk} = options;
        // 拼接目标URL
        const url = this.apiBaseUrl + "/vector/search";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            ...this.authHeader,...this.refHeader,
        };
        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                searchable_id,
                embedding,
                topk: topk || 1
            })
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async vectorDelete(options) {
        this.api2dOnly();
        const {uuid} = options;
        // 拼接目标URL
        const url = this.apiBaseUrl + "/vector/delete";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            ...this.authHeader,...this.refHeader,
        };
        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                uuid
            })
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async vectorDeleteAll() {
        this.api2dOnly();
        // 拼接目标URL
        const url = this.apiBaseUrl + "/vector/delete-all";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            ...this.authHeader,...this.refHeader,
        };
        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: "POST",
            headers: headers,
            body: JSON.stringify({})
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async textToSpeech(options) {
        this.api2dOnly();
        const {text, voiceName, responseType, output, speed} = options;
        // 拼接目标URL
        const url = this.apiBaseUrl + "/azure/tts";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            ...this.authHeader,...this.refHeader,
        };
        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const responseToFile = response => {
            const file_stream = fs.createWriteStream(output, {autoClose: true});
            const p = new Promise((resolve, reject) => {
                response.body.on('data', data => {
                    file_stream.write(data);
                });

                response.body.on('end', () => {
                    file_stream.close();
                    resolve(true);
                })

                response.body.on('error', err => {
                    reject(err);
                });
            });

            return p;
        };
        const responseToStream = async response => {
            const p = new Promise((resolve, reject) => {
                response.body.on('data', data => {
                    output.write(data);
                });

                response.body.on('end', () => {
                    output.close();
                    resolve();
                })

                response.body.on('error', err => {
                    reject(err);
                });
            });

            return p;
        };
        const response_promise = fetch(url, {
            signal: this.controller.signal,
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                text,
                voiceName,
                speed
            })
        });

        if (responseType === 'file') {

            const res = await response_promise;
            const ret = await responseToFile(res);
            clearTimeout(timeout_handle);
            return ret;
        } else if (responseType === 'stream') {
            const ret = response_promise.then(response => responseToStream(response));
            clearTimeout(timeout_handle);
            return ret;

        } else {
            throw new Error('responseType must be file, blob or blob-url');
        }
    }

    async speechToText(options) {
        this.api2dOnly();
        const {file, language, moderation, moderation_stop} = options;
        // 拼接目标URL
        const url = this.apiBaseUrl + "/azure/stt";
        // 拼接headers
        const headers = {
            "Content-Type": "multipart/form-data",
            ...this.authHeader,...this.refHeader,
        };
        const {FormData, File} = await import("formdata-node");

        const formData = new FormData();

        formData.set('language', language);
        formData.set('moderation', moderation);
        formData.set('moderation_stop', moderation_stop);
        formData.set('file', new File([fs.readFileSync(file)], path.parse(file).base));

        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);

        // node-fetch 处理 formdata 有问题，用 axios
        const response = await axios.post(url, formData, {
            headers,
            signal: this.controller.signal
        });

        clearTimeout(timeout_handle);

        return response.data;
    }

    async imageGenerate(options) {
        let { model, prompt, n, size, response_format} = options;
        if( !n ) n = 1;
        if( !size ) size = '1024x1024';
        if( !response_format ) response_format = 'url';
        if( !['dall-e-2','dall-e-3'].includes(model) ) model = 'dall-e-3';

        const ret = await this.request({
            path: 'v1/images/generations',
            method: 'POST',
            data: {
                prompt,
                n,
                size,
                model,
                response_format
            }
        }, false);
        return ret;
    }

    async request( options, api2dOnly = ture )
    {
        if(api2dOnly) this.api2dOnly();
        const {url, method, headers, body, path, data} = options;
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        
        const final_url = path ? this.apiBaseUrl +'/'+ path : url;
        const final_data = data ? JSON.stringify(data) : body;
        let option = {
            signal: this.controller.signal,
            method: method || 'GET',
            headers: {...( headers ? headers : {} ), ...{
                "Content-Type": "application/json",
                ...this.authHeader,...this.refHeader,
            }}
        }
        if( !['GET','HEAD'].includes( method.toUpperCase() )  ) option.body = final_data;
        
        const response = await fetch( final_url, option );
        // console.log( final_url, option, response );
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }
};

// 一个测试能否被JSON parse的函数
function isJSON(str) {
    if (typeof str == 'string') {
        try {
            const obj = JSON.parse(str);
            if (typeof obj == 'object' && obj) {
                return true;
            } else {
                return false;
            }

        } catch (e) {
            console.log('error：' + str + '!!!' + e);
            return false;
        }
    }
    console.log('It is not a string!')
    return false;
}
