import { apiClient } from '@/api/client';
import type {
  Classroom,
  Drawing,
  DrawingText,
  InputMode,
  StudentProgress,
  StudySession,
} from '@/api/types';
import type { AppLanguage } from '@/i18n/languages';

/** Join a class with the code the teacher shared. */
export function joinClassroom(joinCode: string): Promise<Classroom> {
  return apiClient.request<Classroom>('POST', '/classrooms/join', {
    body: { join_code: joinCode },
  });
}

/** The student's classes, units, progress and mascot in one request. */
export function getMyProgress(): Promise<StudentProgress> {
  return apiClient.request<StudentProgress>('GET', '/progress/me');
}

/** Start explaining a unit to Pip, who greets in the given language. */
export function startSession(unitId: string, language: AppLanguage): Promise<StudySession> {
  return apiClient.request<StudySession>('POST', '/sessions', {
    body: { unit_id: unitId, language },
  });
}

/** Have Pip greet again in another language, if the student hasn't answered yet. */
export function changeSessionLanguage(
  sessionId: string,
  language: AppLanguage,
): Promise<StudySession> {
  return apiClient.request<StudySession>(
    'PUT',
    `/sessions/${encodeURIComponent(sessionId)}/language`,
    { body: { language } },
  );
}

/** Load a session with its conversation and feedback. */
export function getSession(sessionId: string): Promise<StudySession> {
  return apiClient.request<StudySession>('GET', `/sessions/${encodeURIComponent(sessionId)}`);
}

/** Send what the student said and get Pip's reply. */
export function sendTurn(
  sessionId: string,
  text: string,
  inputMode: InputMode,
): Promise<StudySession> {
  return apiClient.request<StudySession>(
    'POST',
    `/sessions/${encodeURIComponent(sessionId)}/turns`,
    { body: { text, input_mode: inputMode } },
  );
}

/** End the session and get the gap map. */
export function finishSession(sessionId: string): Promise<StudySession> {
  return apiClient.request<StudySession>(
    'POST',
    `/sessions/${encodeURIComponent(sessionId)}/finish`,
  );
}

/** Answer the exam-style question and get it graded. */
export function answerApplicationQuestion(sessionId: string, text: string): Promise<StudySession> {
  return apiClient.request<StudySession>(
    'POST',
    `/sessions/${encodeURIComponent(sessionId)}/application-answer`,
    { body: { text } },
  );
}

/** Read a scratchpad drawing into text for the student to check; nothing is saved. */
export function readDrawing(sessionId: string, drawing: Drawing): Promise<DrawingText> {
  return apiClient.request<DrawingText>(
    'POST',
    `/sessions/${encodeURIComponent(sessionId)}/drawing-text`,
    { body: drawing },
  );
}
