export const templates = [
  { group: 'Everyday email', name: 'General follow-up', body: 'Hello [name],\n\nI am following up on [topic]. Have you had a chance to review this?\n\nPlease let me know if you need any further information from me.\n\nThank you.' },
  { group: 'Everyday email', name: 'Request information', body: 'Hello [name],\n\nCould you please share [information needed] to help with [reason]?\n\nIf possible, please send this by [date]. Let me know if that timing is difficult.\n\nThank you for your help.' },
  { group: 'Everyday email', name: 'Thank you', body: 'Hello [name],\n\nThank you for your help with [topic]. I appreciate the time and effort you put into this.\n\nPlease let me know if I can help with anything in return.' },
  { group: 'Everyday email', name: 'Acknowledge a message', body: 'Hello [name],\n\nThank you for your message about [topic]. I have received the information and will review it.\n\nI will follow up once I have more to share.' },
  { group: 'Everyday email', name: 'Polite reminder', body: 'Hello [name],\n\nA quick reminder about [action or item], which is due on [date].\n\nCould you let me know how this is progressing? If anything is preventing you from completing it, please let me know so we can discuss the next steps.\n\nThank you.' },
  { group: 'Everyday email', name: 'Apology and next steps', body: 'Hello [name],\n\nI am sorry for [issue or delay] and the inconvenience this has caused.\n\nThe next step is [action]. I will provide an update by [date or time].\n\nThank you for your patience.' },
  { group: 'Working together', name: 'Arrange a meeting', body: 'Hello [name],\n\nCould we arrange a meeting to discuss [topic]? It would be helpful to cover [key points].\n\nWould [date and time, including time zone] work for you? If not, please suggest a suitable alternative.\n\nThank you.' },
  { group: 'Working together', name: 'Meeting recap', body: 'Hello everyone,\n\nThank you for your time today. Here is a summary of our discussion about [topic].\n\nKey points:\n- [Discussion point]\n\nAgreed actions:\n- [Action, owner and due date]\n\nPlease let me know if I have missed anything or if any corrections are needed.' },
  { group: 'Working together', name: 'Handover', body: 'Hello [name],\n\nI am handing over [task or responsibility].\n\nCurrent position: [summary]\nNext steps: [actions and dates]\nUseful context: [relevant information or document location]\n\nPlease confirm that you have what you need, and let me know if anything is unclear.' },
  { group: 'Working together', name: 'Request approval', body: 'Hello [name],\n\nCould you please review and approve [proposal or action]?\n\nReason: [brief explanation]\nDetails to consider: [scope, cost or impact]\nDecision needed by: [date]\n\nPlease let me know if you would like any further information before deciding.' },
  { group: 'Working together', name: 'General progress update', body: 'Hello [name],\n\nHere is an update on [activity or project].\n\nCompleted: [progress so far]\nIn progress: [current work]\nNext steps: [planned actions]\nItems needing input: [questions or decisions, if any]\n\nPlease let me know if you have any questions.' },
  { group: 'Working together', name: 'Introduction', body: 'Hello [name],\n\nMy name is [your name], and I work on [role or area]. I am getting in touch about [reason].\n\nIt would be helpful to [proposed next step]. Please let me know what works best for you.\n\nI look forward to working with you.' },
  { group: 'IT support', name: 'First response', body: 'Hello,\n\nThank you for contacting IT support. I have received your request and will investigate.\n\nCould you share the error message, when the issue started, and any troubleshooting steps you have already tried? Please do not send passwords or security codes.\n\nI will update you when I have more information.' },
  { group: 'IT support', name: 'Request more details', body: 'Hello,\n\nTo help investigate, could you confirm the affected device or application and the steps that reproduce the issue?\n\nIf you share a screenshot, please remove any sensitive information first.\n\nThank you for your help.' },
  { group: 'IT support', name: 'Troubleshooting', body: 'Hello,\n\nPlease try the following when convenient:\n\n1. Save your work and restart the affected application.\n2. Check your network connection.\n3. Try again and note any error message.\n\nPlease let me know the result so we can plan the next step.' },
  { group: 'IT support', name: 'Progress update', body: 'Hello,\n\nI am still investigating your request. I understand the disruption this may be causing.\n\nI will share another update as soon as I have more information. Thank you for your patience.' },
  { group: 'IT support', name: 'Resolution check', body: 'Hello,\n\nThe reported issue should now be resolved. Could you try again and confirm that everything is working as expected?\n\nIf the issue continues, please reply with any new error message and I will investigate further.' },
  { group: 'IT support', name: 'Close a request', body: 'Hello,\n\nThank you for confirming that the issue is resolved. I will close this request.\n\nIf you need further assistance, please contact IT support with the relevant details.' }
];
const toneRules = {
  professional: [[/\bASAP\b/gi, 'as soon as possible'], [/\bjust checking\b/gi, 'following up'], [/\bhey\b/gi, 'Hello'], [/\bget back to you\b/gi, 'follow up with you']],
  friendly: [[/\bDear user\b/gi, 'Hello'], [/\bPlease be advised that\s*/gi, ''], [/\bdo not hesitate to contact\b/gi, 'feel free to contact']],
  concise: [[/\bin order to\b/gi, 'to'], [/\bat this point in time\b/gi, 'now'], [/\bplease be advised that\s*/gi, ''], [/\bdue to the fact that\b/gi, 'because'], [/\bin the event that\b/gi, 'if'], [/\bwith regard to\b/gi, 'about']],
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
export function compose(body) {
  const message = body.trim();
  if (!message) return '';
  const signoff = 'Kind regards,\nLouis';
  // Normalise an existing closing without duplicating it or changing other names.
  const content = message.replace(/(?:^|\r?\n)[\t ]*kind regards,[\t ]*(?:\r?\n[\t ]*louis)?$/i, '').trimEnd();
  return [content, signoff].filter(Boolean).join('\n\n');
}
export function validateModel(model) {
  return typeof model === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/.test(model) && !/(?:^|[-:])cloud(?:$|[-:])/i.test(model);
}
