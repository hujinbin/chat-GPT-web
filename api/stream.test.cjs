const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadAPI(fetch) {
    const localModules = new Map();
    const loadLocal = name => {
        if (localModules.has(name)) return localModules.get(name);
        assert.ok(['./attachments', './conversation'].includes(name));
        const localExports = {};
        localModules.set(name, localExports);
        const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, `${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
        vm.runInNewContext(code, { exports: localExports, require: loadLocal });
        return localExports;
    };
    const source = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, {
        exports, fetch, TextDecoder, DOMException,
        require: name => {
            if (name.startsWith('./')) return loadLocal(name);
            assert.equal(name, '../utils/request');
            return { __esModule: true, API_BASE_URL: '/api', default: () => {} };
        }
    });
    return exports;
}

function streamResponse(chunks) {
    const encoder = new TextEncoder();
    const state = { index: 0, cancelled: false, released: false };
    const reader = {
        read: async () => state.index < chunks.length
            ? { done: false, value: typeof chunks[state.index] === 'string' ? encoder.encode(chunks[state.index++]) : chunks[state.index++] }
            : { done: true },
        cancel: async () => { state.cancelled = true; },
        releaseLock: () => { state.released = true; }
    };
    return {
        response: { ok: true, headers: new Headers({ 'Content-Type': 'text/event-stream' }), body: { getReader: () => reader } },
        state, reader
    };
}

function callbacks() {
    const events = { data: [], search: [], stage: [], errors: [], done: 0 };
    return {
        events,
        args: [value => events.data.push(value), value => events.search.push(value), value => events.errors.push(value), () => { events.done++; }],
        options: { onStage: (...args) => events.stage.push(args) }
    };
}

test('CRLF、跨块、多行 data、UTF-8 和实时进度', async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('event: stage\r\ndata: {"stage":"search_done",\r\ndata: "message":"检索完成","count":2}\r\n\r\nevent: search\r\ndata: {"sources":[{"title":"文章","url":"https://example.com"}]}\r\n\r\nevent: message\r\ndata: {"content":"你好"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n');
    // 逐字节分块，同时覆盖 CRLF 与中文字符被拆开的情况。
    const chunks = Array.from(bytes, byte => Uint8Array.of(byte));
    const fixture = streamResponse(chunks);
    const api = loadAPI(async () => fixture.response);
    const cb = callbacks();
    await api.chatCompletionStream({ message: '查询' }, ...cb.args, cb.options);
    assert.deepEqual(cb.events.data, ['你好']);
    assert.equal(cb.events.stage[0][0], 'search_done');
    assert.equal(cb.events.stage[0][2].count, 2);
    assert.equal(cb.events.search[0][0].url, 'https://example.com');
    assert.equal(cb.events.done, 1);
    assert.deepEqual(cb.events.errors, []);
    assert.equal(fixture.state.released, true);
    assert.equal(fixture.state.cancelled, true);
});

test('每个事件重置 event 字段，正文随块到达立即回调', async () => {
    const fixture = streamResponse([
        'event: stage\ndata: {"stage":"generating","message":"生成中"}\n\n',
        'data: {"content":"第一段"}\n\n',
        'data: {"content":"第二段"}\n\ndata: [DONE]\n\n'
    ]);
    const read = fixture.reader.read;
    const cb = callbacks();
    fixture.reader.read = async () => {
        if (fixture.state.index === 2) assert.deepEqual(cb.events.data, ['第一段']);
        return read();
    };
    const api = loadAPI(async () => fixture.response);
    await api.chatCompletionStream({ message: '问题' }, ...cb.args, cb.options);
    assert.deepEqual(cb.events.data, ['第一段', '第二段']);
    assert.equal(cb.events.done, 1);
});

test('OpenAI delta 与 finish_reason 仅终止一次', async () => {
    const fixture = streamResponse(['data: {"choices":[{"delta":{"content":"回复"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n']);
    const cb = callbacks();
    await loadAPI(async () => fixture.response).chatCompletionStream({ message: '问题' }, ...cb.args);
    assert.deepEqual(cb.events.data, ['回复']);
    assert.equal(cb.events.done, 1);
});

test('提前断流保留正文并报告错误', async () => {
    const fixture = streamResponse(['data: {"content":"部分回复"}\n\n']);
    const cb = callbacks();
    await loadAPI(async () => fixture.response).chatCompletionStream({ message: '问题' }, ...cb.args);
    assert.deepEqual(cb.events.data, ['部分回复']);
    assert.equal(cb.events.done, 0);
    assert.match(cb.events.errors[0], /提前中断/);
    assert.equal(fixture.state.released, true);
});

test('显式错误与错误 JSON 只触发错误终止', async () => {
    for (const payload of ['event: error\ndata: {"message":"服务错误"}\n\nevent: done\ndata: {}\n\n', 'data: broken\n\n']) {
        const fixture = streamResponse([payload]);
        const cb = callbacks();
        await loadAPI(async () => fixture.response).chatCompletionStream({ message: '问题' }, ...cb.args);
        assert.equal(cb.events.errors.length, 1);
        assert.equal(cb.events.done, 0);
        assert.equal(fixture.state.cancelled, true);
        assert.equal(fixture.state.released, true);
    }
});

test('渲染回调异常不会被吞掉或转成网络错误', async () => {
    const fixture = streamResponse(['data: {"content":"回复"}\n\n']);
    const cb = callbacks();
    const failure = new Error('render failed');
    cb.args[0] = () => { throw failure; };
    await assert.rejects(loadAPI(async () => fixture.response).chatCompletionStream({ message: '问题' }, ...cb.args), error => error === failure);
    assert.deepEqual(cb.events.errors, []);
    assert.equal(cb.events.done, 0);
    assert.equal(fixture.state.released, true);
});

test('网络失败通过错误回调返回，HTTP 错误页不作为正文展示', async () => {
    const cb = callbacks();
    await loadAPI(async () => { throw new Error('network unavailable'); }).chatCompletionStream({ message: '问题' }, ...cb.args);
    assert.deepEqual(cb.events.errors, ['network unavailable']);
    const httpCB = callbacks();
    await loadAPI(async () => ({ ok: false, status: 502, text: async () => '<html>proxy error</html>' })).chatCompletionStream({ message: '问题' }, ...httpCB.args);
    assert.deepEqual(httpCB.events.errors, ['请求失败 (502)']);
});

test('取消传播给调用方并释放读取锁', async () => {
    const fixture = streamResponse([]);
    const controller = new AbortController();
    fixture.reader.read = async () => {
        controller.abort();
        throw controller.signal.reason;
    };
    const cb = callbacks();
    await assert.rejects(loadAPI(async () => fixture.response).chatCompletionStream({ message: '问题' }, ...cb.args, { signal: controller.signal }), error => error.name === 'AbortError');
    assert.deepEqual(cb.events.errors, []);
    assert.equal(cb.events.done, 0);
    assert.equal(fixture.state.released, true);
});

test('结束事件缺少末尾空行也能在 EOF 完成', async () => {
    const fixture = streamResponse(['event: done\ndata: {}']);
    const cb = callbacks();
    await loadAPI(async () => fixture.response).chatCompletionStream({ message: '问题' }, ...cb.args);
    assert.equal(cb.events.done, 1);
    assert.deepEqual(cb.events.errors, []);
});

test('图片问答与多轮历史保留 content 数组，旧文本格式仍兼容', async () => {
    const fixture = streamResponse(['event: done\ndata: {}\n\n']);
    let request;
    const api = loadAPI(async (_url, init) => { request = JSON.parse(init.body); return fixture.response; });
    const image = { id: 'image', name: 'image.png', url: 'data:image/png;base64,abc' };
    const history = [{ role: 'user', content: [{ type: 'text', text: '上一张图' }, { type: 'image_url', image_url: { url: image.url } }] }];
    const cb = callbacks();
    await api.chatCompletionStream({ message: '解释图片', images: [image], history, usingContext: true, search: false }, ...cb.args);
    assert.deepEqual(request.messages[0], history[0]);
    assert.deepEqual(request.messages[1].content, [{ type: 'text', text: '解释图片' }, { type: 'image_url', image_url: { url: image.url } }]);
    assert.equal(request.search, false);
});

test('智能联网阶段原样传递规划、跳过原因、失败和多个检索词', async () => {
    const fixture = streamResponse([
        'event: stage\ndata: {"stage":"search_planning","message":"正在理解本轮问题"}\n\n',
        'event: stage\ndata: {"stage":"search_start","message":"正在搜索资料","queries":["MacBook M4 价格","MacBook M4 配置"],"query":"MacBook M4 价格"}\n\n',
        'event: stage\ndata: {"stage":"search_skipped","message":"本轮是改写要求，直接回答"}\n\n',
        'event: stage\ndata: {"stage":"search_plan_failed","message":"暂时无法判断检索需求，继续回答"}\n\n',
        'event: done\ndata: {}\n\n',
    ]);
    const cb = callbacks();
    await loadAPI(async () => fixture.response).chatCompletionStream({ message: '这台电脑呢' }, ...cb.args, cb.options);
    assert.deepEqual(cb.events.stage.map(event => event[0]), ['search_planning', 'search_start', 'search_skipped', 'search_plan_failed']);
    assert.deepEqual(Array.from(cb.events.stage[1][2].queries), ['MacBook M4 价格', 'MacBook M4 配置']);
    assert.equal(cb.events.stage[2][1], '本轮是改写要求，直接回答');
    assert.equal(cb.events.errors.length, 0);
    assert.equal(cb.events.done, 1);
});

test('上下文关闭只发送显式本轮引用与原始提问，并保留智能联网授权', async () => {
    const fixture = streamResponse(['event: done\ndata: {}\n\n']);
    let request;
    const api = loadAPI(async (_url, init) => { request = JSON.parse(init.body); return fixture.response; });
    const cb = callbacks();
    await api.chatCompletionStream({ message: '现在多少钱', usingContext: false, search: true,
        history: [{ role: 'user', content: '旧的金融问题' }],
        references: [{ role: 'user', content: '用户引用的内容：MacBook M4' }],
    }, ...cb.args);
    assert.deepEqual(request.messages, [{ role: 'user', content: '用户引用的内容：MacBook M4' }, { role: 'user', content: '现在多少钱' }]);
    assert.equal(request.search, true);
});
