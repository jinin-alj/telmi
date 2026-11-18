import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/** Every TypeScript source file under a folder, except the tests themselves. */
export function appSourceFiles(folder: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      if (name !== '__tests__') {
        files.push(...appSourceFiles(path));
      }
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      files.push(path);
    }
  }
  return files;
}
