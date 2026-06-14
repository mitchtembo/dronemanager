const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const MULTILINE_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const cleanText = (value, { max = 255, collapseWhitespace = true } = {}) => {
  let text = String(value ?? '').replace(CONTROL_CHARS, '').trim();
  if (collapseWhitespace) text = text.replace(/\s+/g, ' ');
  return text.slice(0, max);
};

export const cleanMultilineText = (value, { max = 2000 } = {}) => (
  String(value ?? '')
    .replace(MULTILINE_CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max)
);

export const cleanEmail = (value) => cleanText(value, { max: 254 }).toLowerCase();

export const nullableText = (value, options) => {
  const text = cleanText(value, options);
  return text || null;
};

export const nullableMultilineText = (value, options) => {
  const text = cleanMultilineText(value, options);
  return text || null;
};

export const cleanEnum = (value, allowed, fallback) => (
  allowed.includes(value) ? value : fallback
);

export const finiteNumber = (value, fallback = null) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
