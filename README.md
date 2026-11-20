中文说明见后边，以下英文由 GPT3.5 友情翻译。感谢 [cdswyda](https://github.com/cdswyda) 的 PR，已经可以在 Node 环境运行。

# A Simple Pure Browser SDK for Api2d and OpenAI

For some reason, I couldn't find a pure browser OpenAI SDK, they were all implemented in Node. So I wrote one myself, which is compatible with both OpenAI and [API2d](https://api2d.com/) keys.

## Change Log

- 0.1.41 添加 onReasoning 方法，用于输出推理过程中的内容
- 0.1.39 添加 imageGenerate 方法。

- 0.1.37：Azure默认模型名称采用去掉小数点的版本

```
{
  'gpt-3.5-turbo':'gpt-35-turbo',
  'gpt-3.5-turbo-0301':'gpt-35-turbo-0301',
  'gpt-3.5-turbo-0613':'gpt-35-turbo-0613',
  'gpt-3.5-16k':'gpt-35-16k',
  'gpt-3.5-16k-0613':'gpt-35-16k-0613',
  'gpt-4':'gpt-4',
  'text-embedding-ada-002':'text-embedding-ada-002',
}
```

- 0.1.36：修正chunk同时包含content和stop时，无法显示内容的问题，支持event action（清屏）
- 0.1.33：强制关闭 `@microsoft/fetch-event-source` 默认配置导致的请求重发
- 0.1.31：从api层删除发送给OpenAI的moderation的header以避免400错误

- 0.1.28：兼容Azure OpenAI 接口

使用方式：

1. apiBaseUrl 填入部署模型的域名部分如 `https://ai2co.openai.azure.com`
2. 按 deployments 参数中 `模型→部署名` 的对应关系在 Azure 上部署模型。如果你已经部署过模型，也可以修改 deployments 对象的值，并作为参数传递

```
(key = null, apiBaseUrl = null, timeout = 60000, version = '2023-07-01-preview', deployments = {
        'gpt-3.5-turbo':'GPT35',
        'gpt-3.5-turbo-0301':'GPT35',
        'gpt-3.5-turbo-0613':'GPT35',
        'gpt-3.5-16k':'GPT35-16K',
        'gpt-3.5-16k-0613':'GPT35-16K',
        'gpt-4':'GPT4',
        'text-embedding-ada-002':'EBD002',
    }) 
```
- 0.1.25：添加带重试的请求方法 completionWithRetry，添加 request 方法以支持自定义接口

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

## API2D 图片和音频

使用自己的 Forward Key。浏览器可以从用户输入获取密钥，Node 示例从 `API2D_FORWARD_KEY` 环境变量读取。一次调用只发送一次 HTTP 请求，重复生成前先检查 ID 和计费结果。

```js
import Api2d from 'api2d';

const api = new Api2d(forwardKey, 'https://oa.api2d.net', 650_000);
const imageClientRequestId = crypto.randomUUID();
const image = await api.imageGenerate({
  model: 'gpt-image-2.6-sunburst',
  prompt: '白色背景上的绿色陶瓷杯',
  output_format: 'webp',
  response_format: 'url',
  idempotencyKey: imageClientRequestId,
});

if (image.request_id) {
  const order = await api.imageGetOrder(image.request_id);
  console.log(order.status, order.data?.[0]?.url);
}

const transcript = await api.audioTranscribe({
  file: document.querySelector('input[type=file]').files[0],
  stream: true,
  idempotencyKey: crypto.randomUUID(),
  onDelta: delta => console.log(delta),
});
console.log(transcript.text, transcript.requestId, transcript.chargedPoints);
```

- `imageGenerate` 支持 Flare 和 Sunburst。SDK 默认返回 `url`，也可用 `b64_json` 在首次响应拿到 Base64。通过 `idempotencyKey` 传入自己生成的客户端请求编号。用原编号和原参数重试图片请求，避免重复生成和扣点。用响应中的 `request_id` 查询原订单。签名下载链接有效 24 小时，最多 5 次整图下载尝试。
- `audioTranscribe` 默认用 `gpt-transcribe`，流式上限 720 秒，非流式接收上限 600 秒。`audioTranslate` 默认用 `gpt-realtime-translate`，英文输出，流式 480 秒，非流式接收上限 300 秒。
- 推荐 `stream: true`，默认使用 JSON 事件。应用以 `onDelta(delta, text)` 接收增量和累积文字，Promise 返回完整结果。开启已配置的腾讯云文本审核时，服务端返回 JSON。公网代理在非流式请求等待约 125 秒后可能超时。新版上传与响应大小各为 5,000,000 字节。
- `audioSpeech({ input, voice, ... })` 默认用 `gpt-realtime-2.1-mini`，最多 500 个 UTF-16 代码单元。返回 `{ audio, contentType, requestId, chargedPoints }`，其中 `audio` 是 `ArrayBuffer`。
### 避免重复提交（可选）

`idempotencyKey` 是可选项。客户端超时或断线后，服务端可能已开始处理，程序自动重发会有重复生成和扣点的风险。想防止这种情况，可以在首次发送前保存自己生成的客户端请求编号。同一次请求重试时，把同一个编号传给 `idempotencyKey`。

- **图片生成**用原编号和相同参数重试可查看原请求状态或取回仍有效的图片链接。
- **音频处理**使用已受理的编号会收到 `409`，表示这次没有再次生成或扣点。音频文件、转录和译文只随原请求的响应交付。
- **确实想重新生成**时换一个新编号，或省略 `idempotencyKey`。服务端会当成新请求并单独计费。

音频 HTTP 或 SSE 错误可通过异常的 `status`、`code` 和 `requestId` 排查。

Node 示例支持文件路径，浏览器可传 `File` 或附带 `filename` 的 `Blob`。运行以下示例时，先在环境中设置自己的 `API2D_FORWARD_KEY`。需要重试同一次图片生成时，将原客户端请求编号设置为 `API2D_REQUEST_KEY`。

```bash
node examples/media.cjs image
node examples/media.cjs order YOUR_REQUEST_ID
node examples/media.cjs transcribe recording.mp3
node examples/media.cjs translate recording.mp3
node examples/media.cjs speech speech.mp3
```

[音频文档](https://api2d.com/doc/audio) · [图片文档](https://api2d.com/doc/images) · [Node 示例](examples/media.cjs)

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
