const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, fetch = global.fetch) {
    const exports = {};
    const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInNewContext(compiled, { exports, fetch, FormData, Blob, DOMException, setTimeout, clearTimeout });
    return exports;
}

test('图片大小计算考虑 Base64 填充，旧文本内容保持字符串', () => {
    const api = load('attachments.ts');
    assert.equal(api.imageBytes({ url: 'data:image/png;base64,YQ==' }), 1);
    assert.equal(api.chatContent('普通客服问题'), '普通客服问题');
});

test('上传前拒绝非图片与超过限制的文件', async () => {
    const api = load('attachments.ts');
    await assert.rejects(api.readImage({ type: 'text/plain', size: 10 }), /PNG/);
    await assert.rejects(api.readImage({ type: 'image/png', size: 6 * 1024 * 1024 }), /5MB/);
});

test('图生图保留参考图、分辨率和比例', async () => {
    let payload;
    const api = load('media.ts', async (_url, init) => {
        payload = JSON.parse(init.body);
        return { ok: true, json: async () => ({ code: 200, data: { data: [{ url: 'https://images.example.com/result.png' }] } }) };
    });
    const result = await api.generateMedia('/api', 'image', '调整背景', 'agnes-image-2.5-flash', undefined, undefined, undefined, undefined,
        { images: [{ url: 'data:image/png;base64,YQ==' }], size: '2K', ratio: '3:4' });
    assert.deepEqual(payload.images, ['data:image/png;base64,YQ==']);
    assert.equal(payload.size, '2K');
    assert.equal(payload.ratio, '3:4');
    assert.equal(result.kind, 'image');
});

test('本地参考图先上传，视频仅收到公开URL和Flash支持参数', async () => {
    const requests = [];
    const api = load('media.ts', async (url, init) => {
        requests.push({ url, init });
        if (url.startsWith('data:')) return global.fetch(url);
        if (url.endsWith('/images/upload')) return { ok: true, json: async () => ({ code: 200, data: { url: 'https://images.example.com/reference.png' } }) };
        if (init.method === 'POST') return { ok: true, json: async () => ({ code: 200, data: { video_id: 'video_1' } }) };
        return { ok: true, json: async () => ({ code: 200, data: { status: 'completed', url: 'https://videos.example.com/result.mp4' } }) };
    });
    const result = await api.generateMedia('/api', 'video', '让图片动起来', 'agnes-video-2.5-flash', undefined, undefined, undefined, undefined,
        { images: [{ url: 'data:image/png;base64,YQ==', name: 'reference.png' }], ratio: '9:16', seconds: '8', videoMode: 'reference' });
    const uploaded = requests.find(request => request.url.endsWith('/images/upload'));
    assert.ok(uploaded.init.body instanceof FormData);
    const payload = JSON.parse(requests.find(request => request.url === '/api/ai/videos').init.body);
    assert.deepEqual(payload.images, ['https://images.example.com/reference.png']);
    assert.equal(payload.size, '720P');
    assert.equal(payload.seconds, '8');
    assert.equal(payload.aspect_ratio, '9:16');
    assert.equal(result.kind, 'video');
});

test('首尾帧与参考图字段保持互斥', async () => {
    let payload;
    const api = load('media.ts', async (_url, init) => {
        if (init.method === 'POST') { payload = JSON.parse(init.body); return { ok: true, json: async () => ({ code: 200, data: { video_id: 'video_2' } }) }; }
        return { ok: true, json: async () => ({ code: 200, data: { status: 'completed', url: 'https://videos.example.com/result.mp4' } }) };
    });
    await api.generateMedia('/api', 'video', '平滑过渡', 'agnes-video-2.5-flash', undefined, undefined, undefined, undefined,
        { images: [{ url: 'https://images.example.com/first.png' }, { url: 'https://images.example.com/last.png' }], videoMode: 'keyframe' });
    assert.equal(payload.first_frame, 'https://images.example.com/first.png');
    assert.equal(payload.last_frame, 'https://images.example.com/last.png');
    assert.equal(payload.images, undefined);
});
