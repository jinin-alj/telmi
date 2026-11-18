import type { PipMouth } from '@/components/pip';

/** How many letters a word has, ignoring punctuation; accented letters count. */
function letterCount(word: string): number {
  return word.replace(/[^A-Za-zÀ-ÿ]/g, '').length;
}

/** Long words open the mouth wide, short ones only a little. */
export function mouthForWord(word: string): PipMouth {
  return letterCount(word) > 4 ? 'wide' : 'small';
}

/** How long the mouth stays open for a word before closing, in milliseconds. */
export function mouthOpenTime(word: string): number {
  return Math.min(80 + letterCount(word) * 38, 300);
}

/** The time from one word to the next when Pip talks without a voice, in milliseconds. */
export function wordGap(word: string): number {
  return 170 + word.length * 38;
}
