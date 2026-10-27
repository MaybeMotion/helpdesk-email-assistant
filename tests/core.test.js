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
test('composition always uses the fixed closing and does not copy empty drafts', () => {
  assert.equal(compose(' Hello '), 'Hello\n\nKind regards,\nLouis');
  assert.equal(compose(''), '');
  assert.equal(compose(' \n\t '), '');
});
test('composition normalises an existing closing without duplicating it', () => {
  const expected = 'Hello\n\nKind regards,\nLouis';
  assert.equal(compose('Hello\n\nKind regards,\nLouis'), expected);
  assert.equal(compose('Hello\n\nkind REGARDS,\r\nLOUIS  '), expected);
  assert.equal(compose('Hello\n\nKind regards,'), expected);
  assert.equal(compose('Kind regards,\nLouis'), 'Kind regards,\nLouis');
});
test('composition preserves other names and text', () => {
  assert.equal(compose('Hello Louis,\n\nThank you,\nSam'), 'Hello Louis,\n\nThank you,\nSam\n\nKind regards,\nLouis');
  assert.equal(compose('Hello\n\nKind regards,\nSam'), 'Hello\n\nKind regards,\nSam\n\nKind regards,\nLouis');
});
test('18 grouped templates include general email and IT support', () => {
  assert.equal(templates.length, 18);
  assert.equal(new Set(templates.map(t => t.name)).size, 18);
  assert.deepEqual([...new Set(templates.map(t => t.group))], ['Everyday email', 'Working together', 'IT support']);
  for (const template of templates) assert.ok(template.body && template.group && !Object.hasOwn(template, 'subject'));
});
test('model identifiers are constrained', () => {
  assert.ok(validateModel('llama3.2:3b'));
  assert.ok(!validateModel(''));
  assert.ok(!validateModel('gpt-oss:120b-cloud'));
  assert.ok(!validateModel('model:cloud'));
  assert.ok(!validateModel('bad model\n'));
});
test('MV3 permissions contain no email, tab or cloud access', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['sidePanel', 'storage']);
  assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1/*']);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'; connect-src http://127.0.0.1:11434");
  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
  assert.ok(!manifest.content_scripts && !manifest.optional_host_permissions);
});

test('manifest icons are valid PNG files at every declared size', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  for (const [size, filename] of Object.entries(manifest.icons)) {
    const bytes = await readFile(new URL('../' + filename, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), Number(size));
    assert.equal(bytes.readUInt32BE(20), Number(size));
    assert.equal(manifest.action.default_icon[size], filename);
  }
});
