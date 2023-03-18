import { fetchEventSource } from '@microsoft/fetch-event-source';

export default class Api2d
{
    // 设置key和apiBaseUrl
    constructor( key = null, apiBaseUrl=null )
    {
        this.key = key;
        this.apiBaseUrl = apiBaseUrl || ( key && key.startsWith("fk") ? "https://openai.api2d.net":"https://api.openai.com" );
    }

    // set key
    setKey( key )
    {
        this.key = key;
    }

    // set apiBaseUrl
    setApiBaseUrl( apiBaseUrl )
    {
        this.apiBaseUrl = apiBaseUrl;
    }

    // Completion
    async completion( options )
    {
        // 拼接目标URL
        const url = this.apiBaseUrl + "/v1/chat/completions";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + this.key
        };

        const { onMessage, onEnd, model,  ...restOptions } = options;

        // 如果是流式返回，且有回调函数
        if( restOptions.stream && onMessage )
        {
            let chars = "";
            // console.log( "in stream" );
            const response = await fetchEventSource( url, {
                method: "POST",
                headers: {...headers, "Accept": "text/event-stream"},
                body: JSON.stringify( {...restOptions, model:model||'gpt-3.5-turbo'}),
                onmessage: e => {
                    if( e.data == '[DONE]' )
                    {
                        // console.log( 'DONE' );
                        if( onEnd ) onEnd( chars );
                        chars = "";
                    }else
                    {
                        // console.log( e.data );
                        const event = JSON.parse(e.data);
                        if( event.choices[0].delta.content ) chars += event.choices[0].delta.content;
                        onMessage( chars );
                    }
                    
                },
            });
        }else
        {
            // 使用 fetch 发送请求
            const response = await fetch( url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify( {...restOptions, model:model||'gpt-3.5-turbo'} )
            });
            return await response.json();
        }
    }

    async embeddings( options )
    {
        // 拼接目标URL
        const url = this.apiBaseUrl + "/v1/embeddings";
        // 拼接headers
        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + this.key
        };
        const {model,  ...restOptions } = options;
        // 使用 fetch 发送请求
        const response = await fetch( url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify( {...restOptions,model:model||'text-embedding-ada-002'} )
        });
        return await response.json();
    }

    async billing()
    {
        const url = this.apiBaseUrl + "/dashboard/billing/credit_grants";
        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + this.key
        };
        const response = await fetch( url, {
            method: "GET",
            headers: headers
        });
        return await response.json();
    }
}


