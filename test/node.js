const api2d = require('../cjs/index.js');
const fs = require('fs');
// 从环境变量取得key
const forward_key = process.env.FORWARD_KEY || "fk...";
async function chat() {
    const api2d_instance = new api2d(forward_key);
    const response = await api2d_instance.completion({
        messages: [
            {
                'role': 'user',
                'content': '来首唐诗',
            }
        ],
        noCache: true,
        stream: true,
        onMessage: (message) => {
            console.log(message);
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
        output: fs.createWriteStream('outputStream.mp3')
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

// chat();
// vector();
// tts();
ttsStream();
// stt();