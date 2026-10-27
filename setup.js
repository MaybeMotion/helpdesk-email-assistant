// Display-only guidance: the extension never executes shell commands.
export function macSetupCommand(extensionId) {
  if (typeof extensionId !== 'string' || extensionId.length !== 32 || !/^[a-p]{32}$/.test(extensionId)) return '';
  return [
    'helpdesk_origins="$(launchctl getenv OLLAMA_ORIGINS)"',
    `launchctl setenv OLLAMA_ORIGINS "\${helpdesk_origins:+$helpdesk_origins,}chrome-extension://${extensionId}"`,
    'launchctl setenv OLLAMA_NO_CLOUD 1'
  ].join('\n');
}
