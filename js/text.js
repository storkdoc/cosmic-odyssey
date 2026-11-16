/* Player-written names and notes are untrusted. Escape for HTML, and run a
   small profanity filter before anything is saved or sent. */

const BAD = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'piss',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'slut', 'whore', 'rape',
  'rapist', 'nazi'
];

const BAD_RE = new RegExp('\\b(?:' + BAD.join('|') + ')\\b', 'gi');

export function cleanText(value, max) {
  let s = String(value == null ? '' : value);
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(BAD_RE, '····');
  if (max && s.length > max) s = s.slice(0, max).trim();
  return s;
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
