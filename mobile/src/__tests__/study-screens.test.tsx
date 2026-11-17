import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import * as studyApi from '@/api/study';
import type { StudentProgress, StudySession } from '@/api/types';
import { ActiveSession } from '@/features/session/active-session';
import { StudentHome } from '@/features/student/student-home';

jest.mock('@/api/study');
jest.mock('@/speech/use-speech-to-text', () => ({
  useSpeechToText: () => ({
    isAvailable: false,
    isListening: false,
    transcript: '',
    errorMessage: null,
    startListening: jest.fn(),
    stopListening: jest.fn(),
    clearTranscript: jest.fn(),
  }),
}));
jest.mock('expo-router', () => {
  // Run focus effects straight away, since there is no navigator in these tests
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

const mockedApi = jest.mocked(studyApi);

const ACTIVE_SESSION: StudySession = {
  id: 'session-1',
  unit_id: 'unit-1',
  unit_title: 'Photosynthesis',
  status: 'active',
  started_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 15 * 60000).toISOString(),
  completed_at: null,
  student_turns_left: 8,
  turns: [{ position: 0, speaker: 'buddy', text: 'Hi! Can you explain it to me?' }],
  coverage_percent: null,
  feedback: null,
  application_answer: null,
  application_result: null,
};

const PROGRESS: StudentProgress = {
  mascot: { level: 1, understood_ideas: 2, ideas_to_next_level: 3 },
  classrooms: [
    {
      classroom: { id: 'class-1', name: 'Biology 3A', subject: 'Biology', join_code: 'FTB63U' },
      units: [
        {
          unit_id: 'unit-1',
          title: 'Photosynthesis',
          sessions_completed: 0,
          latest_coverage_percent: null,
          best_coverage_percent: null,
          ideas_understood: 0,
          total_ideas: null,
          still_missing: [],
          next_step: null,
        },
      ],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ActiveSession', () => {
  it("shows Pip's line and blocks finishing before the student has spoken", async () => {
    await render(
      <ActiveSession session={ACTIVE_SESSION} language="en-US" onSessionChange={jest.fn()} />,
    );

    expect(screen.getByText('Hi! Can you explain it to me?')).toBeTruthy();
    expect(screen.getByText('8 turns left · 15 min left')).toBeTruthy();
    expect(screen.getByRole('button', { name: "I'm done, check my explanation" })).toBeDisabled();
  });

  it('sends a typed turn and passes the updated session up', async () => {
    const updated = { ...ACTIVE_SESSION, student_turns_left: 7 };
    mockedApi.sendTurn.mockResolvedValue(updated);
    const onSessionChange = jest.fn();
    await render(
      <ActiveSession session={ACTIVE_SESSION} language="en-US" onSessionChange={onSessionChange} />,
    );

    await fireEvent.changeText(
      screen.getByLabelText('Type your explanation from memory'),
      'Plants make food.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send to Pip' }));

    await waitFor(() => expect(onSessionChange).toHaveBeenCalledWith(updated));
    expect(mockedApi.sendTurn).toHaveBeenCalledWith('session-1', 'Plants make food.');
  });

  it('hides the microphone when no turns are left and lets the student finish', async () => {
    const lastTurn = {
      ...ACTIVE_SESSION,
      student_turns_left: 0,
      turns: [...ACTIVE_SESSION.turns, { position: 1, speaker: 'student' as const, text: 'Hi' }],
    };
    mockedApi.finishSession.mockResolvedValue({ ...lastTurn, status: 'completed' });
    const onSessionChange = jest.fn();
    await render(
      <ActiveSession session={lastTurn} language="en-US" onSessionChange={onSessionChange} />,
    );

    expect(screen.queryByRole('button', { name: 'Send to Pip' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: "I'm done, check my explanation" }));

    await waitFor(() => expect(onSessionChange).toHaveBeenCalled());
    expect(mockedApi.finishSession).toHaveBeenCalledWith('session-1');
  });
});

describe('ActiveSession safety', () => {
  const explained = {
    ...ACTIVE_SESSION,
    turns: [...ACTIVE_SESSION.turns, { position: 1, speaker: 'student' as const, text: 'Hi' }],
  };

  it('ignores Finish while a turn is still sending', async () => {
    // The student taps Finish while Pip is still answering
    mockedApi.sendTurn.mockImplementation(async () => {
      await fireEvent.press(screen.getByRole('button', { name: "I'm done, check my explanation" }));
      return explained;
    });
    await render(
      <ActiveSession session={explained} language="en-US" onSessionChange={jest.fn()} />,
    );

    await fireEvent.changeText(
      screen.getByLabelText('Type your explanation from memory'),
      'Plants make food.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send to Pip' }));

    expect(mockedApi.finishSession).not.toHaveBeenCalled();
  });

  it("says when time ran out that anything unsent wasn't saved", async () => {
    const timedOut = { ...explained, ends_at: new Date(Date.now() - 60000).toISOString() };
    await render(<ActiveSession session={timedOut} language="en-US" onSessionChange={jest.fn()} />);

    expect(screen.getByText(/Time's up/)).toBeTruthy();
    expect(screen.getByText(/wasn't saved/)).toBeTruthy();
  });
});

describe('StudentHome', () => {
  const student = {
    id: 'user-1',
    username: 'ana_g',
    display_name: 'Ana',
    role: 'student' as const,
  };

  it('shows Pip, classes and units', async () => {
    mockedApi.getMyProgress.mockResolvedValue(PROGRESS);
    await render(<StudentHome user={student} onSignOut={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Biology 3A')).toBeTruthy());
    expect(screen.getByText('Pip · level 1')).toBeTruthy();
    expect(screen.getByText('Not explained yet')).toBeTruthy();
  });

  it('starts a session and opens it', async () => {
    mockedApi.getMyProgress.mockResolvedValue(PROGRESS);
    mockedApi.startSession.mockResolvedValue(ACTIVE_SESSION);
    await render(<StudentHome user={student} onSignOut={jest.fn()} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Explain Photosynthesis' }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/session/[sessionId]',
        params: { sessionId: 'session-1' },
      }),
    );
  });

  it('starts only one session when two units are tapped quickly', async () => {
    const secondUnit = {
      ...PROGRESS.classrooms[0].units[0],
      unit_id: 'unit-2',
      title: 'Respiration',
    };
    const twoUnits = {
      ...PROGRESS,
      classrooms: [
        { ...PROGRESS.classrooms[0], units: [...PROGRESS.classrooms[0].units, secondUnit] },
      ],
    };
    mockedApi.getMyProgress.mockResolvedValue(twoUnits);
    let starts = 0;
    // The student taps a second unit while the first is still starting
    mockedApi.startSession.mockImplementation(async () => {
      starts += 1;
      if (starts === 1) {
        await fireEvent.press(screen.getByRole('button', { name: 'Explain Respiration' }));
      }
      return ACTIVE_SESSION;
    });
    await render(<StudentHome user={student} onSignOut={jest.fn()} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Explain Photosynthesis' }));

    expect(mockedApi.startSession).toHaveBeenCalledTimes(1);
  });

  it('asks for a join code when the student has no classes', async () => {
    mockedApi.getMyProgress.mockResolvedValue({ ...PROGRESS, classrooms: [] });
    await render(<StudentHome user={student} onSignOut={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(/Ask your teacher for a join code/)).toBeTruthy());
  });
});
