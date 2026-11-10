// Mirrors the file types backend/app/services/material_files.py can read
export const MATERIAL_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  // Markdown has no single agreed type: phones use one of these, and browsers also match '.md'
  'text/markdown',
  'text/x-markdown',
  '.md',
];

export type UploadOutcome =
  | { fileName: string; read: true; truncated: boolean }
  | { fileName: string; read: false; error: string };

/** Add a file's text after what the teacher already has, with a blank line between them. */
export function appendMaterial(current: string, added: string): string {
  const existing = current.trimEnd();
  return existing === '' ? added : `${existing}\n\n${added}`;
}

/** One short message about what each upload did, or null when there's nothing to say. */
export function describeUploads(outcomes: UploadOutcome[]): string | null {
  const sentences: string[] = [];
  const readNames = outcomes.filter((outcome) => outcome.read).map((outcome) => outcome.fileName);
  if (readNames.length > 0) {
    sentences.push(
      `Added the text from ${readNames.join(', ')}. Check it and delete anything students shouldn't be checked on.`,
    );
  }
  for (const outcome of outcomes) {
    if (outcome.read && outcome.truncated) {
      sentences.push(`${outcome.fileName} is very long, so only its first part was added.`);
    }
  }
  return sentences.length === 0 ? null : sentences.join(' ');
}

/** The errors for files that couldn't be read, one per line, or null if all worked. */
export function describeUploadErrors(outcomes: UploadOutcome[]): string | null {
  const lines: string[] = [];
  for (const outcome of outcomes) {
    if (!outcome.read) {
      lines.push(`${outcome.fileName}: ${outcome.error}`);
    }
  }
  return lines.length === 0 ? null : lines.join('\n');
}
