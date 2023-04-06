中文说明见后边，以下英文由GPT3.5友情翻译。感谢 [cdswyda](https://github.com/cdswyda) 的PR，已经可以在Node环境运行。

# A Simple Pure Browser SDK for Api2d and OpenAI

For some reason, I couldn't find a pure browser OpenAI SDK, they were all implemented in Node. So I wrote one myself, which is compatible with both OpenAI and [API2d](https://api2d.com/) keys.

## Usage

```js
import Api2d from 'api2d';

const timeout = 1000*60; // 60 seconds timeout
const api = new Api2d(key, apiBaseUrl, timeout);

// chat completion
const ret = await api.completion({
    model:'gpt-3.5-turbo',
    messages: [
        {
            "role":"user",
            "content":"Hello"
        }
    ],
    stream: true, // supports stream, note that when stream is true, the return value is undefined
    onMessage: (string)=> {
        console.log( "SSE returns, here is the complete string received", string );
    },
    onEnd: (string)=> {
        console.log( "end", string );
    }
});


// embeddings
const ret = await api.embeddings({
    input: "hello world"
});
console.log( ret );

api.setKey( 'newkey' ); // set key
api.setApiBaseUrl( 'https://...your openai proxy address' );
api.setTimeout( 1000*60*5 );
api.abort(); // cancel the request actively

```

### Example of using in Node environment

```js
const api2d = require('api2d-js/cjs/index.js');
const forward_key = 'FK...';
async function doit()
{
    const api2d_instance = new api2d(forward_key);
    const response = await api2d_instance.completion({
        messages: [
            {
                'role':'user',
                'content':'来首唐诗',
            }
        ],
        stream: true,
        onMessage: (message) => {
            console.log(message);
        }
    });
    console.log(response);
}

doit();
```

[More examples](https://github.com/easychen/api2d-js/pull/3#issuecomment-1498753640)


# 一个简单的纯浏览器SDK for Api2d 和 OpenAI

不知道为啥，找了半天没有找到纯 Browser 的 OpenAI SDK，都是 Node 实现的。于是自己写了一个，同时兼容 OpenAI 和 [API2d](https://api2d.com/) 的key。

## 使用方法

```js
import Api2d from 'api2d';

const timeout = 1000*60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// chat 补全
const ret = await api.completion({
    model:'gpt-3.5-turbo',
    messages: [
        {
            "role":"user",
            "content":"Hello"
        }
    ],
    stream: true, // 支持 stream，注意stream为 true 的时候，返回值为undefined
    onMessage: (string)=> {
        console.log( "SSE返回，这里返回的是已经接收到的完整字符串", string );
    },
    onEnd: (string)=> {
        console.log( "end", string );
    }
});


// embeddings
const ret = await api.embeddings({
    input: "hello world"
});
console.log( ret );

api.setKey( 'newkey' ); // set key
api.setApiBaseUrl( 'https://...your openai proxy address' );
api.setTimeout( 1000*60*5 );
api.abort(); // 主动取消请求

```

### Node 环境使用示例

```js
const api2d = require('api2d-js/cjs/index.js');
const forward_key = 'FK...';
async function doit()
{
    const api2d_instance = new api2d(forward_key);
    const response = await api2d_instance.completion({
        messages: [
            {
                'role':'user',
                'content':'来首唐诗',
            }
        ],
        stream: true,
        onMessage: (message) => {
            console.log(message);
        }
    });
    console.log(response);
}

doit();
```

[更多例子](https://github.com/easychen/api2d-js/pull/3#issuecomment-1498753640)



