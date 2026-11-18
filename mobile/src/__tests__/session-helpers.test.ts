import type { StudySession, UnitProgress } from '@/api/types';
import { mascotSize } from '@/components/mascot';
import { minutesLeft } from '@/features/session/session-time';
import { lineToSpeak, summariseCoverage } from '@/features/session/session-text';
import { describeLastAttempt } from '@/features/student/unit-row';
import { en } from '@/i18n/en';
import { es } from '@/i18n/es';
import { speechLanguageFor } from '@/speech/languages';
import { appendPhrase, joinTranscript } from '@/speech/transcript';
import { describeSpeechError } from '@/speech/use-speech-to-text';

// Jest hoists these above the imports, so the native speech modules are never loaded

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {},
  useSpeechRecognitionEvent: jest.fn(),
}));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

const FEEDBACK = {
  key_ideas: [
    { idea: 'Happens in chloroplasts', status: 'covered' as const },
    { idea: 'Releases oxygen', status: 'missing' as const },
    { idea: 'Makes glucose', status: 'covered' as const },
  ],
  misconceptions: [],
  application_question: 'Why do plants in the dark stop growing?',
  next_step: 'Explain where the oxygen goes.',
};

function buildSession(overrides: Partial<StudySession>): StudySession {
  return {
    id: 'session-1',
    unit_id: 'unit-1',
    unit_title: 'Photosynthesis',
    status: 'active',
    started_at: '2026-10-28T10:00:00Z',
    ends_at: '2026-10-28T10:15:00Z',
    completed_at: null,
    student_turns_left: 8,
    turns: [],
    coverage_percent: null,
    feedback: null,
    application_answer: null,
    application_result: null,
    ...overrides,
  };
}

describe('transcript', () => {
  it('joins finished phrases with single spaces', () => {
    expect(appendPhrase(appendPhrase('', ' Plants make food '), 'in chloroplasts')).toBe(
      'Plants make food in chloroplasts',
    );
  });

  it('ignores empty phrases', () => {
    expect(appendPhrase('Plants make food', '   ')).toBe('Plants make food');
  });

  it('shows the phrase still being recognised after the finished ones', () => {
    expect(joinTranscript('Plants make food', 'using light')).toBe('Plants make food using light');
  });
});

describe('speechLanguageFor', () => {
  it('listens in the language the app is shown in', () => {
    expect(speechLanguageFor('es')).toBe('es-ES');
    expect(speechLanguageFor('en')).toBe('en-US');
  });
});

describe('describeSpeechError', () => {
  it('stays quiet when the student stops listening on purpose', () => {
    expect(describeSpeechError('aborted', en.speechErrors)).toBeNull();
  });

  it('points to typing when the microphone is blocked', () => {
    expect(describeSpeechError('not-allowed', en.speechErrors)).toContain('type instead');
  });

  it('speaks Spanish when the app is in Spanish', () => {
    expect(describeSpeechError('no-speech', es.speechErrors)).toBe(es.speechErrors.noSpeech);
  });
});

describe('minutesLeft', () => {
  const endsAt = '2026-10-28T10:15:00Z';

  it('rounds up partial minutes', () => {
    expect(minutesLeft(endsAt, Date.parse('2026-10-28T10:10:30Z'))).toBe(5);
  });

  it('never goes below zero', () => {
    expect(minutesLeft(endsAt, Date.parse('2026-10-28T11:00:00Z'))).toBe(0);
  });
});

describe('session text', () => {
  it('counts explained ideas', () => {
    expect(summariseCoverage(FEEDBACK, en.results)).toBe('You explained 2 of 3 key ideas.');
    expect(summariseCoverage(FEEDBACK, es.results)).toBe('Has explicado 2 de 3 ideas clave.');
  });

  it("speaks Pip's latest line during a session", () => {
    const session = buildSession({
      turns: [
        { position: 0, speaker: 'buddy', text: 'Hi!' },
        { position: 1, speaker: 'student', text: 'Plants make food.' },
        { position: 2, speaker: 'buddy', text: 'How?' },
      ],
    });
    expect(lineToSpeak(session, en.results)).toBe('How?');
  });

  it('speaks the summary and next step once checked', () => {
    const session = buildSession({ status: 'completed', feedback: FEEDBACK });
    expect(lineToSpeak(session, en.results)).toBe(
      'You explained 2 of 3 key ideas. Your next step: Explain where the oxygen goes.',
    );
  });
});

describe('describeLastAttempt', () => {
  const unit: UnitProgress = {
    unit_id: 'unit-1',
    title: 'Photosynthesis',
    sessions_completed: 0,
    latest_coverage_percent: null,
    best_coverage_percent: null,
    ideas_understood: 0,
    total_ideas: null,
    still_missing: [],
    next_step: null,
  };

  it('says when a unit has not been tried', () => {
    expect(describeLastAttempt(unit, en.unitRow)).toBe('Not explained yet');
  });

  it('describes last time in ideas, not a score', () => {
    const tried = { ...unit, sessions_completed: 2, total_ideas: 6, still_missing: ['a', 'b'] };
    expect(describeLastAttempt(tried, en.unitRow)).toBe('Last time: 4 of 6 key ideas');
    expect(describeLastAttempt(tried, es.unitRow)).toBe('La última vez: 4 de 6 ideas clave');
  });
});

describe('mascotSize', () => {
  it('grows with level but stays on screen', () => {
    expect(mascotSize(1)).toBeLessThan(mascotSize(2));
    expect(mascotSize(50)).toBe(140);
  });
});
