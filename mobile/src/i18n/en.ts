import type { ErrorCode } from '@/api/error-codes';

// Every word the app shows, in English; es.ts must have the same keys
export const en = {
  language: {
    label: 'Language',
  },
  nav: {
    home: 'Telmi home',
    signOut: 'Sign out',
    backToClasses: 'Back to my classes',
    backToClassesShort: '‹ My classes',
    reportProblem: 'Report a problem',
  },
  slowRequest: 'Waking up the server, this can take up to a minute.',
  signIn: {
    tagline: 'Explain it from memory. Your buddy is the one learning.',
    username: 'Username',
    password: 'Password',
    missingFields: 'Enter your username and password.',
    failed: 'Sign-in failed. Please try again.',
    submit: 'Sign in',
    toSignUp: 'New here? Create an account',
  },
  signUp: {
    title: 'Create your account',
    subtitle: 'No email or real name needed.',
    username: 'Username',
    usernameHint: 'Letters, numbers, dots and underscores.',
    nickname: 'Nickname',
    nicknameHint: 'This is what your teacher and buddy will call you.',
    password: 'Password',
    passwordHint: 'At least 8 characters.',
    failed: 'Sign-up failed. Please try again.',
    submit: 'Create account',
    toSignIn: 'Already have an account? Sign in',
  },
  roles: {
    label: 'Account type',
    student: "I'm a student",
    teacher: "I'm a teacher",
  },
  validation: {
    atLeast: (count: number) => `Use at least ${count} characters.`,
    atMost: (count: number) => `Use at most ${count} characters.`,
    usernameCharacters: 'Use only letters, numbers, dots and underscores.',
    nicknameMissing: 'Add a nickname. It does not have to be your real name.',
  },
  errors: {
    username_taken: 'That username is already taken.',
    wrong_login: 'Wrong username or password.',
    not_signed_in: 'Please sign in again.',
    session_expired: 'Your sign-in has expired. Please sign in again.',
    account_gone: 'This account no longer exists.',
    teachers_only: 'Only teachers can do this.',
    students_only: 'Only students can do this.',
    too_many_tries: 'Too many tries. Wait a minute, then try again.',
    class_not_found: 'Class not found.',
    unknown_join_code: 'No class has that code.',
    join_code_failed: "Couldn't create the class. Please try again.",
    unit_not_found: 'Unit not found.',
    file_too_large: 'Files can be at most 20 MB.',
    file_unsupported:
      'Upload a PDF, Word (.docx), PowerPoint (.pptx), text (.txt) or Markdown (.md) file.',
    file_locked:
      'This file is password-protected or in an old format. Remove the password or save it as .docx or .pptx, then try again.',
    file_damaged: "We couldn't open this file. Try saving it again, or paste the text instead.",
    file_no_text:
      "We couldn't find any text in this file. If it's a scan or a photo, paste the text instead.",
    session_not_found: 'Session not found.',
    session_finished: 'This session is already finished.',
    time_up: 'Time is up. Finish the session to see your feedback.',
    last_turn: "That's the last turn. Finish the session to see your feedback.",
    session_full: "That's all Pip can take in one go. Finish the session to see your feedback.",
    answer_already_sent: 'Your last answer was already sent.',
    nothing_explained: 'Explain something first, then finish.',
    finish_first: 'Finish the session before answering the question.',
    nothing_to_answer: 'This session has nothing left to answer.',
    drawings_used_up: 'Pip has read all the drawings it can for this session. Type instead.',
    no_writing_found: "We couldn't find any writing. Try writing bigger, or type instead.",
    pip_busy: 'Pip is busy right now. Wait a minute, then try again.',
    pip_down: "Your buddy can't answer right now. Please try again.",
    drawing_unavailable: "Pip can't read your drawing right now. Try again, or type instead.",
    invalid_input: "Something in that wasn't right. Check it and try again.",
    request_too_large: 'That is too big to send.',
    length_required: "That didn't send. Please try again.",
    offline: "Can't reach Telmi. Check your connection and try again.",
    timeout: 'Telmi took too long to answer. Check your connection and try again.',
    server_error: 'Something went wrong on our side. Please try again.',
    // Every error code needs words, and no others are allowed
  } satisfies Record<ErrorCode, string>,
};

export type Texts = typeof en;
