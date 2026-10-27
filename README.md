# Helpdesk Email Assistant

A private Chrome side panel for everyday and IT support emails. Vanilla JavaScript, HTML and CSS; Manifest V3; no build step, trackers, inbox access or automatic sending. Version 1.2 adds collapsible sections and a fixed closing, while retaining purple accents, extension icons, and 18 quick starts.

## Install or update in Chrome

1. Download this repository (Code → Download ZIP) and extract it, or clone it.
2. Open `chrome://extensions` in Chrome 116 or newer (current Chrome recommended).
3. Enable **Developer mode**, click **Load unpacked**, and choose the folder containing `manifest.json`.
4. Pin Helpdesk Email Assistant from the Extensions menu. Click its toolbar icon to open the side panel.

To update, replace the files in the **same folder** you originally loaded, keeping the folder path unchanged. Click **Reload** on the extension card, then close and reopen the side panel. Keep the existing extension installed to retain its ID and local draft; removing and reinstalling it deletes local storage and may change its ID. If the ID changes, update Ollama's allowed origin too.

## Write a message

Click a section header to minimise or expand **Quick start**, **Your draft**, **Review suggestion** or **Local AI settings**. The headers also work with the keyboard: focus one with Tab, then press Enter or Space. Each section’s open or closed state is remembered locally.

Choose a quick start or write your message, then select Professional, Friendly, Concise or Formal and click **Improve wording**. Feedback appears next to the button, and completed suggestions scroll into view for review. Edit the suggestion if needed, then choose Apply or Dismiss. Your original draft is never replaced automatically. Local AI requests show a waiting state and can be cancelled. Inserting a template or applying a suggestion opens Your draft automatically. Generating a new suggestion opens Review suggestion so the result remains easy to find.

There are **18 quick starts**, grouped into **Everyday email**, **Working together** and **IT support**. They cover general correspondence as well as support requests. Replace any `[placeholders]` and verify the details before use. Inserting a template asks before replacing an existing message.

Click **Copy message** to copy a nonempty message with this fixed closing:

```text
Kind regards,
Louis
```

The Personal touch box and custom signature field have been removed. An existing matching closing is not duplicated, and a draft ending in “Kind regards,” gains the name. An empty draft copies nothing. There is no subject field and no subject line is copied, so you can paste straight into an existing Zoho conversation or another email editor. Review the result and send it yourself.

The draft, section states, model preference and theme save automatically in **Chrome local storage**, not Chrome Sync. Updating removes legacy saved custom signatures while retaining the message and other preferences. Clear draft removes the message while retaining your preferences; the fixed closing is added to future copied messages. One draft is saved per Chrome profile; simultaneous panels use the latest saved state. Explicit copying places text on your system clipboard, outside extension storage.

## Offline rules (default)

No network requests are made in the default mode. Improvements use phrase substitutions and whitespace cleanup, not AI. For example, Professional replaces “ASAP” with “as soon as possible”, Concise replaces “in order to” with “to”, and Formal replaces “can't” with “cannot”. The review panel reports matching changes and explicitly tells you when no rule changed your wording.

These are limited wording aids, not full grammar checking, technical verification or semantic rewriting. Having Ollama installed does not enable it automatically: choose **Set up local AI** if you want local model suggestions.

## Optional local AI with Ollama

Ollama mode makes a loopback HTTP request to **your computer**. The extension contacts only `http://localhost:11434`, never a cloud AI endpoint. Clicking Improve submits the message and chosen tone; the fixed closing is added when copying. **Check connection & find models** requests the installed model list (`/api/tags`) without sending your draft.

Persistent extension data stays in `chrome.storage.local`. Ollama is a separate process: its memory, logs and retention depend on your installation. Leave AI disabled if draft data must stay exclusively inside Chrome storage even during processing.

1. Install/update Ollama on the same computer as Chrome and download a **local** model while online, for example `ollama pull llama3.2`. Once downloaded, local inference can work without Internet access. Cloud model names are rejected, and model-list entries marked as remote are excluded. Also configure **`OLLAMA_NO_CLOUD=1`** in the Ollama server environment and restart it: client-side checks cannot guarantee the configuration of a separate Ollama server.
2. Click **Set up local AI**. The settings show this extension's exact origin, such as `chrome-extension://YOUR_EXTENSION_ID`. Configure Ollama to allow that origin in `OLLAMA_ORIGINS`, then restart Ollama. Do not use a wildcard origin.
3. On macOS, run `launchctl setenv OLLAMA_ORIGINS "chrome-extension://YOUR_EXTENSION_ID"` and `launchctl setenv OLLAMA_NO_CLOUD "1"`, then quit Ollama completely and reopen it. On Windows, quit Ollama, add the user environment variables `OLLAMA_ORIGINS` and `OLLAMA_NO_CLOUD` with those values in system settings, then reopen it. For a Linux systemd service, use `sudo systemctl edit ollama` and add:

   ```ini
   [Service]
   Environment="OLLAMA_ORIGINS=chrome-extension://YOUR_EXTENSION_ID"
   Environment="OLLAMA_NO_CLOUD=1"
   ```

   Then run `sudo systemctl daemon-reload` and `sudo systemctl restart ollama`. For a manually started server, use `OLLAMA_NO_CLOUD=1 OLLAMA_ORIGINS=chrome-extension://YOUR_EXTENSION_ID ollama serve` instead. Stop an existing server first if its port is occupied.
4. Keep Ollama bound to loopback (the default). Enable **Use local Ollama** and approve Chrome's optional localhost permission.
5. Click **Check connection & find models**, then choose an installed local model from the model field's suggestions. You can also type its exact name from `ollama list`, such as `llama3.2:3b`.
6. Write a draft and click Improve. Review the result carefully: models can invent details. Requests time out after two minutes, and edits cancel pending suggestions. Disable Ollama to revoke the optional host permission and return to offline rules. Errors do not silently switch modes or overwrite your message.

Connection feedback distinguishes an unreachable server, blocked origin (HTTP 403), missing model or endpoint (HTTP 404), and invalid responses. Check Ollama is running, the exact extension origin is allowed, and the model is installed. Chrome permissions and Ollama origin configuration are both required. Your desktop's Ollama cannot be reached from a cloud development machine; verify the live connection locally.

## Development and tests

Node.js 20+ is recommended. There are no application dependencies or build commands:

```sh
npm test
node --check sidepanel.js
node --check ollama.js
node --check background.js
```

`core.js` contains templates and offline text helpers; `ollama.js` handles local model discovery and rewriting. Unit tests cover the core behavior and local AI client. Browser interaction tests in `tests/browser.cjs` use Playwright and Chromium installed separately, with simulated Chrome APIs and Ollama responses:

```sh
NODE_PATH=/path/to/node_modules node tests/browser.cjs
```

Set `CHROMIUM_PATH` if Chromium is elsewhere. These checks do not establish a real desktop Ollama connection or Chrome side-panel integration. The cloud machine's managed Chromium policy blocks installing unpacked extensions, so actual extension installation must be checked on your own computer.

Manual Chrome checks:

- Open from the toolbar; edit a message, minimise some sections, close/reopen the panel, and verify both the draft and section states are restored. Test section headers with Enter and Space as well as clicks.
- Try quick starts from each group; cancel and accept replacement confirmations. Insert a template with Your draft minimised and verify that it opens automatically.
- Generate each tone, check that Review suggestion opens and scrolls into view, then dismiss or apply a suggestion. Apply with Your draft minimised and verify that it opens. Try text with no matching offline rules.
- Copy a message and verify the exact “Kind regards,” / “Louis” closing and no subject line. Try an existing matching closing, a trailing “Kind regards,” and an empty draft.
- Toggle theme and reopen; clear the draft and verify preferences survive and a future copied message still receives the fixed closing. When updating from an older version, check that the message remains and the custom signature is no longer used.
- With Ollama disabled, verify no requests in the panel's DevTools Network tab.
- Enable Ollama, approve permission, discover models, and try a local model. Test a missing model, stopped server, cancellation and edits during a request. Disable it and verify offline behavior.

No backend, API keys, email permissions, external fonts or CDNs are required. The service worker configures toolbar-to-side-panel behavior. Suggestions are rendered as text, never HTML.
