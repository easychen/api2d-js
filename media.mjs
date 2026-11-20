import { createParser } from 'eventsource-parser';

const requestIdOf = response => response.headers.get('x-api-requestid') || response.headers.get('x-request-id') || undefined;

function apiError(status, body, requestId) {
    const details = body?.error || body;
    const message = details?.message || (typeof body === 'string' && body) || `API2D request failed with HTTP ${status}`;
    const error = new Error(message);
    error.status = status;
    error.code = details?.code;
    error.requestId = body?.requestId || body?.request_id || details?.requestId || requestId;
    if (body?.originalRequestId) error.originalRequestId = body.originalRequestId;
    error.body = body;
    return error;
}

async function readError(response, requestId) {
    const text = await response.text();
    let body = text;
    try { body = JSON.parse(text); } catch (_) { /* An intermediary may send text. */ }
    return apiError(response.status, body, requestId);
}

function chargedPointsOf(response) {
    const value = response.headers.get('x-api2d-charged-points');
    return value && /^\d+$/.test(value) ? Number(value) : undefined;
}

async function mediaRequest(client, send, path, init, consume) {
    const controller = new AbortController();
    const parent = client.controller.signal;
    const abort = () => controller.abort();
    if (parent.aborted) abort();
    else parent.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        abort();
    }, client.timeout);
    let requestId;
    try {
        const base = client.apiBaseUrl.replace(/\/+$/, '');
        const versionedBase = /\/v\d+$/.test(base) ? base : `${base}/v${client.apiVersion}`;
        const target = path.startsWith('/') ? base.replace(/\/v\d+$/, '') + path : `${versionedBase}/${path}`;
        const response = await send(target, {
            ...init, signal: controller.signal, redirect: 'error',
            headers: { ...client.authHeader, ...client.refHeader, ...init.headers },
        });
        requestId = requestIdOf(response);
        return await consume(response, requestId);
    } catch (error) {
        abort();
        if (timedOut) throw apiError(408, `API2D request timed out after ${client.timeout} ms`, requestId);
        if (requestId && error && typeof error === 'object' && !error.requestId) error.requestId = requestId;
        throw error;
    } finally {
        clearTimeout(timer);
        parent.removeEventListener('abort', abort);
    }
}

const idempotencyHeader = key => key === undefined ? {} : { 'Idempotency-Key': key };

export function imageGenerate(client, send, options) {
    const { idempotencyKey, imageModeration, model = 'gpt-image-2.6-flare', response_format = 'url', ...body } = options;
    const headers = { 'Content-Type': 'application/json', ...idempotencyHeader(idempotencyKey) };
    if (imageModeration !== undefined) headers['X-Api2d-Image-Moderation'] = imageModeration;
    return mediaRequest(client, send, 'images/generations', {
        method: 'POST', headers, body: JSON.stringify({ ...body, model, response_format }),
    }, async (response, requestId) => {
        // imageGenerate has historically returned API JSON errors as values.
        if (!response.ok && !response.headers.get('content-type')?.includes('json')) throw await readError(response, requestId);
        return response.json();
    });
}

export function imageGetOrder(client, send, requestId) {
    client.api2dOnly();
    if (typeof requestId !== 'string' || !requestId.trim()) throw new TypeError('An image request ID is required');
    return mediaRequest(client, send, 'images/generations?api2d_order=' + encodeURIComponent(requestId), {
        method: 'GET',
    }, async (response, id) => {
        if (!response.ok) throw await readError(response, id);
        return response.json();
    });
}

export function audioSpeech(client, send, options) {
    client.api2dOnly();
    const { idempotencyKey, model = 'gpt-realtime-2.1-mini', ...body } = options;
    return mediaRequest(client, send, 'audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...idempotencyHeader(idempotencyKey) },
        body: JSON.stringify({ ...body, model }),
    }, readSpeech);
}

async function readSpeech(response, requestId) {
    if (!response.ok) throw await readError(response, requestId);
    return {
        audio: await response.arrayBuffer(),
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        requestId,
        chargedPoints: chargedPointsOf(response),
    };
}

export function azureSpeech(client, send, options) {
    client.api2dOnly();
    const { idempotencyKey, ...body } = options;
    return mediaRequest(client, send, '/azure/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...idempotencyHeader(idempotencyKey) },
        body: JSON.stringify(body),
    }, readSpeech);
}

export async function azureTranscribe(client, send, makeForm, options) {
    client.api2dOnly();
    const { file, filename, idempotencyKey, phraseList, ...body } = options;
    const form = await makeForm(file, filename);
    for (const [field, value] of Object.entries(body)) {
        if (value !== undefined) form.set(field, String(value));
    }
    if (phraseList !== undefined) form.set('phraseList', JSON.stringify(phraseList));
    return mediaRequest(client, send, '/azure/stt', {
        method: 'POST', headers: idempotencyHeader(idempotencyKey), body: form,
    }, async (response, requestId) => {
        if (!response.ok) throw await readError(response, requestId);
        return { ...await response.json(), requestId, chargedPoints: chargedPointsOf(response) };
    });
}

async function* responseChunks(body) {
    if (body[Symbol.asyncIterator]) {
        yield* body;
        return;
    }
    const reader = body.getReader();
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return;
            yield value;
        }
    } finally {
        reader.releaseLock();
    }
}

async function readAudioEvents(response, requestId, prefix, onDelta) {
    const decoder = new TextDecoder();
    let text = '', final, ended = false;
    const parser = createParser(event => {
        if (event.type !== 'event' || ended) return;
        if (event.data === '[DONE]') {
            ended = true;
            return;
        }
        const payload = JSON.parse(event.data);
        if (payload.type === 'error' || payload.error) throw apiError(payload.status || 502, payload, requestId);
        if (payload.type === prefix + '.delta') {
            text += payload.delta;
            onDelta?.(payload.delta, text);
        }
        if (payload.type === prefix + '.done') final = payload;
    });
    if (response.body) {
        for await (const bytes of responseChunks(response.body)) {
            parser.feed(decoder.decode(bytes, { stream: true }));
            if (ended) break;
        }
        parser.feed(decoder.decode());
    }
    if (!final) throw apiError(502, 'Audio stream ended before the completion event', requestId);
    return { ...final, requestId: final.requestId || requestId };
}

export async function audioUpload(client, send, makeForm, route, options) {
    client.api2dOnly();
    const translate = route === 'translations';
    const { file, filename, idempotencyKey, onDelta, model = translate ? 'gpt-realtime-translate' : 'gpt-transcribe', ...body } = options;
    const form = await makeForm(file, filename);
    form.set('model', model);
    for (const [field, value] of Object.entries(body)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
            for (const item of value) form.append(field + '[]', item);
        } else form.set(field, String(value));
    }

    const headers = idempotencyHeader(idempotencyKey);
    if (body.stream) headers.Accept = 'text/event-stream';
    return mediaRequest(client, send, 'audio/' + route, { method: 'POST', headers, body: form }, async (response, requestId) => {
        if (!response.ok) throw await readError(response, requestId);
        const type = response.headers.get('content-type') || '';
        if (type.includes('text/event-stream')) {
            return readAudioEvents(response, requestId, translate ? 'translation.text' : 'transcript.text', onDelta);
        }
        const payload = type.includes('json') ? await response.json() : { text: await response.text() };
        return { ...payload, requestId: payload.requestId || requestId, chargedPoints: chargedPointsOf(response) };
    });
}
