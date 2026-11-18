// Mirrors ErrorCode in backend/app/services/errors.py; a test checks the two lists match
export const SERVER_ERROR_CODES = [
  'username_taken',
  'wrong_login',
  'not_signed_in',
  'session_expired',
  'account_gone',
  'teachers_only',
  'students_only',
  'too_many_tries',
  'class_not_found',
  'unknown_join_code',
  'join_code_failed',
  'unit_not_found',
  'file_too_large',
  'file_unsupported',
  'file_locked',
  'file_damaged',
  'file_no_text',
  'session_not_found',
  'session_finished',
  'time_up',
  'last_turn',
  'session_full',
  'answer_already_sent',
  'nothing_explained',
  'finish_first',
  'nothing_to_answer',
  'drawings_used_up',
  'no_writing_found',
  'pip_busy',
  'pip_down',
  'drawing_unavailable',
  'invalid_input',
  'request_too_large',
  'length_required',
] as const;

// Problems the app notices itself, before or instead of an answer from the server
export const CLIENT_ERROR_CODES = ['offline', 'timeout', 'server_error'] as const;

export type ErrorCode = (typeof SERVER_ERROR_CODES)[number] | (typeof CLIENT_ERROR_CODES)[number];

/** Whether a value from the server is a code this version of the app knows. */
export function isServerErrorCode(value: unknown): value is (typeof SERVER_ERROR_CODES)[number] {
  return (SERVER_ERROR_CODES as readonly unknown[]).includes(value);
}
