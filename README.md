中文说明见后边，以下英文由 GPT3.5 友情翻译。感谢 [cdswyda](https://github.com/cdswyda) 的 PR，已经可以在 Node 环境运行。

# A Simple Pure Browser SDK for Api2d and OpenAI

For some reason, I couldn't find a pure browser OpenAI SDK, they were all implemented in Node. So I wrote one myself, which is compatible with both OpenAI and [API2d](https://api2d.com/) keys.

## Change Log

- 0.1.22：tts支持speed参数

## Usage

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60 seconds timeout
const api = new Api2d(key, apiBaseUrl, timeout);

// chat completion
const ret = await api.completion({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'user',
      content: 'Hello',
    },
  ],
  stream: true, // supports stream, note that when stream is true, the return value is undefined
  onMessage: (string) => {
    console.log('SSE returns, here is the complete string received', string);
  },
  onEnd: (string) => {
    console.log('end', string);
  },
});

// embeddings
const ret = await api.embeddings({
  input: 'hello world',
});
console.log(ret);

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://...your openai proxy address');
api.setTimeout(1000 * 60 * 5);
api.abort(); // cancel the request actively
```

### Example of using in Node environment

```js
const api2d = require('api2d-js/cjs/index.js');
const forward_key = 'FK...';
async function doit() {
  const api2d_instance = new api2d(forward_key);
  const response = await api2d_instance.completion({
    messages: [
      {
        role: 'user',
        content: '来首唐诗',
      },
    ],
    stream: true,
    onMessage: (message) => {
      console.log(message);
    },
  });
  console.log(response);
}

doit();
```

[More examples](https://github.com/easychen/api2d-js/pull/3#issuecomment-1498753640)

# 一个简单的纯浏览器 SDK for Api2d 和 OpenAI

不知道为啥，找了半天没有找到纯 Browser 的 OpenAI SDK，都是 Node 实现的。于是自己写了一个，同时兼容 OpenAI 和 [API2d](https://api2d.com/) 的 key。

## 使用方法

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// chat 补全
const ret = await api.completion({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'user',
      content: 'Hello',
    },
  ],
  stream: true, // 支持 stream，注意stream为 true 的时候，返回值为undefined
  onMessage: (string) => {
    console.log('SSE返回，这里返回的是已经接收到的完整字符串', string);
  },
  onEnd: (string) => {
    console.log('end', string);
  },
});

// embeddings
const ret = await api.embeddings({
  input: 'hello world',
});
console.log(ret);

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://...your openai proxy address');
api.setTimeout(1000 * 60 * 5);
api.abort(); // 主动取消请求
```

### Node 环境使用示例

```js
const api2d = require('api2d-js/cjs/index.js');
const forward_key = 'FK...';
async function doit() {
  const api2d_instance = new api2d(forward_key);
  const response = await api2d_instance.completion({
    messages: [
      {
        role: 'user',
        content: '来首唐诗',
      },
    ],
    stream: true,
    onMessage: (message) => {
      console.log(message);
    },
  });
  console.log(response);
}

doit();
```

## Azure 语音 <=> 文字

Azure 这两个 API 涉及到文件操作，稍微有点复杂，所以单独拿出来说明。

注意，Azure API 只能使用 API2D 地址。

### 浏览器环境

#### 语音 => 文字

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// stt
const ret = await api.speechToText({
  file: document.querySelector('input').files[0], // 这里可以使用用户本地选择的文件，也可以通过各种形式构建 File 对象传入
  language: 'zh-CN', // 文字对应的语言，Azure 支持的语言列表：https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=stt
  moderation: false, // 如果设置为 true，会使用腾讯云的文本审核
  moderation_stop: false, // 如果设置为 true，当内容违规会自动清除
});
console.log(ret); // {text: '这里是转换好的文字内容'}

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://openai.api2d.net'); // 只能使用 api2d
api.setTimeout(1000 * 60 * 5);
api.abort(); // 主动取消请求
```

注意输入的文件只能是 `.wav` 格式。

#### 文字 => 语音

首先，文字转语音支持三种返回类型：

- `file`：指定文件名，会直接调用浏览器把生成好的文件下载到本地
- `blob`：返回文件的 blob，可以做进一步处理
- `blob-url`：返回一个 blob-url，可以直接调用浏览器的 `Audio` 接口播放声音

下面分别举例。

##### file

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// tts
api.textToSpeech({
  text: '你好',
  voiceName: 'zh-CN-XiaochenNeural', // Azure 支持的声音列表：https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=tts#supported-languages
  responseType: 'file',
  speed: 1.5, // 语速，默认为 1，范围是 0.5~2，超出范围会自动改为最近的合法值
  moderation: false, // 如果设置为 true，会使用腾讯云的文本审核，在【转换音频之前】对文字进行审核
  moderation_stop: false, // 如果设置为 true，当内容违规会直接返回，不生成音频文件
});

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://openai.api2d.net'); // 只能使用 api2d
api.setTimeout(1000 * 60 * 5);
api.abort(); // 主动取消请求
```

这里我们不需要 `await`，因为生成好之后会直接通过浏览器下载，我们不需要什么返回值。当然如果你想要等待这个过程完成，也可以 `await`，只是返回值为空，单纯用来判断是否生成完毕。

##### blob

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// tts
const blob = await api.textToSpeech({
  text: '你好',
  voiceName: 'zh-CN-XiaochenNeural', // Azure 支持的声音列表：https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=tts#supported-languages
  responseType: 'blob',
  speed: 1.5, // 语速，默认为 1，范围是 0.5~2，超出范围会自动改为最近的合法值
  moderation: false, // 如果设置为 true，会使用腾讯云的文本审核，在【转换音频之前】对文字进行审核
  moderation_stop: false, // 如果设置为 true，当内容违规会直接返回，不生成音频文件
});

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://openai.api2d.net'); // 只能使用 api2d
api.setTimeout(1000 * 60 * 5);
api.abort(); // 主动取消请求
```

拿到 blob 之后可以进行各种处理。如果你只是想播放声音，可以使用 `blob-url`。

##### blob-url

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// tts
const blob_url = await api.textToSpeech({
  text: '你好',
  voiceName: 'zh-CN-XiaochenNeural', // Azure 支持的声音列表：https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=tts#supported-languages
  responseType: 'blob-url',
  speed: 1.5, // 语速，默认为 1，范围是 0.5~2，超出范围会自动改为最近的合法值
  moderation: false, // 如果设置为 true，会使用腾讯云的文本审核，在【转换音频之前】对文字进行审核
  moderation_stop: false, // 如果设置为 true，当内容违规会直接返回，不生成音频文件
});

var audio0 = new Audio(blob_url);
audio0.play(); // 这里会直接播放声音

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://openai.api2d.net'); // 只能使用 api2d
api.setTimeout(1000 * 60 * 5);
api.abort(); // 主动取消请求
```

### NodeJS 环境

NodeJS 环境因为可以操作本地文件，也可以对流做更多处理，所以接口和返回类型稍有不同。

#### 语音 => 文字

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// stt
const ret = await api.speechToText({
  file: 'demo.wav', // 可以是一个完整路径
  language: 'zh-CN', // 文字对应的语言，Azure 支持的语言列表：https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=stt
  moderation: false, // 如果设置为 true，会使用腾讯云的文本审核
  moderation_stop: false, // 如果设置为 true，当内容违规会自动清除
});
console.log(ret); // {text: '这里是转换好的文字内容'}

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://openai.api2d.net'); // 只能使用 api2d
api.setTimeout(1000 * 60 * 5);
api.abort(); // 主动取消请求
```

#### 文字 => 语音

NodeJS 环境下支持两种返回值：

- file
- stream

##### file

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// tts
await api.textToSpeech({
  text: '你好',
  voiceName: 'zh-CN-XiaochenNeural', // Azure 支持的声音列表：https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=tts#supported-languages
  responseType: 'file',
  speed: 1.5, // 语速，默认为 1，范围是 0.5~2，超出范围会自动改为最近的合法值
  output: 'output.mp3', // 可以是一个完整路径
  moderation: false, // 如果设置为 true，会使用腾讯云的文本审核，在【转换音频之前】对文字进行审核
  moderation_stop: false, // 如果设置为 true，当内容违规会直接返回，不生成音频文件
});

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://openai.api2d.net'); // 只能使用 api2d
api.setTimeout(1000 * 60 * 5);
api.abort(); // 主动取消请求
```

执行完毕后会直接把音频存入本地文件中。

##### stream

```js
import Api2d from 'api2d';

const timeout = 1000 * 60; // 60秒超时
const api = new Api2d(key, apiBaseUrl, timeout);

// tts
await api.textToSpeech({
  text: '你好',
  voiceName: 'zh-CN-XiaochenNeural', // Azure 支持的声音列表：https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=tts#supported-languages
  responseType: 'stream',
  speed: 1.5, // 语速，默认为 1，范围是 0.5~2，超出范围会自动改为最近的合法值
  output: fs.createWriteStream('outputStream.mp3'),
  moderation: false, // 如果设置为 true，会使用腾讯云的文本审核，在【转换音频之前】对文字进行审核
  moderation_stop: false, // 如果设置为 true，当内容违规会直接返回，不生成音频文件
});

api.setKey('newkey'); // set key
api.setApiBaseUrl('https://openai.api2d.net'); // 只能使用 api2d
api.setTimeout(1000 * 60 * 5);
api.abort(); // 主动取消请求
```

输出是一个 stream，这里我们只是把它写入本地文件，你也可以自行处理实现更多功能，比如一边生成一边播放。

[更多例子](https://github.com/easychen/api2d-js/pull/3#issuecomment-1498753640)
