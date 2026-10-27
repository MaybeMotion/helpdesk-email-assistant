export const templates = [
  { name: 'First response', subject: 'Your support request', body: 'Hello,\n\nThank you for contacting IT support. I have received your request and will investigate.\n\nCould you share the error message, when the issue started, and any troubleshooting steps you have already tried? Please do not send passwords or security codes.\n\nI will update you when I have more information.' },
  { name: 'Request more details', subject: 'More information needed', body: 'Hello,\n\nTo help investigate, could you confirm the affected device or application and the steps that reproduce the issue?\n\nIf you share a screenshot, please remove any sensitive information first.\n\nThank you for your help.' },
  { name: 'Troubleshooting', subject: 'Troubleshooting steps', body: 'Hello,\n\nPlease try the following when convenient:\n\n1. Save your work and restart the affected application.\n2. Check your network connection.\n3. Try again and note any error message.\n\nPlease let me know the result so we can plan the next step.' },
  { name: 'Progress update', subject: 'Update on your support request', body: 'Hello,\n\nI am still investigating your request. I understand the disruption this may be causing.\n\nI will share another update as soon as I have more information. Thank you for your patience.' },
  { name: 'Resolution check', subject: 'Checking your issue is resolved', body: 'Hello,\n\nThe reported issue should now be resolved. Could you try again and confirm that everything is working as expected?\n\nIf the issue continues, please reply with any new error message and I will investigate further.' },
  { name: 'Close a request', subject: 'Your support request is resolved', body: 'Hello,\n\nThank you for confirming that the issue is resolved. I will close this request.\n\nIf you need further assistance, please contact IT support with the relevant details.' }
];
const toneRules = {
  professional: [[/\bASAP\b/gi, 'as soon as possible'], [/\bjust checking\b/gi, 'following up'], [/\bhey\b/gi, 'Hello']],
  friendly: [[/\bDear user\b/gi, 'Hello'], [/\bPlease be advised that\s*/gi, ''], [/\bdo not hesitate to contact\b/gi, 'feel free to contact']],
  concise: [[/\bin order to\b/gi, 'to'], [/\bat this point in time\b/gi, 'now'], [/\bplease be advised that\s*/gi, ''], [/\bdue to the fact that\b/gi, 'because']],
  formal: [[/\bhey\b/gi, 'Hello'], [/\bcan't\b/gi, 'cannot'], [/\bwon't\b/gi, 'will not'], [/\bthanks\b/gi, 'Thank you'], [/\bASAP\b/gi, 'as soon as possible']]
};
export function improve(text, tone) {
  let result = text.replace(/[\t ]+$/gm, '').replace(/([^\S\n]){2,}/g, ' ').replace(/\n{4,}/g, '\n\n\n').trim();
  const changes = [];
  if (result !== text) changes.push('Removed extra whitespace');
  for (const [pattern, replacement] of toneRules[tone] || toneRules.professional) {
    const next = result.replace(pattern, replacement);
    if (next !== result) changes.push(`Replaced wording with “${replacement || '(removed introductory phrase)'}”`);
    result = next;
  }
  return { text: result, changes };
}
export function compose(subject, body, signature) {
  return [subject.trim() ? `Subject: ${subject.trim()}` : '', body.trim(), signature.trim()].filter(Boolean).join('\n\n');
}
export function validateModel(model) {
  return typeof model === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/.test(model);
}
