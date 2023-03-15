中文说明见后边，以下英文由GPT3.5友情翻译。

# A simple pure browser SDK for Api2d and OpenAI

For some reason, I couldn't find a pure browser implementation of the OpenAI SDK, they were all designed for Node. So, I decided to create my own implementation that is compatible with both OpenAI and [API2d](https://api2d.com/) keys.

## Usage

```js
import Api2d from 'api2d';

const api = new Api2d(key, apiBaseUrl);

// Chat completion
const ret = await api.completion({
    model:'gpt-3.5-turbo',
    messages: [
        {
            "role":"user",
            "content":"Hello"
        }
    ],
    stream: true, // Supports streaming, note that when stream is true, the return value is undefined
    onMessage: (string)=> {
        console.log( "SSE returned, the complete string received is:", string );
    },
    onEnd: (string)=> {
        console.log( "end", string );
    }
});


// Embeddings
const ret = await api.embeddings({
    input: "hello world"
});
console.log( ret );

api.setKey( 'newkey' ); // set key
api.setApiBaseUrl( 'https://...your openai proxy address' );

```


# 一个简单的纯浏览器SDK for Api2d 和 OpenAI

不知道为啥，找了半天没有找到纯 Browser 的 OpenAI SDK，都是 Node 实现的。于是自己写了一个，同时兼容 OpenAI 和 [API2d](https://api2d.com/) 的key。

## 使用方法

```js
import Api2d from 'api2d';

const api = new Api2d(key, apiBaseUrl);

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

```

