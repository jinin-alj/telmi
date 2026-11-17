import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import * as teachingApi from '@/api/teaching';
import type { StudentSummary, UnitSummary } from '@/api/types';
import { AddUnitForm } from '@/features/teacher/add-unit-form';
import { describeStudentResult, StudentSummaryRow } from '@/features/teacher/student-summary-row';
import { TeacherHome } from '@/features/teacher/teacher-home';
import { describeUnitReach, UnitSummaryCard } from '@/features/teacher/unit-summary-card';
import { validateClassName, validateMaterial } from '@/features/teacher/validation';

jest.mock('@/api/teaching');
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => {
  // Run focus effects straight away, since there is no navigator in these tests
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

const mockedApi = jest.mocked(teachingApi);
const mockedPicker = jest.mocked(DocumentPicker);

/** What the picker returns when the teacher chooses these files. */
function pickedFiles(...names: string[]): DocumentPicker.DocumentPickerResult {
  return {
    canceled: false,
    assets: names.map((name) => ({ name, uri: `file:///${name}`, lastModified: 0 })),
  };
}
const teacher = {
  id: 'teacher-1',
  username: 'ms_lopez',
  display_name: 'Ms Lopez',
  role: 'teacher' as const,
};
const CLASSROOM = { id: 'class-1', name: 'Biology 4B', subject: 'Biology', join_code: '3JTB74' };
const GOOD_MATERIAL =
  'Cellular respiration releases energy from glucose in the mitochondria of cells.';

const UNIT: UnitSummary = {
  unit_id: 'unit-1',
  title: 'Cell respiration',
  students_attempted: 2,
  average_coverage_percent: 42,
  ideas: [
    {
      idea_number: 1,
      idea: 'It happens in the mitochondria.',
      students_covered: 2,
      students_missing: 0,
      misconception_count: 0,
      examples: [],
    },
    {
      idea_number: 2,
      idea: 'Anaerobic respiration releases less energy.',
      students_covered: 0,
      students_missing: 2,
      misconception_count: 1,
      examples: [{ student_said: 'It makes more energy', correction: 'It releases less energy' }],
    },
  ],
  other_misconceptions: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('teacher validation', () => {
  it('needs a class name', () => {
    expect(validateClassName('  ')).not.toBeNull();
    expect(validateClassName('Biology 4B')).toBeNull();
  });

  it('needs enough material for the checker', () => {
    expect(validateMaterial('Cells release energy.')).not.toBeNull();
    expect(validateMaterial(GOOD_MATERIAL)).toBeNull();
  });
});

describe('TeacherHome', () => {
  it('lists classes with their join codes', async () => {
    mockedApi.listClassrooms.mockResolvedValue([CLASSROOM]);
    await render(<TeacherHome user={teacher} onSignOut={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Biology 4B')).toBeTruthy());
    expect(screen.getByLabelText('Join code 3 J T B 7 4')).toBeTruthy();
  });

  it('creates a class and opens it', async () => {
    mockedApi.listClassrooms.mockResolvedValue([]);
    mockedApi.createClassroom.mockResolvedValue(CLASSROOM);
    await render(<TeacherHome user={teacher} onSignOut={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Class name'), ' Biology 4B ');
    await fireEvent.changeText(screen.getByLabelText('Subject'), 'Biology');
    await fireEvent.press(screen.getByRole('button', { name: 'Create class' }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/classroom/[classroomId]',
        params: { classroomId: 'class-1' },
      }),
    );
    expect(mockedApi.createClassroom).toHaveBeenCalledWith('Biology 4B', 'Biology');
  });

  it('does not send an empty class', async () => {
    mockedApi.listClassrooms.mockResolvedValue([]);
    await render(<TeacherHome user={teacher} onSignOut={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Create class' }));

    expect(screen.getByText('Add a class name.')).toBeTruthy();
    expect(mockedApi.createClassroom).not.toHaveBeenCalled();
  });
});

describe('AddUnitForm', () => {
  it('rejects material that is too short', async () => {
    await render(<AddUnitForm classroomId="class-1" onAdded={jest.fn()} onCancel={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Unit title'), 'Cell respiration');
    await fireEvent.changeText(screen.getByLabelText('Your material'), 'Cells release energy.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save unit' }));

    expect(screen.getByText(/Add at least 50 characters/)).toBeTruthy();
    expect(mockedApi.addUnit).not.toHaveBeenCalled();
  });

  it('saves a valid unit', async () => {
    mockedApi.addUnit.mockResolvedValue({
      id: 'unit-1',
      classroom_id: 'class-1',
      title: 'Cell respiration',
      created_at: '2026-10-28T10:00:00Z',
    });
    const onAdded = jest.fn();
    await render(<AddUnitForm classroomId="class-1" onAdded={onAdded} onCancel={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Unit title'), 'Cell respiration');
    await fireEvent.changeText(screen.getByLabelText('Your material'), GOOD_MATERIAL);
    await fireEvent.press(screen.getByRole('button', { name: 'Save unit' }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(mockedApi.addUnit).toHaveBeenCalledWith('class-1', 'Cell respiration', GOOD_MATERIAL);
  });

  it('adds the text of each uploaded file after what was typed, in order', async () => {
    mockedPicker.getDocumentAsync.mockResolvedValue(pickedFiles('notes.pdf', 'slides.pptx'));
    mockedApi.readMaterialFile
      .mockResolvedValueOnce({ text: 'Notes text', truncated: false })
      .mockResolvedValueOnce({ text: 'Slides text', truncated: true });
    await render(<AddUnitForm classroomId="class-1" onAdded={jest.fn()} onCancel={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Your material'), 'Typed intro');

    await fireEvent.press(screen.getByRole('button', { name: 'Upload a file' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Your material').props.value).toBe(
        'Typed intro\n\nNotes text\n\nSlides text',
      ),
    );
    expect(mockedApi.readMaterialFile.mock.calls[0][1].name).toBe('notes.pdf');
    expect(screen.getByText(/Added the text from notes.pdf, slides.pptx/)).toBeTruthy();
    expect(screen.getByText(/slides.pptx is very long/)).toBeTruthy();
  });

  it('keeps the files that worked and explains the one that did not', async () => {
    mockedPicker.getDocumentAsync.mockResolvedValue(pickedFiles('scan.pdf', 'notes.txt'));
    mockedApi.readMaterialFile
      .mockRejectedValueOnce(new ApiError(422, 'We could not find any text in this file.'))
      .mockResolvedValueOnce({ text: 'Notes text', truncated: false });
    await render(<AddUnitForm classroomId="class-1" onAdded={jest.fn()} onCancel={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Upload a file' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Your material').props.value).toBe('Notes text'),
    );
    expect(screen.getByText('scan.pdf: We could not find any text in this file.')).toBeTruthy();
  });

  it('changes nothing when the teacher closes the picker', async () => {
    mockedPicker.getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    await render(<AddUnitForm classroomId="class-1" onAdded={jest.fn()} onCancel={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Upload a file' }));

    expect(mockedApi.readMaterialFile).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Your material').props.value).toBe('');
  });
});

describe('UnitSummaryCard', () => {
  it('summarises reach without a ranking', () => {
    expect(describeUnitReach(UNIT)).toBe(
      '2 students have explained this. On average they explained 42% of the key ideas.',
    );
    expect(describeUnitReach({ ...UNIT, students_attempted: 0 })).toBe(
      'No students have explained this yet.',
    );
  });

  it('shows each idea and its common mistakes when expanded', async () => {
    await render(<UnitSummaryCard unit={UNIT} />);
    expect(screen.queryByText('2 of 2 students explained this')).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Show key ideas for Cell respiration' }),
    );

    expect(screen.getByText('2 of 2 students explained this')).toBeTruthy();
    expect(screen.getByText('0 of 2 students explained this')).toBeTruthy();
    expect(screen.getByText('1 common mistake')).toBeTruthy();
    expect(screen.getByText('“It makes more energy”')).toBeTruthy();
  });
});

describe('StudentSummaryRow', () => {
  const student: StudentSummary = {
    student_id: 'student-1',
    display_name: 'Bea',
    username: 'bea_m',
    average_coverage_percent: 50,
    units: [
      {
        unit_id: 'unit-1',
        sessions_completed: 1,
        latest_coverage_percent: 50,
        last_completed_at: '2026-10-28T10:00:00Z',
        missing_ideas: ['Anaerobic respiration releases less energy.'],
      },
    ],
  };

  it('describes results in ideas', () => {
    expect(describeStudentResult(student.units[0], UNIT)).toBe('1 of 2 key ideas');
    expect(describeStudentResult({ ...student.units[0], sessions_completed: 0 }, UNIT)).toBe(
      'Not explained yet',
    );
  });

  it('lists the ideas still to explain', async () => {
    await render(<StudentSummaryRow student={student} units={[UNIT]} />);

    expect(screen.getByText('Cell respiration: 1 of 2 key ideas')).toBeTruthy();
    expect(screen.getByText('• Anaerobic respiration releases less energy.')).toBeTruthy();
  });
});
