const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const Api2d = require('../cjs');

const incoming = [];
const requestId = 'test-request-id';
const audio = Buffer.from([1, 2, 3]);

function json(response, data, status = 200) {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(data));
}

async function serve(request, response) {
    const parts = [];
    for await (const part of request) parts.push(part);
    const body = Buffer.concat(parts).toString();
    const url = new URL(request.url, 'http://localhost');
    incoming.push({ path: url.pathname, query: url.searchParams, headers: request.headers, body });
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-api2d-charged-points', '25');

    if (url.pathname === '/v1/images/generations') {
        if (request.method === 'GET') {
            const id = url.searchParams.get('api2d_order');
            if (id === 'missing') return json(response, { error: { code: 'not_found', message: 'Image request not found' } }, 404);
            return json(response, { request_id: requestId, status: 'pending' }, 202);
        }
        const data = JSON.parse(body);
        if (data.prompt === 'conflict') return json(response, { error: { code: 'idempotency_conflict', message: 'Conflict' } }, 409);
        return json(response, { request_id: requestId, status: 'settled', data: [{ b64_json: 'AQID' }] });
    }
    if (url.pathname === '/v1/audio/speech') {
        response.setHeader('Content-Type', 'audio/mpeg');
        return response.end(audio);
    }
    if (body.includes('name="moderation"\r\n\r\ntrue')) return json(response, { text: '审核通过' });
    if (body.includes('name="response_format"\r\n\r\ntext')) {
        response.setHeader('Content-Type', 'text/plain');
        return response.end('完整文本');
    }

    response.setHeader('Content-Type', 'text/event-stream');
    if (body.includes('error.wav')) {
        return response.end('data: ' + JSON.stringify({ type: 'error', status: 502, code: 50003, message: 'Upstream failed', requestId }) + '\n\n');
    }
    if (body.includes('incomplete.wav')) return response.end(': heartbeat\n\n');

    const prefix = url.pathname.endsWith('/translations') ? 'translation.text' : 'transcript.text';
    const fragment = 'data: ' + JSON.stringify({ type: prefix + '.delta', delta: '你好' }) + '\n\n';
    const done = 'data: ' + JSON.stringify({ type: prefix + '.done', text: '你好', requestId, chargedPoints: 25 }) + '\n\n';
    const bytes = Buffer.from(fragment);
    const boundary = bytes.indexOf(Buffer.from('你好')) + 1;
    response.write(': heartbeat\n\n');
    response.write(bytes.subarray(0, boundary));
    setImmediate(() => response.end(Buffer.concat([bytes.subarray(boundary), Buffer.from(': heartbeat\n\n' + done + 'data: [DONE]\n\n')])));
}

async function check(Adapter, base, file, namedFile) {
    const api = new Adapter('fk', base + '/v1/', 5000); // Mock routing prefix only.
    const image = await api.imageGenerate({
        model: 'gpt-image-2.6-sunburst', prompt: 'A cup', output_format: 'webp',
        output_compression: 83, quality: 'medium', response_format: 'b64_json',
        idempotencyKey: 'test-idempotency', imageModeration: 'strict',
    });
    assert.equal(image.data[0].b64_json, 'AQID');
    const imageRequest = incoming.at(-1);
    assert.equal(imageRequest.headers['idempotency-key'], 'test-idempotency');
    assert.equal(imageRequest.headers['x-api2d-image-moderation'], 'strict');
    assert.equal(JSON.parse(imageRequest.body).model, 'gpt-image-2.6-sunburst');
    assert.equal(JSON.parse(imageRequest.body).output_compression, 83);
    assert.equal(JSON.parse(imageRequest.body).idempotencyKey, undefined);
    assert.equal((await api.imageGenerate({ prompt: 'conflict' })).error.code, 'idempotency_conflict');
    assert.equal(JSON.parse(incoming.at(-1).body).model, 'gpt-image-2.6-flare');
    assert.equal(JSON.parse(incoming.at(-1).body).response_format, 'url');

    assert.equal((await api.imageGetOrder('id & spaces')).status, 'pending');
    assert.equal(incoming.at(-1).query.get('api2d_order'), 'id & spaces');
    await assert.rejects(api.imageGetOrder('missing'), { status: 404, code: 'not_found', requestId });

    const speech = await api.audioSpeech({ input: 'Hello', voice: 'alloy', idempotencyKey: 'test-speech' });
    assert.deepEqual(Buffer.from(speech.audio), audio);
    assert.equal(speech.contentType, 'audio/mpeg');
    assert.equal(speech.requestId, requestId);
    assert.equal(speech.chargedPoints, 25);
    assert.equal(JSON.parse(incoming.at(-1).body).model, 'gpt-realtime-2.1-mini');

    const received = [];
    const transcript = await api.audioTranscribe({
        file, stream: true, languages: ['zh', 'en'], idempotencyKey: 'test-audio',
        onDelta: (delta, text) => received.push([delta, text]),
    });
    assert.deepEqual(received, [['你好', '你好']]);
    assert.equal(transcript.text, '你好');
    assert.equal(transcript.requestId, requestId);
    assert.equal(transcript.chargedPoints, 25);
    const upload = incoming.at(-1);
    assert.equal(upload.headers['idempotency-key'], 'test-audio');
    assert.match(upload.headers['content-type'], /^multipart\/form-data; boundary=/);
    assert.match(upload.body, /name="languages\[\]"\r\n\r\nzh/);
    assert.match(upload.body, /name="model"\r\n\r\ngpt-transcribe/);
    assert.match(upload.body, /filename="[^"]+\.wav"/);
    assert.ok(!upload.body.includes('onDelta'));

    assert.equal((await api.audioTranslate({ file, stream: true })).type, 'translation.text.done');
    assert.match(incoming.at(-1).body, /name="model"\r\n\r\ngpt-realtime-translate/);
    await assert.rejects(api.audioTranslate({ ...namedFile('error.wav'), stream: true }), { status: 502, code: 50003, requestId });
    await assert.rejects(api.audioTranslate({ ...namedFile('incomplete.wav'), stream: true }), { status: 502, requestId });
    const audited = await api.audioTranslate({ file, stream: true, moderation: true, onDelta: () => assert.fail('Expected ordinary JSON') });
    assert.equal(audited.text, '审核通过');
    assert.equal(audited.chargedPoints, 25);
    const plain = await api.audioTranscribe({ file, response_format: 'text' });
    assert.equal(plain.text, '完整文本');
    assert.equal(plain.requestId, requestId);
}

(async () => {
    const server = http.createServer((request, response) => {
        serve(request, response).catch(error => response.destroy(error));
    });
    const folder = await fs.mkdtemp(path.join(tmpdir(), 'api2d-media-sdk-'));
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const base = 'http://127.0.0.1:' + server.address().port;
        const file = path.join(folder, 'recording.wav');
        await fs.writeFile(file, audio);
        await check(Api2d, base, file, filename => ({ file: audio, filename }));
        console.log('PASS Node SDK');
        if (typeof File !== 'undefined') {
            const { default: Browser } = await import('../index.js');
            const named = filename => ({ file: new File([audio], filename) });
            await check(Browser, base, named('recording.wav').file, named);
            console.log('PASS browser SDK entry with native Fetch and FormData');
        }
    } finally {
        server.close();
        await fs.rm(folder, { recursive: true, force: true });
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
