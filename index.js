import {fetchEventSource} from '@microsoft/fetch-event-source';

export default class Api2d {
    // 设置key和apiBaseUrl
    constructor(key = null, apiBaseUrl = null, timeout = 60000, version = '2023-07-01-preview', deployments = {
        'gpt-3.5-turbo':'GPT35',
        'gpt-3.5-turbo-0301':'GPT35',
        'gpt-3.5-turbo-0613':'GPT35',
        'gpt-3.5-16k':'GPT35-16K',
        'gpt-3.5-16k-0613':'GPT35-16K',
        'gpt-4':'GPT4',
        'text-embedding-ada-002':'EBD002',
    }) {
        this.key = key;
        this.apiBaseUrl = apiBaseUrl || (key && key.startsWith('fk') ? 'https://oa.api2d.net' : 'https://api.openai.com');
        this.deployments = deployments;
        this.version = version;
        
        // 如果 apiBaseUrl 包含 openai.azure.com 
        if( this.apiBaseUrl.includes('openai.azure.com') )
        {
            this.by = 'azure';
            this.authHeader = {'api-key': this.key};
        }else
        {
            // openai 默认配置
            this.by = key.startsWith('fk')  ? 'api2d' : 'openai';
            this.authHeader = {"Authorization": "Bearer " + this.key};
        }
        this.timeout = timeout;
        this.controller = new AbortController();
    }

    // set key
    setKey(key) {
        this.key = key;
    }

    // set apiBaseUrl
    setApiBaseUrl(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
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
        console.log( "model", model );
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
            if( String(model).toLowerCase().startsWith('text-embedding') )
            {
                return this.apiBaseUrl + '/v1/embeddings';
            }else
            {
                // if( model.toLowerCase().startsWith('gpt') )
                // {
                return this.apiBaseUrl + '/v1/chat/completions';
                // }
            
            }
        }
    }

    // Completion
    async completion(options) {
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            ...this.authHeader,
        };

        const {onMessage, onEnd, model, noCache, ...restOptions} = options;

        // 拼接目标URL
        const url = this.buildUrlByModel(model || 'gpt-3.5-turbo');
        const modelObj = this.by == 'azure' ? {} : {model: model || 'gpt-3.5-turbo'};

        if (noCache) headers['x-api2d-no-cache'] = 1;

        // 如果是流式返回，且有回调函数
        if (restOptions.stream && onMessage) {
            // 返回一个 Promise
            return new Promise(async (resolve, reject) => {
                try {
                    let chars = "";
                    console.log("in stream");
                    // 使用 fetchEventSource 发送请求
                    const timeout_handle = setTimeout(() => {
                        this.controller.abort();
                        this.controller = new AbortController();
                        // throw new Error( "Timeout "+ this.timeout );
                        reject(new Error(`[408]:Timeout by ${this.timeout} ms`));
                    }, this.timeout);
                    const response = await fetchEventSource(url, {
                        signal: this.controller.signal,
                        method: "POST",
                        headers: {...headers, "Accept": "text/event-stream"},
                        body: JSON.stringify({...restOptions, ...modelObj}),
                        async onopen(response) {
                            if (response.status != 200) {
                                throw new Error(`[${response.status}]:${response.statusText}`);
                            }
                        },
                        onmessage: e => {
                            if (timeout_handle) {
                                clearTimeout(timeout_handle);
                            }
                            if (e.data == '[DONE]') {
                                // console.log( 'DONE' );
                                if (onEnd) onEnd(chars);
                                resolve(chars);
                            } else {
                                // console.log( e.data );
                                const event = JSON.parse(e.data);
                                if( event.error )
                                {
                                    throw new Error(event.error.message);
                                }else
                                {
                                    if( event.choices && event.choices.length > 0 )
                                    {
                                        const char = event.choices[0].delta.content;
                                        if (char)
                                        {
                                            chars += char;
                                            if (onMessage) onMessage(chars,char);
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
                    });

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
                method: "POST",
                headers: headers,
                body: JSON.stringify({...restOptions, ...modelObj})
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
          console.log( "error in completion", error );
        }
        
      });
    }

    async embeddings(options) {
        
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            ...this.authHeader,
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
            method: "POST",
            headers: headers,
            body: JSON.stringify({...restOptions, ...modelObj})
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async billing() {
        this.api2dOnly(true);
        const url = this.apiBaseUrl + "/dashboard/billing/credit_grants";
        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + this.key
        };
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: "GET",
            headers: headers
        });
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
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
            "Authorization": "Bearer " + this.key
        };

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
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
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
            "Authorization": "Bearer " + this.key
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
            "Authorization": "Bearer " + this.key
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
            "Authorization": "Bearer " + this.key
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
            "Authorization": "Bearer " + this.key,
        };
        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const response_promise = fetch(url, {
            signal: this.controller.signal,
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                text,
                voiceName,
                speed
            })
        })
            .then((response) => {
                const reader = response.body.getReader();
                return new ReadableStream({
                    start(controller) {
                        return pump();
                        function pump() {
                            return reader.read().then(({done, value}) => {
                                // When no more data needs to be consumed, close the stream
                                if (done) {
                                    controller.close();
                                    return;
                                }
                                // Enqueue the next data chunk into our target stream
                                controller.enqueue(value);
                                return pump();
                            });
                        }
                    },
                });
            })
            // Create a new response out of the stream
            .then((stream) => new Response(stream))
            // Create an object URL for the response
            .then((response) => response.blob());
        const saveData = (function () {
            var a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            return function (data, fileName) {
                var url = window.URL.createObjectURL(data);
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            };
        }());

        if (responseType === 'file') {
            const ret = response_promise.then((blob) => saveData(blob, output));
            clearTimeout(timeout_handle);
            return ret;

        } else if (responseType === 'blob') {
            const ret = response_promise;
            clearTimeout(timeout_handle);
            return ret;
        } else if (responseType === 'blob-url') {
            const ret = response_promise.then((blob) => window.URL.createObjectURL(blob));
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
            "Authorization": "Bearer " + this.key,
        };

        const formData = new FormData();

        formData.set('language', language);
        formData.set('moderation', moderation);
        formData.set('moderation_stop', moderation_stop);
        formData.set('file', file);

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

    async request( options )
    {
        this.api2dOnly();
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
                "Authorization": "Bearer " + this.key
            }}
        }
        if( !['GET','HEAD'].includes( method.toUpperCase() )  ) option.body = final_data;
        
        const response = await fetch( final_url, option );
        console.log( final_url, option, response );
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }
}


