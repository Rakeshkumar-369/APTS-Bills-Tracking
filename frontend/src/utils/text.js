// src/utils/text.js
// The API HTML-escapes free-text input on the way in (defence in depth against
// XSS). React already escapes everything it renders, so decode those entities
// for display — otherwise users see "Don&#x27;t" instead of "Don't".
const ENTITY_MAP = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#x27;': "'", '&#39;': "'", '&#x2F;': '/', '&#x5C;': '\\', '&#96;': '`',
};

export function decodeEntities(value) {
  if (value === null || value === undefined) return value;
  return String(value).replace(/&(?:amp|lt|gt|quot|#x27|#39|#x2F|#x5C|#96);/g, (m) => ENTITY_MAP[m]);
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return withTime
    ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatINR(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`;
}
