/** Huruf pertama setiap kalimat jadi kapital. Sisa teks tidak diubah. */
export function sentenceCase(value) {
  const text = String(value ?? '');
  if (!text.trim()) return text;
  return text.replace(/(^|[\n.!?]\s*)(\p{Ll})/gu, (all, lead, letter) => lead + letter.toLocaleUpperCase('id'));
}
