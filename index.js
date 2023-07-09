import {fetchEventSource} from '@microsoft/fetch-event-source';

export default class Api2d {
    // 设置key和apiBaseUrl
    constructor(key = null, apiBaseUrl = null, timeout = 60000) {
        this.key = key;
        this.apiBaseUrl = apiBaseUrl || (key && key.startsWith("fk") ? "https://oa.api2d.net" : "https://api.openai.com");
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

    // Completion
    async completion(options) {
        // 拼接目标URL
        const url = this.apiBaseUrl + "/v1/chat/completions";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + this.key
        };

        const {onMessage, onEnd, model, noCache, ...restOptions} = options;

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
                        body: JSON.stringify({...restOptions, model: model || 'gpt-3.5-turbo'}),
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
                                    const char = event.choices[0].delta.content;
                                    if (char)
                                    {
                                        chars += char;
                                        if (onMessage) onMessage(chars,char);
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
                body: JSON.stringify({...restOptions, model: model || 'gpt-3.5-turbo'})
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
              reject(err);
            }
          });
          
        } catch (error) {
          console.log( "err in completion", error );
        }
        
      });
    }

    async embeddings(options) {
        // 拼接目标URL
        const url = this.apiBaseUrl + "/v1/embeddings";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + this.key
        };
        const {model, ...restOptions} = options;
        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: "POST",
            headers: headers,
            body: JSON.stringify({...restOptions, model: model || 'text-embedding-ada-002'})
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async billing() {
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


