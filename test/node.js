const api2d = require('../cjs/index.js');
const fs = require('fs');
const nodeFetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

global.fetch =  (url, options) => {
    const data = {
      ...options,
      ...( process.env.http_proxy? { "agent": new HttpsProxyAgent(process.env.http_proxy) } : {})
    };
    return nodeFetch(url, data);
  };
// 从环境变量取得key
const forward_key = process.env.FORWARD_KEY || "fk...";
async function chat() {
    const api2d_instance = new api2d(forward_key, forward_key.startsWith("sk")? 'https://openrouter.ai/api/' : 'https://oa.api2d.net');
    const response = await api2d_instance.completion({
        messages: [
            {
                'role': 'user',
                'content': '来首唐诗，杜甫的',
            }
        ],
        model: "gpt-3.5-turbo",
        noCache: true,
        stream: true,
        onMessage: (message,char) => {
            console.log(char);
        }
    });
    console.log(response);
}

async function vector() {
    const api2d_instance = new api2d(forward_key);
    const text = '一纸淋漓漫点方圆透,记我 长风万里绕指未相勾,形生意成 此意 逍遥不游';
    // 调用 embedding 接口，将文本转为向量
    const response = await api2d_instance.embeddings({
        input: text,
    });
    console.log(response);
    if (response.data[0].embedding) {
        console.log("获取到向量", response.data[0].embedding);

        // 将向量和文本保存到数据库
        const response2 = await api2d_instance.vectorSave({
            text,
            embedding: response.data[0].embedding,
        });

        console.log(response2);

        if (response2.searchable_id) {
            console.log("保存成功，searchable_id=" + response2.searchable_id);

            // 开始搜索
            const response3 = await api2d_instance.vectorSearch({
                embedding: response.data[0].embedding,
                topk: 1,
                searchable_id: response2.searchable_id,
            });
            console.log(response3, response3.data.Get.Text[0].text);

            // 删除
            const response4 = await api2d_instance.vectorDelete({
                uuid: response2.uuid,
            });
            console.log(response4);
        }

    }


}

async function tts() {
    const api2d_instance = new api2d(forward_key);
    const text = '一纸淋漓漫点方圆透';
    // 调用 embedding 接口，将文本转为向量
    const ret1 = await api2d_instance.textToSpeech({
        text,
        voiceName: 'zh-CN-XiaochenNeural',
        responseType: 'file',
        output: 'output.mp3'
    });
    console.log("ret1", ret1);
}

async function ttsStream() {
    const api2d_instance = new api2d(forward_key);
    const text = '一纸淋漓漫点方圆透';
    // 调用 embedding 接口，将文本转为向量
    await api2d_instance.textToSpeech({
        text,
        voiceName: 'zh-CN-XiaochenNeural',
        responseType: 'stream',
        output: fs.createWriteStream('outputStream.mp3'),
        speed: 2
    });
}

async function stt() {
    const api2d_instance = new api2d(forward_key);
    // 调用 embedding 接口，将文本转为向量
    const response = await api2d_instance.speechToText({
        file: 'demo.wav',
        language: 'zh-CN'
    });
    console.log(response);
}

async function api()
{
    const api2d_instance = new api2d(forward_key);
    const ret = await api2d_instance.request({
        path: 'custom_api/186008/fetch?url='+encodeURIComponent('https://ftqq.com'),
        method: 'GET'
    }); 
    console.log("ret=", ret);
}

async function azure() {
    const api2d_instance = new api2d(forward_key, 'https://ai2co.openai.azure.com');
    const response = await api2d_instance.completionWithRetry({
        messages: [
            {
                'role': 'user',
                'content': '来首唐诗，杜甫的',
            }
        ],
        model:'gpt-3.5-turbo-0613',
        noCache: true,
        stream: true,
        onMessage: (message,char) => {
            console.log(char);
        },
        onEnd: () => {
            console.log("onEnd");
        }
    });

    console.log("await end", response);
}

async function image()
{
    const api2d_instance = new api2d(forward_key);
    const ret = await api2d_instance.imageGenerate(
    {
        "prompt": "A painting of a cat"
    });
    console.log(ret);
    // {
    //     created: 1706192857,
    //     data: [
    //       {
    //         revised_prompt: 'A decapturing the beauty of the natural world.',
    //         url: 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-KRG1eKn1nbXZ7vixuyJhpE6u/user-FQRBcGpSkM35GekObogjwLrc/img-ejom6IucUTN9l7fN6ms4aTuK.png?st=2024-01-25T13%3A27%3A37Z&se=2024-01-25T15%3A27%3A37Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2024-01-24T22%3A00%3A38Z&ske=2024-01-25T22%3A00%3A38Z&sks=b&skv=2021-08-06&sig=Jv6wGPUdsRCgOSmu348UfeIzaOkSwMjDVdP6MwuXCDU%3D'
    //       }
    //     ]
    //   }
}

image();
// chat();
// vector();
// tts();
// ttsStream();
// stt();
// api();
// azure();