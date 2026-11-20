const Api2d = require('../cjs');
const { writeFile } = require('node:fs/promises');

async function main() {
    const key = process.env.API2D_FORWARD_KEY;
    if (!key) throw new Error('Set API2D_FORWARD_KEY in your environment');
    const client = new Api2d(key, 'https://oa.api2d.net', 650000);
    const [command, argument] = process.argv.slice(2);
    const idempotencyKey = process.env.API2D_REQUEST_KEY;

    if (command === 'image') {
        const result = await client.imageGenerate({
            model: 'gpt-image-2.6-flare', prompt: '白色桌面上的绿色陶瓷杯',
            output_format: 'webp', response_format: 'url', idempotencyKey,
        });
        if (result.error) throw new Error(result.error.message);
        console.log(result);
        return;
    }

    if (command === 'order' && argument) {
        console.log(await client.imageGetOrder(argument));
        return;
    }

    if ((command === 'transcribe' || command === 'translate') && argument) {
        const options = {
            file: argument, stream: true, idempotencyKey,
            onDelta: delta => process.stdout.write(delta),
        };
        const result = command === 'transcribe'
            ? await client.audioTranscribe(options)
            : await client.audioTranslate(options);
        console.log('\nRequest ID:', result.requestId, 'Charged points:', result.chargedPoints);
        return;
    }

    if (command === 'speech') {
        const result = await client.audioSpeech({
            input: '欢迎使用 API2D。', voice: 'alloy', response_format: 'mp3', idempotencyKey,
        });
        await writeFile(argument || 'speech.mp3', Buffer.from(result.audio));
        console.log('Request ID:', result.requestId, 'Charged points:', result.chargedPoints);
        return;
    }
    if (command === 'azure-speech') {
        const result = await client.azureSpeech({
            text: '欢迎使用 API2D。', voiceName: 'zh-CN-XiaoxiaoNeural', format: 'wav', idempotencyKey,
        });
        await writeFile(argument || 'azure-speech.wav', Buffer.from(result.audio));
        console.log('Request ID:', result.requestId, 'Charged points:', result.chargedPoints);
        return;
    }

    if (command === 'azure-transcribe' && argument) {
        const result = await client.azureTranscribe({ file: argument, model: 'fast', idempotencyKey });
        console.log(result);
        return;
    }

    throw new Error('Usage: node examples/media.cjs image | order ID | transcribe FILE | translate FILE | speech [OUTPUT] | azure-speech [OUTPUT] | azure-transcribe FILE');
}

main().catch(error => {
    console.error(error.message, error.requestId || '');
    process.exitCode = 1;
});
