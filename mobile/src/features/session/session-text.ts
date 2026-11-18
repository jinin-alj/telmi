import type { CheckerFeedback, StudySession } from '@/api/types';
import type { Texts } from '@/i18n/en';

type ResultTexts = Texts['results'];

/** "You explained 4 of 6 key ideas", counted from the gap map. */
export function summariseCoverage(feedback: CheckerFeedback, texts: ResultTexts): string {
  let coveredCount = 0;
  for (const keyIdea of feedback.key_ideas) {
    if (keyIdea.status === 'covered') {
      coveredCount += 1;
    }
  }
  return texts.coverage(coveredCount, feedback.key_ideas.length);
}

/** Whether Pip's greeting can still switch language: the session is open and unanswered. */
export function greetingCanChange(session: StudySession): boolean {
  if (session.status !== 'active') {
    return false;
  }
  for (const turn of session.turns) {
    if (turn.speaker === 'student') {
      return false;
    }
  }
  return true;
}

/** What Pip should say out loud for the current state of the session. */
export function lineToSpeak(session: StudySession, texts: ResultTexts): string {
  if (session.status === 'completed' && session.feedback !== null) {
    const summary = summariseCoverage(session.feedback, texts);
    return `${summary} ${texts.nextStepSpoken(session.feedback.next_step)}`;
  }
  let latestBuddyLine = '';
  for (const turn of session.turns) {
    if (turn.speaker === 'buddy') {
      latestBuddyLine = turn.text;
    }
  }
  return latestBuddyLine;
}
