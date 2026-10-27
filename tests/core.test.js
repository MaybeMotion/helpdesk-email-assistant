import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { improve, compose, templates, validateModel } from '../core.js';
test('professional rules report actual substitutions', () => {
  const result = improve('hey, please reply ASAP.  ', 'professional');
  assert.equal(result.text, 'Hello, please reply as soon as possible.');
  assert.equal(result.changes.length, 3);
});
test('tone choices use distinct transparent rules', () => {
  assert.equal(improve("I can't help, thanks", 'formal').text, 'I cannot help, Thank you');
  assert.equal(improve('in order to test due to the fact that it failed', 'concise').text, 'to test because it failed');
  assert.equal(improve('Dear user, please be advised that we are investigating.', 'friendly').text, 'Hello, we are investigating.');
});
test('preserves technical details, paragraphs and uncertainty', () => {
  const text = 'Restart service X.\n\nError 0x800: this may help.';
  assert.equal(improve(text, 'professional').text, text);
  assert.deepEqual(improve(text, 'professional').changes, []);
});
test('composition includes signature once and handles empty fields', () => {
  assert.equal(compose(' Update ', ' Hello ', ' Regards '), 'Subject: Update\n\nHello\n\nRegards');
  assert.equal(compose('', 'Hello', ''), 'Hello');
  assert.equal(compose('', '', ''), '');
});
test('six complete reusable templates', () => {
  assert.equal(templates.length, 6);
  assert.equal(new Set(templates.map(t => t.name)).size, 6);
  for (const template of templates) assert.ok(template.subject && template.body);
});
test('model identifiers are constrained', () => {
  assert.ok(validateModel('llama3.2:3b'));
  assert.ok(!validateModel(''));
  assert.ok(!validateModel('bad model\n'));
});
test('MV3 permissions contain no email, tab or cloud access', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['sidePanel', 'storage']);
  assert.deepEqual(manifest.optional_host_permissions, ['http://localhost:11434/*']);
  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
  assert.ok(!manifest.content_scripts && !manifest.host_permissions);
});
