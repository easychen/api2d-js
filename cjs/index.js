const fetchSSE = require('./fetchSSE.js');
const fetch = require('node-fetch');

module.exports = class Api2d {
    // 设置key和apiBaseUrl
    constructor(key = null, apiBaseUrl = null, timeout = 60000) {
        this.key = key;
        this.apiBaseUrl = apiBaseUrl || (key && key.startsWith('fk') ? 'https://stream.api2d.net' : 'https://api.openai.com');
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
    }

    // Completion
    async completion(options) {
        // 拼接目标URL
        const url = this.apiBaseUrl + '/v1/chat/completions';
        // 拼接headers
        const headers = {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.key
        };

        const { onMessage, onEnd, model, noCache ,  ...restOptions } = options;

        if( noCache ) headers['x-api2d-no-cache'] = 1;

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
                        // throw new Error( "Timeout "+ this.timeout );
                        reject(new Error(`[408]:Timeout by ${this.timeout} ms`));
                    }, this.timeout);
                    const response = await fetchSSE(url, {
                        signal: this.controller.signal,
                        method: 'POST',
                        openWhenHidden: true,
                        fetch: fetch,
                        headers: { ...headers, Accept: 'text/event-stream' },
                        body: JSON.stringify({ ...restOptions, model: model || 'gpt-3.5-turbo' }),
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
                        onerror: (error) => {
                            console.log(error);
                            throw new Error(String(error)?.match(/\[(\d+)\]/)?.[1] ? error : `[500]:${error}`);
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
            const response = await fetch(url, {
                signal: this.controller.signal,
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ ...restOptions, model: model || 'gpt-3.5-turbo' })
            });
            const timeout_handle = setTimeout(() => {
                this.controller.abort();
            }, this.timeout);
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
        const { model, ...restOptions } = options;
        // 使用 fetch 发送请求
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ ...restOptions, model: model || 'text-embedding-ada-002' })
        });
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
        }, this.timeout);
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
        const response = await fetch(url, {
            signal: this.controller.signal,
            method: 'GET',
            headers: headers
        });
        const timeout_handle = setTimeout(() => {
            this.controller.abort();
        }, this.timeout);
        const ret = await response.json();
        clearTimeout(timeout_handle);
        return ret;
    }
};
