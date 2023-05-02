const fetchSSE = require('./fetchSSE.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = class Api2d {
    // 设置key和apiBaseUrl
    constructor(key = null, apiBaseUrl = null, timeout = 60000) {
        this.key = key;
        this.apiBaseUrl = apiBaseUrl || (key && key.startsWith('fk') ? 'https://openai.api2d.net' : 'https://api.openai.com');
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
        const url = this.apiBaseUrl + '/v1/chat/completions';
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
                    let chars = '';
                    console.log('in stream');
                    // 使用 fetchEventSource 发送请求
                    const timeout_handle = setTimeout(() => {
                        this.controller.abort();
                        this.controller = new AbortController();
                        // throw new Error( "Timeout "+ this.timeout );
                        reject(new Error(`[408]:Timeout by ${this.timeout} ms`));
                    }, this.timeout);
                    const response = await fetchSSE(url, {
                        signal: this.controller.signal,
                        method: 'POST',
                        openWhenHidden: true,
                        fetch: fetch,
                        headers: {...headers, Accept: 'text/event-stream'},
                        body: JSON.stringify({...restOptions, model: model || 'gpt-3.5-turbo'}),
                        async onopen(response) {
                            if (response.status != 200) {
                                throw new Error(`[${response.status}]:${response.statusText}`);
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
                                const event = JSON.parse(data);
                                if (event.choices[0].delta.content) chars += event.choices[0].delta.content;
                                if (onMessage) onMessage(chars);
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
                body: JSON.stringify({...restOptions, model: model || 'gpt-3.5-turbo'})
            });
            const ret = await response.json();
            clearTimeout(timeout_handle);
            return ret;
        }
    }

    async embeddings(options) {
        // 拼接目标URL
        const url = this.apiBaseUrl + '/v1/embeddings';
        // 拼接headers
        const headers = {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.key
        };
        const {model, ...restOptions} = options;
        // 使用 fetch 发送请求
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
            this.controller = new AbortController();
        }, this.timeout);
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: 'POST',
            headers: headers,
            body: JSON.stringify({...restOptions, model: model || 'text-embedding-ada-002'})
        });
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }

    async billing() {
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
        // text, embedding, uuid = "", meta = ""
        const {text, embedding, uuid, meta} = options;
        // 拼接目标URL
        const url = this.apiBaseUrl + "/vector";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + this.key
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
        const {file, language, moderation, moderation_stop} = options;
        // 拼接目标URL
        const url = this.apiBaseUrl + "/azure/stt";
        // 拼接headers
        const headers = {
            "Content-Type": "multipart/form-data",
            "Authorization": "Bearer " + this.key,
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
};
