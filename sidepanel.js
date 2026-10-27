import { templates, improve, compose } from './core.js';
import { DEFAULT_MODEL, listModels, rewrite } from './ollama.js';
import { macSetupCommand } from './setup.js';
const $ = id => document.getElementById(id);
const fields = ['body', 'tone'];
const sectionIds = ['quick-start', 'draft', 'review', 'ai-settings'];
let sectionsReady = false;
let sectionStates = {};
let autoOllama = true, enabled = false, revision = 0, suggestionRevision = 0, controller;
let connectionController, connectionPromise, connectionEpoch = 0;
let connectionPhase = 'checking', connectionMessage = '';
let saving = Promise.resolve();
const status = text => { $('status').textContent = text; };
const improveStatus = text => { $('improve-status').textContent = text; };
function state() { return Object.fromEntries([...fields.map(key => [key, $(key).value]), ['autoOllama', autoOllama], ['dark', document.body.classList.contains('dark')], ['sections', Object.fromEntries(sectionIds.map(id => [id, $(id).open]))]]); }
function save() {
  const snapshot = state();
  $('saved').textContent = 'Saving…';
  saving = saving.catch(() => {}).then(() => chrome.storage.local.set({ assistant: snapshot }));
  saving.then(() => { $('saved').textContent = 'Saved locally'; }, () => { $('saved').textContent = 'Save failed'; status('Local storage is unavailable or full. Copy your draft to keep it.'); });
}
function changed() {
  revision++;
  $('review').hidden = true;
  if (controller) { controller.abort(); connectionController?.abort(); improveStatus('Request cancelled because the draft or settings changed.'); }
  else improveStatus('');
  count(); save();
}
function count() { const n = $('body').value.trim().split(/\s+/).filter(Boolean).length; $('count').textContent = `${n} ${n === 1 ? 'word' : 'words'}`; }
function mode() {
  $('engine').textContent = !autoOllama ? 'Offline rules' : enabled ? `Local Ollama · ${DEFAULT_MODEL}` : connectionPhase === 'checking' ? 'Checking local Ollama…' : 'Ollama needs attention';
  $('configure-ai').textContent = 'Local AI settings';
  $('method').textContent = !autoOllama ? 'Offline rules make small phrase and whitespace changes. No network requests.' : enabled ? 'Ready. Improve uses your local Ollama app; your message stays unchanged until you apply a suggestion.' : connectionPhase === 'checking' ? 'Looking for your Ollama app automatically. Connection checks send no message text.' : 'Start Ollama or check Local AI settings. Turn off automatic connection to use offline rules.';
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
$('setup-command').value = macSetupCommand(chrome.runtime?.id);
$('copy-setup').disabled = !$('setup-command').value;
async function init() {
  try {
    const { assistant: data = {} } = await chrome.storage.local.get('assistant');
    for (const key of fields) if (typeof data[key] === 'string') $(key).value = data[key];
    for (const id of sectionIds) if (typeof data.sections?.[id] === 'boolean') $(id).open = data.sections[id];
    document.body.classList.toggle('dark', typeof data.dark === 'boolean' ? data.dark : matchMedia('(prefers-color-scheme: dark)').matches);
    // Automatic mode replaces the old opt-in setup; only the new explicit opt-out disables it.
    autoOllama = data.autoOllama !== false;
    $('ollama').checked = autoOllama;
    // Remove obsolete subject and custom signature fields; keep the draft and preferences.
    if (!Object.hasOwn(data, 'autoOllama') || ['subject', 'signature', 'model', 'ollama'].some(key => Object.hasOwn(data, key))) save();
  } catch { autoOllama = false; $('ollama').checked = false; status('Could not restore your saved draft. Automatic connection is off until you enable it.'); }
  count(); mode();
  sectionStates = Object.fromEntries(sectionIds.map(id => [id, $(id).open]));
  sectionsReady = true;
}
for (const key of ['body', 'tone']) $(key).addEventListener('input', changed);
for (const id of sectionIds) $(id).addEventListener('toggle', () => {
  if (!sectionsReady || sectionStates[id] === $(id).open) return;
  sectionStates[id] = $(id).open;
  save();
});
$('theme').onclick = () => { document.body.classList.toggle('dark'); save(); };
$('configure-ai').onclick = openSettings;
$('insert').onclick = () => {
  if ($('body').value.trim() && !confirm('Replace the current message with this template?')) return;
  const template = templates[Number($('template').value)]; $('body').value = template.body; changed(); status('Template inserted. Replace placeholders and verify the details.'); $('draft').open = true; $('body').focus();
};
function checkConnection() {
  if (!autoOllama) { $('connection-status').textContent = 'Automatic local AI is off. Offline rules make no requests.'; return Promise.resolve(false); }
  if (connectionPromise) return connectionPromise;
  const epoch = ++connectionEpoch;
  const attempt = new AbortController();
  connectionController = attempt;
  enabled = false; connectionPhase = 'checking';
  $('check-ollama').disabled = true;
  $('connection-status').textContent = 'Connecting to your Ollama app…';
  mode();
  const timer = setTimeout(() => attempt.abort(), 10000);
  connectionPromise = (async () => {
    try {
      const names = await listModels(attempt.signal);
      if (epoch !== connectionEpoch || !autoOllama) return false;
      if (!names.includes(DEFAULT_MODEL)) throw new Error(`Ollama is running, but ${DEFAULT_MODEL} is not installed locally. Run ollama pull ${DEFAULT_MODEL} once, then check again.`);
      enabled = true; connectionPhase = 'ready';
      connectionMessage = `Ready — using ${DEFAULT_MODEL} automatically. No connection settings to enter.`;
      return true;
    } catch (error) {
      if (epoch !== connectionEpoch || !autoOllama) return false;
      enabled = false; connectionPhase = 'unavailable';
      connectionMessage = error.name === 'AbortError' ? 'Connection check stopped or timed out. Open Ollama and check again.' : error.message;
      return false;
    } finally {
      clearTimeout(timer);
      if (epoch === connectionEpoch) {
        $('connection-status').textContent = connectionMessage;
        $('check-ollama').disabled = false;
        connectionController = undefined;
        connectionPromise = undefined;
        mode();
      }
    }
  })();
  return connectionPromise;
}
$('ollama').onchange = () => {
  autoOllama = $('ollama').checked;
  connectionEpoch++;
  connectionController?.abort(); connectionController = undefined; connectionPromise = undefined;
  enabled = false; $('check-ollama').disabled = false;
  changed();
  if (autoOllama) void checkConnection();
  else { connectionPhase = 'offline'; $('connection-status').textContent = 'Automatic local AI is off. Offline rules make no requests.'; mode(); }
};
$('check-ollama').onclick = () => { void checkConnection(); };
$('copy-setup').onclick = async () => {
  try { await navigator.clipboard.writeText($('setup-command').value); $('setup-status').textContent = 'Command copied. Run it in Terminal, then fully quit and reopen Ollama.'; }
  catch { $('setup-status').textContent = 'Could not copy. Select the command above and copy it manually.'; }
};
$('improve').onclick = async () => {
  const text = $('body').value;
  if (!text.trim()) { improveStatus('Write a message first, then click Improve wording.'); $('draft').open = true; $('body').focus(); return; }
  const current = revision, useOllama = autoOllama;
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
      if (!enabled) {
        improveStatus('Checking your local Ollama connection…');
        const ready = await checkConnection();
        if (requestController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (revision !== current) return;
        if (!ready) throw new Error(connectionMessage || 'Local Ollama is not ready. Check Local AI settings or turn off automatic connection for offline rules.');
      }
      improveStatus('Waiting for local Ollama. The first request may take longer while the model loads.');
      result = await rewrite({ text, tone: $('tone').value, model: DEFAULT_MODEL, signal: requestController.signal });
    } else result = improve(text, $('tone').value);
    if (revision !== current) return;
    const unchanged = result.text === text;
    $('suggestion').value = result.text; $('source').textContent = useOllama ? 'Local Ollama' : 'Offline rules';
    $('apply').disabled = unchanged;
    const notes = unchanged ? [useOllama ? 'Ollama returned the same wording. Your message is unchanged.' : 'No matching offline rules. For a full rewrite, enable automatic local Ollama in Local AI settings.'] : result.changes;
    $('changes').replaceChildren(...notes.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    suggestionRevision = current; $('review').open = true; $('review').hidden = false;
    improveStatus(unchanged ? 'Checked — no wording changes. See the result below.' : 'Suggestion ready below. Review it before applying.');
    $('review-heading').focus({ preventScroll: true });
    $('review').scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (error) {
    if (revision !== current) return;
    if (useOllama && error.name !== 'AbortError') {
      enabled = false; connectionPhase = 'unavailable'; connectionMessage = error.message;
      $('connection-status').textContent = connectionMessage; mode();
    }
    improveStatus(error.name === 'AbortError' ? 'Request cancelled or timed out. Your draft is unchanged. Check Ollama or try offline rules.' : error.message);
  } finally { clearTimeout(timer); controller = undefined; busy(false); }
};
$('cancel').onclick = () => { controller?.abort(); connectionController?.abort(); };
$('suggestion').addEventListener('input', () => { $('apply').disabled = suggestionRevision !== revision || $('suggestion').value === $('body').value; });
$('apply').onclick = () => { if (suggestionRevision !== revision) { improveStatus('Your draft changed. Generate a fresh suggestion.'); return; } $('body').value = $('suggestion').value; changed(); improveStatus('Suggestion applied.'); $('draft').open = true; $('body').focus(); };
$('dismiss').onclick = () => { $('review').hidden = true; improveStatus('Suggestion dismissed. Your draft is unchanged.'); $('draft').open = true; $('improve').focus(); };
$('copy').onclick = async () => { const text = compose($('body').value); if (!text) { status('Write a draft first.'); return; } try { await navigator.clipboard.writeText(text); status('Message copied. Review it in Zoho or your email client before sending.'); } catch { status('Clipboard access failed. Select and copy the draft manually.'); } };
$('clear').onclick = () => { if (!confirm('Clear the saved message? Your preferences will stay.')) return; $('body').value = ''; changed(); status('Draft cleared.'); };
// Keep controls disabled until restoration finishes, so typing cannot be overwritten.
const controls = [...document.querySelectorAll('button,input,select,textarea')];
controls.forEach(control => { control.disabled = true; });
init().finally(() => {
  controls.forEach(control => { control.disabled = false; });
  $('copy-setup').disabled = !$('setup-command').value;
  if (autoOllama) void checkConnection();
});
