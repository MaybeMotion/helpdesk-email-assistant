import { templates, improve, compose } from './core.js';
import { listModels, rewrite } from './ollama.js';
const $ = id => document.getElementById(id);
const fields = ['body', 'signature', 'tone', 'model'];
let enabled = false, revision = 0, suggestionRevision = 0, controller;
let saving = Promise.resolve();
const status = text => { $('status').textContent = text; };
const improveStatus = text => { $('improve-status').textContent = text; };
function state() { return Object.fromEntries([...fields.map(key => [key, $(key).value]), ['ollama', enabled], ['dark', document.body.classList.contains('dark')]]); }
function save() {
  const snapshot = state();
  $('saved').textContent = 'Saving…';
  saving = saving.catch(() => {}).then(() => chrome.storage.local.set({ assistant: snapshot }));
  saving.then(() => { $('saved').textContent = 'Saved locally'; }, () => { $('saved').textContent = 'Save failed'; status('Local storage is unavailable or full. Copy your draft to keep it.'); });
}
function changed() {
  revision++;
  $('review').hidden = true;
  if (controller) { controller.abort(); improveStatus('Request cancelled because the draft or settings changed.'); }
  else improveStatus('');
  count(); save();
}
function count() { const n = $('body').value.trim().split(/\s+/).filter(Boolean).length; $('count').textContent = `${n} ${n === 1 ? 'word' : 'words'}`; }
function mode() {
  $('engine').textContent = enabled ? 'Local Ollama' : 'Offline rules';
  $('configure-ai').textContent = enabled ? 'Local AI settings' : 'Set up local AI';
  $('method').textContent = enabled ? 'Local Ollama: sends this message to your computer only when you click Improve.' : 'Offline rules make small phrase and whitespace changes. For a full rewrite, enable local Ollama.';
}
function busy(value) {
  $('improve').disabled = value;
  $('improve-label').textContent = value ? 'Improving with local Ollama…' : 'Improve wording';
  $('improve').setAttribute('aria-busy', String(value));
  $('cancel').hidden = !value;
}
function openSettings() { $('ai-settings').open = true; $('ai-settings').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('ollama').focus({ preventScroll: true }); }
const groups = new Map();
for (const [i, template] of templates.entries()) {
  if (!groups.has(template.group)) { const group = document.createElement('optgroup'); group.label = template.group; $('template').append(group); groups.set(template.group, group); }
  const option = document.createElement('option'); option.value = i; option.textContent = template.name; groups.get(template.group).append(option);
}
$('template-count').textContent = `${templates.length} templates`;
$('extension-origin').textContent = chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}` : 'Your extension origin is shown here when installed in Chrome.';
async function init() {
  try {
    const { assistant: data = {} } = await chrome.storage.local.get('assistant');
    for (const key of fields) if (typeof data[key] === 'string') $(key).value = data[key];
    // Restore draft content even when permission inspection fails.
    document.body.classList.toggle('dark', typeof data.dark === 'boolean' ? data.dark : matchMedia('(prefers-color-scheme: dark)').matches);
    if (data.ollama) {
      try { enabled = await chrome.permissions.contains({ origins: ['http://localhost:11434/*'] }); }
      catch { improveStatus('Local Ollama permission could not be checked. Offline rules are available.'); }
      if (!enabled) improveStatus('Local Ollama permission is missing. Enable it in Local AI settings to use AI rewriting.');
    }
    $('ollama').checked = enabled;
    // Remove the obsolete subject from our saved state without touching other extension keys.
    if (Object.hasOwn(data, 'subject')) save();
  } catch { status('Could not restore your saved draft.'); }
  count(); mode();
}
for (const key of ['body', 'tone', 'model']) $(key).addEventListener('input', changed);
$('signature').addEventListener('input', save);
$('theme').onclick = () => { document.body.classList.toggle('dark'); save(); };
$('configure-ai').onclick = openSettings;
$('insert').onclick = () => {
  if ($('body').value.trim() && !confirm('Replace the current message with this template?')) return;
  const template = templates[Number($('template').value)]; $('body').value = template.body; changed(); status('Template inserted. Replace placeholders and verify the details.'); $('body').focus();
};
$('ollama').onchange = async () => {
  const requested = $('ollama').checked;
  $('ollama').disabled = true;
  try {
    if (requested) {
      enabled = await chrome.permissions.request({ origins: ['http://localhost:11434/*'] });
      $('connection-status').textContent = enabled ? 'Permission granted. Check connection to find your installed local models.' : 'Localhost permission was declined. Offline rules are still available.';
    } else {
      enabled = false;
      await chrome.permissions.remove({ origins: ['http://localhost:11434/*'] });
      $('connection-status').textContent = 'Local AI disabled. Offline rules make no network requests.';
    }
  } catch { enabled = false; $('connection-status').textContent = 'Local Ollama permission could not be changed. Offline rules are available.'; }
  $('ollama').checked = enabled; $('ollama').disabled = false; mode(); changed();
};
$('check-ollama').onclick = async () => {
  if (!enabled) { $('connection-status').textContent = 'Enable Use local Ollama and grant localhost permission first.'; $('ollama').focus(); return; }
  $('check-ollama').disabled = true;
  $('connection-status').textContent = 'Connecting to local Ollama…';
  const connection = new AbortController();
  const timer = setTimeout(() => connection.abort(), 10000);
  try {
    const names = await listModels(connection.signal);
    if (!enabled) return;
    $('models').replaceChildren(...names.map(name => { const option = document.createElement('option'); option.value = name; return option; }));
    if (!names.length) { $('connection-status').textContent = 'Connected, but no local models were found. Download one with ollama pull llama3.2, then check again.'; return; }
    let selected = '';
    if (!names.includes($('model').value)) { $('model').value = names.find(name => name === `${$('model').value}:latest`) || names[0]; selected = ` Selected ${$('model').value}.`; changed(); }
    $('connection-status').textContent = `Connected. Local models: ${names.join(', ')}.${selected}`;
  } catch (error) {
    if (enabled) $('connection-status').textContent = error.name === 'AbortError' ? 'Connection check timed out. Check that Ollama is running on localhost:11434.' : error.message;
  } finally { clearTimeout(timer); $('check-ollama').disabled = false; }
};
$('improve').onclick = async () => {
  const text = $('body').value;
  if (!text.trim()) { improveStatus('Write a message first, then click Improve wording.'); $('body').focus(); return; }
  const current = revision, useOllama = enabled;
  $('review').hidden = true;
  busy(true);
  // Offline rules finish immediately; only local model requests need a cancel control.
  $('cancel').hidden = !useOllama;
  let timer;
  try {
    let result;
    if (useOllama) {
      controller = new AbortController();
      const requestController = controller;
      timer = setTimeout(() => requestController.abort(), 120000);
      improveStatus('Waiting for local Ollama. The first request may take longer while the model loads.');
      result = await rewrite({ text, tone: $('tone').value, model: $('model').value.trim(), signal: requestController.signal });
    } else result = improve(text, $('tone').value);
    if (revision !== current) return;
    const unchanged = result.text === text;
    $('suggestion').value = result.text; $('source').textContent = useOllama ? 'Local Ollama' : 'Offline rules';
    $('apply').disabled = unchanged;
    const notes = unchanged ? [useOllama ? 'Ollama returned the same wording. Your message is unchanged.' : 'No matching offline rules. For a full rewrite, enable local Ollama using “Set up local AI”.'] : result.changes;
    $('changes').replaceChildren(...notes.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    suggestionRevision = current; $('review').hidden = false;
    improveStatus(unchanged ? 'Checked — no wording changes. See the result below.' : 'Suggestion ready below. Review it before applying.');
    $('review-heading').focus({ preventScroll: true });
    $('review').scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (error) {
    if (revision !== current) return;
    improveStatus(error.name === 'AbortError' ? 'Request cancelled or timed out. Your draft is unchanged. Check Ollama or try offline rules.' : error.message);
  } finally { clearTimeout(timer); controller = undefined; busy(false); }
};
$('cancel').onclick = () => controller?.abort();
$('suggestion').addEventListener('input', () => { $('apply').disabled = suggestionRevision !== revision || $('suggestion').value === $('body').value; });
$('apply').onclick = () => { if (suggestionRevision !== revision) { improveStatus('Your draft changed. Generate a fresh suggestion.'); return; } $('body').value = $('suggestion').value; changed(); improveStatus('Suggestion applied.'); $('body').focus(); };
$('dismiss').onclick = () => { $('review').hidden = true; improveStatus('Suggestion dismissed. Your draft is unchanged.'); $('improve').focus(); };
$('copy').onclick = async () => { const text = compose($('body').value, $('signature').value); if (!text) { status('Write a draft first.'); return; } try { await navigator.clipboard.writeText(text); status('Message copied. Review it in Zoho or your email client before sending.'); } catch { status('Clipboard access failed. Select and copy the draft manually.'); } };
$('clear').onclick = () => { if (!confirm('Clear the saved message? Your signature and preferences will stay.')) return; $('body').value = ''; changed(); status('Draft cleared.'); };
// Keep controls disabled until restoration finishes, so typing cannot be overwritten.
const controls = [...document.querySelectorAll('button,input,select,textarea')];
controls.forEach(control => { control.disabled = true; });
init().finally(() => controls.forEach(control => { control.disabled = false; }));
