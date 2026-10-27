import test from 'node:test';
import assert from 'node:assert/strict';
import { rewrite, listModels } from '../ollama.js';
const parameters = { text: 'Please check the update.', tone: 'professional', model: 'llama3.2:3b' };
test('Ollama sends only explicit draft content to the fixed loopback endpoint', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    const data = JSON.parse(options.body);
    assert.equal(data.model, parameters.model);
    assert.equal(data.stream, false);
    assert.equal(data.messages[1].content, parameters.text);
    assert.equal(data.messages.length, 2);
    assert.match(data.messages[0].content, /professional/);
    return Response.json({ message: { content: ' Could you please check the update? ' } });
  });
  const result = await rewrite(parameters);
  assert.equal(result.text, 'Could you please check the update?');
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});
test('connection lists only installed local models and removes duplicates', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/tags');
    assert.equal(options.credentials, 'omit');
    return Response.json({ models: [{ name: 'llama3.2:3b' }, { name: 'llama3.2:3b' }, { name: 'gpt-oss:120b-cloud' }, { name: 'remote:latest', remote_host: 'cloud' }, { name: 'other:latest', remote_model: 'remote' }] });
  });
  assert.deepEqual(await listModels(), ['llama3.2:3b']);
});
test('connection and model errors give actionable feedback', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(rewrite(parameters), /Start Ollama.*OLLAMA_ORIGINS/);
  fetch.mock.mockImplementation(async () => new Response('', { status: 403 }));
  await assert.rejects(rewrite(parameters), /HTTP 403.*OLLAMA_ORIGINS/);
  fetch.mock.mockImplementation(async () => new Response('', { status: 404 }));
  await assert.rejects(rewrite(parameters), /HTTP 404.*ollama pull qwen2.5:3b/);
  fetch.mock.mockImplementation(async () => Response.json({ message: { content: '' } }));
  await assert.rejects(rewrite(parameters), /empty suggestion/);
});
test('cloud model and oversized draft are rejected before any network request', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not be called'); });
  await assert.rejects(rewrite({ ...parameters, model: 'gpt-oss:120b-cloud' }), /Cloud models are not supported/);
  await assert.rejects(rewrite({ ...parameters, text: 'x'.repeat(24001) }), /24,000/);
  assert.equal(fetch.mock.callCount(), 0);
});
test('abort remains identifiable so the UI can distinguish cancellation', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Aborted', 'AbortError'); });
  await assert.rejects(rewrite(parameters), { name: 'AbortError' });
});
test('cancellation during response parsing remains an abort', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => { throw new DOMException('Aborted', 'AbortError'); }
  }));
  await assert.rejects(rewrite(parameters), { name: 'AbortError' });
});
