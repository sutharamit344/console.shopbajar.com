/**
 * Generates a URL-friendly slug from a string.
 */
export function slugify(text: string | null | undefined): string {
  if (text === null || text === undefined) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')     // Replace & with and
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, '')  // Remove all non-word chars except Unicode letters/marks/numbers
    .replace(/--+/g, '-')     // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start of text
    .replace(/-+$/, '');      // Trim - from end of text
}
