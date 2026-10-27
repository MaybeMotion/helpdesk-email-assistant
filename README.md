# Helpdesk Email Assistant

A private Chrome side panel for IT support email writing. Vanilla JavaScript, HTML and CSS; Manifest V3; no build step, trackers, email access or automatic sending.

## Install in Chrome

1. Download this repository (Code → Download ZIP) and extract it, or clone it.
2. Open `chrome://extensions` in Chrome 114 or newer (current Chrome recommended).
3. Enable **Developer mode**, click **Load unpacked**, and choose the folder containing `manifest.json`.
4. Pin Helpdesk Email Assistant from the Extensions menu. Click its toolbar icon to open the side panel.

After updating files, click Reload on the extension card and reopen the panel.

## Write an email

Choose a support template or enter a subject and message. Select Professional, Friendly, Concise or Formal, then click **Improve wording**. Review or edit the separate suggestion and choose Apply or Dismiss. Your original message is never replaced automatically. Enter a signature and click **Copy email** to copy the subject, message and signature. Paste into your email client, check the details, and send it yourself.

The six templates cover first responses, requesting details, troubleshooting, progress updates, resolution checks and closure. Template insertion asks before replacing a draft. Verify statements about resolutions and request closure before using them.

The draft, signature, model preference and theme save automatically in **Chrome local storage**, not Chrome Sync. Clear draft removes the saved subject and message, retaining preferences and signature. Removing the extension deletes its local storage. One draft is saved per Chrome profile; simultaneous panels use the latest saved state. Clipboard copying is an explicit user action and puts text on your system clipboard, outside extension storage.

## Offline rules (default)

No network requests are made in the default mode. Improvements use small, documented phrase substitutions and whitespace cleanup, not AI. For example, Professional replaces “ASAP” with “as soon as possible”, Concise replaces “in order to” with “to”, and Formal replaces “can't” with “cannot”. The review panel reports matching changes. These are conservative wording aids, not grammar checking, technical verification or a full semantic rewrite. No match means no wording change.

## Optional local AI with Ollama

Ollama mode is an explicit exception to the no-network default: it makes a loopback HTTP request to **your computer**, never to an external AI provider. Only the message and tone are submitted when you click Improve; the subject and signature are excluded. The extension does not send email, inspect websites, or read your inbox. All persistent extension data stays in `chrome.storage.local`. Ollama is a separate process: its memory, logs and retention are governed by your local Ollama installation, so do not use AI mode if you require draft data to stay exclusively inside Chrome storage even during processing.

1. Install/update Ollama on the same computer as Chrome. Download a **local** model while online, for example `ollama pull llama3.2`. Do not select an Ollama cloud model. For strict local-only operation, also configure `OLLAMA_NO_CLOUD=1` in the Ollama server environment and restart it; localhost alone does not prevent a separately configured Ollama server from using cloud models. Once downloaded, local inference works without Internet access.
2. In `chrome://extensions`, copy this extension's **ID**. Configure Ollama to permit the exact origin `chrome-extension://YOUR_EXTENSION_ID`, then restart Ollama. Do not use a wildcard origin.
3. On macOS, run `launchctl setenv OLLAMA_ORIGINS "chrome-extension://YOUR_EXTENSION_ID"`, quit Ollama completely, then reopen it. On Windows, quit Ollama, add the user environment variable `OLLAMA_ORIGINS` with that value in system settings, then reopen Ollama. For a Linux systemd service, use `sudo systemctl edit ollama` and add:

   ```ini
   [Service]
   Environment="OLLAMA_ORIGINS=chrome-extension://YOUR_EXTENSION_ID"
   ```

   Then run `sudo systemctl daemon-reload` and `sudo systemctl restart ollama`. For a manually started server, set `OLLAMA_ORIGINS=chrome-extension://YOUR_EXTENSION_ID ollama serve` in its terminal instead. Stop an existing server first if the port is occupied.
4. Keep Ollama bound to loopback (the default). This extension deliberately supports only `http://localhost:11434`, not remote hosts or configurable endpoints.
5. Expand **Local AI settings**, enable **Use local Ollama**, and grant Chrome's optional localhost permission. Enter the exact installed model name (check `ollama list`), such as `llama3.2` or `llama3.2:3b`.
6. Write a short draft and click Improve. Review the suggestion carefully: models can invent details. Requests time out after two minutes; edits cancel pending suggestions. Disable Ollama to revoke the optional host permission and return to offline rules. Errors never silently fall back or overwrite your draft.

A connection error usually means Ollama is stopped. HTTP 403 usually means the extension origin needs to be allowed; HTTP 404 can mean the model is missing. A reinstalled unpacked extension may have a new ID; update the origin accordingly. Chrome permissions and Ollama origin configuration are both required. Local Ollama integration must be tested on your own computer; a cloud development machine cannot access your desktop's localhost.

## Development and tests

Node.js 20+ is recommended for development tests. There are no npm dependencies or build commands:

```sh
npm test
node --check sidepanel.js
node --check background.js
```

Unit tests cover tone substitutions, change reporting, preservation of technical text, email composition, templates, model identifiers and least-privilege manifest settings. Browser interaction tests live in `tests/browser.cjs`; they require Playwright and Chromium installed separately, and simulate Chrome APIs rather than loading a real extension. Run with `NODE_PATH=/path/to/node_modules node tests/browser.cjs` (optionally set `CHROMIUM_PATH`).

Manual Chrome checks:

- Open from the toolbar, edit a draft, close/reopen the panel and verify restoration.
- Insert a template; cancel and accept replacement confirmations.
- Generate each tone, dismiss a suggestion, then generate and apply another.
- Copy with and without a signature; verify clipboard text in a local text editor.
- Toggle theme, reopen, and verify preference persistence.
- Clear a draft and verify signature survives.
- With Ollama disabled, verify no requests in the panel's DevTools Network tab.
- Enable Ollama, approve localhost permission, test a locally installed model, then test a missing model and stopped server. Disable it and verify offline behavior.

No backend, API keys, email permissions, external fonts or CDNs are required. The service worker only configures toolbar-to-side-panel behavior. Rendered suggestions use text values, never HTML.
