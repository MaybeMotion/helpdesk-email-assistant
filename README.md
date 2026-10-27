# Helpdesk Email Assistant

A private Chrome side panel for everyday and IT support emails. Vanilla JavaScript, HTML and CSS; Manifest V3; no build step, trackers, inbox access or automatic sending. Version 1.3 connects to the local Ollama app automatically, using the same Qwen 2.5 3B model as Rephrase. Purple themes, collapsible sections, 18 quick starts and the fixed closing remain available.

## Install or update in Chrome

1. Download this repository (Code → Download ZIP) and extract it, or clone it.
2. Open `chrome://extensions` in Chrome 116 or newer (current Chrome recommended).
3. Enable **Developer mode**, click **Load unpacked**, and choose the folder containing `manifest.json`.
4. Accept Chrome's required access to `127.0.0.1`, your computer's loopback address. Pin Helpdesk Email Assistant from the Extensions menu, then click its toolbar icon to open the side panel.

To update, replace the files in the **same folder** you originally loaded, keeping the path unchanged. Click **Reload** on the extension card, accept any new local-host permission prompt, then close and reopen the side panel. Keep the existing extension installed to retain its ID and local draft; removing and reinstalling it deletes local storage and may change its ID. If Chrome asks for local-network access, allow it for local Ollama. If the extension ID changes, update Ollama's allowed origin too.

Chrome's host permission pattern is `http://127.0.0.1/*`; extension code and its content security policy limit actual requests to port **11434**. No website or email-host access is requested.

## Automatic local Ollama

Like [Rephrase](https://github.com/MaybeMotion/My-Chrome-Extension), this extension uses **`http://127.0.0.1:11434`** and **Qwen 2.5 3B (`qwen2.5:3b`)** internally. There is no address, model or API-key field to configure. If that model already works in Rephrase, Helpdesk reuses the same local installation; you do not need another download.

On each panel opening, automatic mode checks Ollama's installed models through `/api/tags`, without sending your draft. The panel shows checking, ready or unavailable feedback. Clicking **Improve wording** sends the message and tone only when the local connection is ready. If it is unavailable, Improve retries the connection and explains the problem; it does not silently use offline rules or change your message.

Automatic connection is enabled by default. This also replaces the older `Use local Ollama` opt-in setting on upgrade. To use offline rules instead, open **Local AI settings** and uncheck **Connect to local Ollama automatically**. That new explicit opt-out is saved locally, cancels pending connection work, and prevents further requests, including on future panel openings. A request already started before opting out may already have reached Ollama.

### One-time desktop requirements

The extension can detect and use a running app, but Chrome cannot install models, start Ollama, or change your computer's environment settings. If you have not already prepared Ollama:

1. Install/update Ollama on the **same computer as Chrome** and keep its app running with its default loopback binding.
2. Download the model once while online:

   ```sh
   ollama pull qwen2.5:3b
   ```

   Skip this if `ollama list` already contains `qwen2.5:3b`. Once installed, local inference can work without Internet access. No model is downloaded by the extension.
3. Open **Local AI settings → Connection help & one-time setup**. If Ollama blocks this extension, allow its exact origin in `OLLAMA_ORIGINS`. A working Rephrase origin does not automatically grant access to Helpdesk's different extension ID. Preserve all origins that already work; do not replace them with a wildcard.
4. Keep Ollama local-only by setting **`OLLAMA_NO_CLOUD=1`** in the Ollama server environment. Client-side filtering excludes model entries marked as remote, but cannot guarantee the configuration of a separate server.
5. Fully quit and reopen Ollama after changing its environment. Reopen the extension panel or click **Check local connection**. The panel selects the fixed model automatically when it is available.

**Mac:** click **Copy Mac setup command** and paste the displayed command into Terminal. It includes your actual installed extension ID, appends Helpdesk to the existing `launchctl` origins instead of replacing Rephrase's, and sets `OLLAMA_NO_CLOUD=1`. Then fully quit Ollama from its menu-bar icon and open it again. The extension only displays and copies this command; it never executes shell commands.

The command has this form, with your real ID filled in by the extension:

```sh
helpdesk_origins="$(launchctl getenv OLLAMA_ORIGINS)"
launchctl setenv OLLAMA_ORIGINS "${helpdesk_origins:+$helpdesk_origins,}chrome-extension://YOUR_HELPDESK_EXTENSION_ID"
launchctl setenv OLLAMA_NO_CLOUD 1
```

This preserves origins previously configured through `launchctl`. If you configured Rephrase through a different source, add its existing origin to the same comma-separated list as well.

**Windows:** quit Ollama. In user environment variables, append `chrome-extension://YOUR_HELPDESK_EXTENSION_ID` to the existing `OLLAMA_ORIGINS` value, separated by a comma, retaining Rephrase and other allowed origins. Set `OLLAMA_NO_CLOUD` to `1`, then reopen Ollama. The exact Helpdesk origin is displayed in its connection help.

**Linux or a terminal-run server:** preserve the existing origin list when launching a stopped Ollama server:

```sh
OLLAMA_ORIGINS="${OLLAMA_ORIGINS:+$OLLAMA_ORIGINS,}chrome-extension://YOUR_HELPDESK_EXTENSION_ID" OLLAMA_NO_CLOUD=1 ollama serve
```

Replace the placeholder with the displayed ID. A shell variable does not change an already-running service. For a systemd installation, use `sudo systemctl edit ollama` to set `OLLAMA_ORIGINS` to the complete comma-separated list including existing Rephrase origins and Helpdesk's origin, plus `OLLAMA_NO_CLOUD=1` under `[Service]`. Then run `sudo systemctl daemon-reload` and `sudo systemctl restart ollama`. Do not expect shell variable expansion inside a systemd `Environment=` line.

### Connection troubleshooting and privacy

- Open Ollama and keep it running. A stopped server, blocked origin (HTTP 403), missing model (HTTP 404), timeout or invalid response produces visible feedback. **Check local connection** sends no draft text.
- For a missing model, run `ollama pull qwen2.5:3b`. Another installed model does not replace the fixed Qwen model automatically.
- If access is blocked, check Chrome's loopback/local-network permission and the exact Helpdesk origin in Ollama. Fully restart Ollama after environment changes.
- Rewrites time out after two minutes. You can cancel them; edits cancel pending suggestions. Review model output because it can invent details.

The extension contacts only `127.0.0.1:11434`, never a cloud AI endpoint, and rejects redirects. Persistent extension data stays in `chrome.storage.local`. Ollama is a separate process: its memory, logs and retention depend on your installation. Use offline rules if draft data must stay exclusively inside Chrome storage even during processing. Your desktop's Ollama cannot be reached from a cloud development machine; verify the live connection locally.

## Write a message

Click a section header to minimise or expand **Quick start**, **Your draft**, **Review suggestion** or **Local AI settings**. The headers also work with the keyboard: focus one with Tab, then press Enter or Space. Each section's open or closed state is remembered locally.

Choose a quick start or write your message, then select Professional, Friendly, Concise or Formal and click **Improve wording**. Feedback appears next to the button, and completed suggestions scroll into view for review. Edit the suggestion if needed, then choose Apply or Dismiss. Your original draft is never replaced automatically. Inserting a template or applying a suggestion opens Your draft automatically. Generating a suggestion opens Review suggestion so the result is easy to find.

There are **18 quick starts**, grouped into **Everyday email**, **Working together** and **IT support**. Replace `[placeholders]` and verify details before use. Inserting a template asks before replacing an existing message.

Click **Copy message** to copy a nonempty message with this fixed closing:

```text
Kind regards,
Louis
```

There is no Personal touch box, custom signature or subject field. An existing matching closing is not duplicated; a draft ending in “Kind regards,” gains the name. An empty draft copies nothing. Paste into an existing Zoho conversation or another email editor, review the result, and send it yourself. The closing is added when copying, not submitted separately to Ollama.

The draft, automatic-connection preference, section states and theme save in **Chrome local storage**, not Chrome Sync. Updating removes obsolete saved model, subject, custom-signature and old Ollama opt-in settings while retaining the message and current preferences. Clear draft removes the message while retaining preferences. One draft is saved per Chrome profile; simultaneous panels use the latest saved state. Explicit copying puts text on your system clipboard, outside extension storage.

## Offline wording rules

Uncheck **Connect to local Ollama automatically** to use offline rules with no network requests. Improvements then use phrase substitutions and whitespace cleanup, not AI. For example, Professional replaces “ASAP” with “as soon as possible”, Concise replaces “in order to” with “to”, and Formal replaces “can't” with “cannot”. The review panel reports changes or explains when no rule changed the wording.

These limited wording aids do not provide full grammar checking, technical verification or semantic rewriting. The panel identifies which mode produced each suggestion; a connection failure never silently changes modes.

## Development and tests

Node.js 20+ is recommended. There are no application dependencies or build commands:

```sh
npm test
node --check sidepanel.js
node --check ollama.js
node --check setup.js
node --check background.js
```

`core.js` contains templates and offline text helpers; `ollama.js` handles local model checks and rewriting; `setup.js` produces display-only Mac setup guidance. Unit tests include generated-command behavior using a simulated `launchctl`, without changing system settings. Browser interaction tests in `tests/browser.cjs` use Playwright and Chromium installed separately, with simulated Chrome APIs and Ollama responses:

```sh
NODE_PATH=/path/to/node_modules node tests/browser.cjs
```

Set `CHROMIUM_PATH` if Chromium is elsewhere. These checks do not establish a real desktop Ollama connection or Chrome side-panel integration. The cloud machine's managed Chromium policy blocks installing unpacked extensions, so actual installation and live local inference must be checked on your computer.

Manual Chrome checks:

- Open from the toolbar with Ollama running. Verify automatic checking becomes ready with `qwen2.5:3b`, without entering connection settings. Model checks must contain no draft text.
- Stop Ollama or use an installation without Qwen; verify visible unavailable feedback and no draft submission. Clicking Improve should retry without silently switching to rules.
- Turn automatic connection off and reopen the panel; verify offline mode persists and makes no requests. Re-enable it and verify a connection check occurs.
- Copy the generated Mac setup command and verify it contains the installed Helpdesk ID and preserves an existing Rephrase origin when you choose to run it. Fully restart Ollama afterward.
- Edit a message, minimise sections, reopen the panel, and verify both draft and section states are restored. Test headings with Enter and Space.
- Insert a template with Your draft minimised and verify it opens. Generate and apply a suggestion, checking the review and draft sections open appropriately.
- Copy and verify the exact “Kind regards,” / “Louis” closing, no subject, and no duplicate matching closing. An empty draft must copy nothing.
- Toggle theme and reopen; clear the draft and verify preferences survive. Test cancelling a rewrite and editing during a request.

No backend, API keys, email permissions, external fonts or CDNs are required. The service worker configures toolbar-to-side-panel behavior. Suggestions are rendered as text, never HTML.
