const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadConversation() {
    const modules = new Map();
    const load = name => {
        if (modules.has(name)) return modules.get(name);
        const exports = {};
        modules.set(name, exports);
        const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, `${name}.ts`), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
        }).outputText;
        vm.runInNewContext(code, { exports, require: load });
        return exports;
    };
    return load('./conversation');
}

const api = loadConversation();
const plain = value => JSON.parse(JSON.stringify(value));
const user = (content, extra = {}) => ({ role: 'user', content, ...extra });
const assistant = (content, extra = {}) => ({ role: 'assistant', content, ...extra });

test('只传成功完整轮，欢迎语、媒体、失败、停止和未完成整轮均排除', () => {
    const history = [
        assistant('欢迎联网', { id: 'chat-welcome' }),
        user('旧问题'), assistant('成功回答'),
        user('失败问题'), assistant('失败片段', { error: true }),
        user('停止问题'), assistant('停止片段', { stopped: true }),
        user('等待问题'), assistant('', { loading: true }),
        user('生成图片'), assistant('图片已生成', { media: { kind: 'image' } }),
        user('空回复问题'), assistant(''),
        user('最新完整问题'), assistant('最新完整回答'),
    ];
    assert.deepEqual(plain(api.completedConversationHistory(history)), [user('旧问题'), assistant('成功回答'), user('最新完整问题'), assistant('最新完整回答')]);
});

test('多轮追问保持问题原文并从最近十个完整轮起始', () => {
    const messages = [];
    for (let i = 0; i < 12; i++) messages.push(user(`问题${i}`), assistant(`回复${i}`));
    const request = api.conversationRequest({ message: '它目前价格呢？', messages, usingContext: true });
    assert.equal(request.history.length, 20);
    assert.equal(request.history[0].content, '问题2');
    const sent = api.streamMessages(request);
    assert.equal(sent[sent.length - 1].content, '它目前价格呢？');
    assert.equal(sent[0].role, 'user');
    const quotedTurns = [];
    for (let i = 0; i < 8; i++) quotedTurns.push(user(`补充${i}`, { references: [user(`引用${i}`)] }), assistant(`回复${i}`));
    const grouped = plain(api.completedConversationHistory(quotedTurns));
    assert.equal(grouped.length, 18);
    assert.deepEqual(grouped.slice(0, 3), [user('引用2'), user('补充2'), assistant('回复2')]);
});

test('关闭上下文时仅保留本轮主动引用，新话题的最后user保持原文', () => {
    const messages = [user('怎样申请贷款'), assistant('贷款回答')];
    const request = api.conversationRequest({ message: '如何制作拿铁', quote: '意式咖啡与牛奶', messages, usingContext: false });
    const sent = plain(api.streamMessages(request));
    assert.equal(sent.length, 2);
    assert.match(sent[0].content, /意式咖啡与牛奶/);
    assert.equal(sent[1].content, '如何制作拿铁');
    assert.ok(!JSON.stringify(sent).includes('贷款'));
});

test('补充要求关闭历史仍含本次修改对象，不重复加入正在调整的整轮', () => {
    const image = { id: 'image', name: 'image.png', url: 'data:image/png;base64,YQ==' };
    const original = { content: '解释这个错误', images: [image] };
    const messages = [user('更早的金融问题'), assistant('更早的金融回答'), user(original.content, { images: original.images }), assistant('界面上的旧片段', { id: 'active', loading: true })];
    const guidance = { messageId: 'active', content: '当前已输出的准确片段', user: original };
    const isolated = api.conversationRequest({ message: '改为表格', messages, usingContext: false, guidance });
    const sent = plain(api.streamMessages(isolated));
    assert.equal(sent.length, 2);
    assert.equal(sent[1].content, '改为表格');
    assert.match(sent[0].content[0].text, /解释这个错误/);
    assert.match(sent[0].content[0].text, /当前已输出的准确片段/);
    assert.equal(sent[0].content[1].image_url.url, image.url);
    assert.ok(!JSON.stringify(sent).includes('更早的金融'));
    const context = api.conversationRequest({ message: '改为表格', messages, usingContext: true, guidance });
    assert.equal(context.history.length, 2);
    assert.equal(context.history[0].content, '更早的金融问题');
    const next = api.conversationRequest({ message: '只保留三行', messages: [], usingContext: false, guidance: { messageId: 'next', content: '', user: isolated.targetUser } });
    assert.match(next.references[0].content[0].text, /解释这个错误/);
    assert.match(next.references[0].content[0].text, /改为表格/);
    assert.equal(next.message, '只保留三行');
    const completed = api.completedConversationHistory([
        user('解释这个错误', { images: [image] }), assistant('停止前的部分回答', { stopped: true }),
        user('改为表格', { references: isolated.references }), assistant('已调整为表格'),
    ]);
    const followup = plain(api.streamMessages({ message: '第二行是什么意思', usingContext: true, history: completed }));
    assert.match(followup[0].content[0].text, /解释这个错误/);
    assert.equal(followup[0].content[1].image_url.url, image.url);
    assert.equal(followup[1].content, '改为表格');
    assert.equal(followup[followup.length - 1].content, '第二行是什么意思');
});

test('API只移除末尾重复本轮，保留显式用户历史和图文块且不以图片base64充当文字', () => {
    const image = { id: 'image', name: 'image.png', url: 'data:image/png;base64,YQ==' };
    const history = [assistant('孤立旧回答'), user('查这张图'), user('查这张图')];
    assert.deepEqual(plain(api.streamMessages({ message: '查这张图', history, usingContext: true })), [user('查这张图')]);
    const picture = plain(api.streamMessages({ message: '这是什么', images: [image], history: [user('旧图', { content: [{ type: 'text', text: '上一张产品图' }, { type: 'image_url', image_url: { url: image.url } }] })], usingContext: true }));
    assert.equal(picture[0].content[0].text, '上一张产品图');
    assert.equal(picture[1].content[0].text, '这是什么');
    assert.equal(picture[1].content[1].image_url.url, image.url);
    assert.ok(!picture.flatMap(item => Array.isArray(item.content) ? item.content.filter(block => block.type === 'text').map(block => block.text) : [item.content]).some(text => text.includes('base64')));
});

test('真实进度界面显示多检索词和跳过搜索的决定', () => {
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/ChatContent.tsx'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true }
    }).outputText;
    vm.runInNewContext(code, { exports, require: name => {
        if (name === 'react') return React;
        if (name.endsWith('.less')) return { __esModule: true, default: {} };
        return { __esModule: true, default: () => null };
    } });
    const markup = renderToStaticMarkup(React.createElement(exports.ChatProgress, {
        startedAt: new Date().toISOString(), loading: false,
        steps: [{ stage: 'search_planning', message: '正在规划检索' }, { stage: 'search_start', message: '按需检索', metadata: { query: 'MacBook M4 价格；MacBook M4 配置', queries: ['MacBook M4 价格', 'MacBook M4 配置'] } }],
        sources: [{ title: '参考资料', url: 'https://example.com' }],
    }));
    assert.match(markup, /检索 2 个关键词/);
    assert.match(markup, /MacBook M4 价格 \/ MacBook M4 配置/);
    const skipped = renderToStaticMarkup(React.createElement(exports.ChatProgress, {
        startedAt: new Date().toISOString(), loading: false,
        steps: [{ stage: 'search_skipped', message: '本轮为改写要求，已直接回答' }, { stage: 'done', message: '回复已完成' }],
    }));
    assert.match(skipped, /本轮为改写要求，已直接回答/);
});
