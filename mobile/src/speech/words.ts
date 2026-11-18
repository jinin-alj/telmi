/** The word that starts at a character position in the text. */
export function wordAt(text: string, charIndex: number): string {
  return text.slice(charIndex).trimStart().split(/\s+/)[0];
}
