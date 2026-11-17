// Shapes returned by the backend; keep in sync with backend/app/schemas

export type UserRole = 'student' | 'teacher';

export type User = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
};

export type RegisterForm = {
  username: string;
  display_name: string;
  password: string;
  role: UserRole;
};

export type Classroom = {
  id: string;
  name: string;
  subject: string;
  join_code: string;
};

export type Speaker = 'buddy' | 'student';

export type Turn = {
  position: number;
  speaker: Speaker;
  text: string;
};

export type KeyIdea = {
  idea: string;
  status: 'covered' | 'missing';
};

export type Misconception = {
  student_said: string;
  correction: string;
  idea_number: number | null;
};

export type CheckerFeedback = {
  key_ideas: KeyIdea[];
  misconceptions: Misconception[];
  application_question: string;
  next_step: string;
};

export type ApplicationResult = {
  verdict: 'correct' | 'partly_correct' | 'incorrect';
  explanation: string;
};

export type StudySession = {
  id: string;
  unit_id: string;
  unit_title: string;
  status: 'active' | 'completed';
  started_at: string;
  ends_at: string;
  completed_at: string | null;
  student_turns_left: number;
  turns: Turn[];
  coverage_percent: number | null;
  feedback: CheckerFeedback | null;
  application_answer: string | null;
  application_result: ApplicationResult | null;
};

export type Mascot = {
  level: number;
  understood_ideas: number;
  ideas_to_next_level: number;
};

export type UnitProgress = {
  unit_id: string;
  title: string;
  sessions_completed: number;
  latest_coverage_percent: number | null;
  best_coverage_percent: number | null;
  ideas_understood: number;
  total_ideas: number | null;
  still_missing: string[];
  next_step: string | null;
};

export type StudentProgress = {
  mascot: Mascot;
  classrooms: { classroom: Classroom; units: UnitProgress[] }[];
};

export type Unit = {
  id: string;
  classroom_id: string;
  title: string;
  created_at: string;
};

export type MaterialText = {
  text: string;
  // True when the file was very long and only its first part was read
  truncated: boolean;
};

export type MisconceptionExample = {
  student_said: string;
  correction: string;
};

export type IdeaSummary = {
  idea_number: number;
  idea: string;
  students_covered: number;
  students_missing: number;
  misconception_count: number;
  examples: MisconceptionExample[];
};

export type UnitSummary = {
  unit_id: string;
  title: string;
  students_attempted: number;
  average_coverage_percent: number | null;
  ideas: IdeaSummary[] | null;
  other_misconceptions: MisconceptionExample[];
};

export type StudentUnitResult = {
  unit_id: string;
  sessions_completed: number;
  latest_coverage_percent: number | null;
  last_completed_at: string | null;
  missing_ideas: string[];
};

export type StudentSummary = {
  student_id: string;
  display_name: string;
  username: string;
  average_coverage_percent: number | null;
  units: StudentUnitResult[];
};

export type ClassroomDashboard = {
  classroom: Classroom;
  student_count: number;
  units: UnitSummary[];
  students: StudentSummary[];
};
