import type { Texts } from '@/i18n/en';

// Spanish from Spain, speaking to students as "tú"; words match the landing page
export const es: Texts = {
  language: {
    label: 'Idioma',
  },
  nav: {
    home: 'Inicio de Telmi',
    signOut: 'Cerrar sesión',
    backToClasses: 'Volver a mis clases',
    backToClassesShort: '‹ Mis clases',
    reportProblem: 'Informar de un problema',
  },
  slowRequest: 'Despertando el servidor, puede tardar hasta un minuto.',
  signIn: {
    tagline: 'Explícalo de memoria. Tu compañero es quien aprende.',
    username: 'Nombre de usuario',
    password: 'Contraseña',
    missingFields: 'Escribe tu nombre de usuario y tu contraseña.',
    failed: 'No se ha podido iniciar sesión. Inténtalo de nuevo.',
    submit: 'Iniciar sesión',
    toSignUp: '¿Primera vez aquí? Crea una cuenta',
  },
  signUp: {
    title: 'Crea tu cuenta',
    subtitle: 'No hace falta correo ni tu nombre real.',
    username: 'Nombre de usuario',
    usernameHint: 'Letras, números, puntos y guiones bajos.',
    nickname: 'Apodo',
    nicknameHint: 'Así te llamarán tu docente y tu compañero.',
    password: 'Contraseña',
    passwordHint: 'Al menos 8 caracteres.',
    failed: 'No se ha podido crear la cuenta. Inténtalo de nuevo.',
    submit: 'Crear cuenta',
    toSignIn: '¿Ya tienes cuenta? Inicia sesión',
  },
  roles: {
    label: 'Tipo de cuenta',
    student: 'Soy estudiante',
    teacher: 'Soy docente',
  },
  validation: {
    atLeast: (count: number) => `Usa al menos ${count} caracteres.`,
    atMost: (count: number) => `Usa como máximo ${count} caracteres.`,
    usernameCharacters: 'Usa solo letras, números, puntos y guiones bajos.',
    nicknameMissing: 'Añade un apodo. No tiene que ser tu nombre real.',
  },
  errors: {
    username_taken: 'Ese nombre de usuario ya existe.',
    wrong_login: 'El nombre de usuario o la contraseña no son correctos.',
    not_signed_in: 'Vuelve a iniciar sesión.',
    session_expired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    account_gone: 'Esta cuenta ya no existe.',
    teachers_only: 'Solo el profesorado puede hacer esto.',
    students_only: 'Solo el alumnado puede hacer esto.',
    too_many_tries: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
    class_not_found: 'No se ha encontrado la clase.',
    unknown_join_code: 'Ninguna clase tiene ese código.',
    join_code_failed: 'No se ha podido crear la clase. Inténtalo de nuevo.',
    unit_not_found: 'No se ha encontrado la unidad.',
    file_too_large: 'Los archivos pueden ocupar como máximo 20 MB.',
    file_unsupported:
      'Sube un archivo PDF, Word (.docx), PowerPoint (.pptx), de texto (.txt) o Markdown (.md).',
    file_locked:
      'Este archivo tiene contraseña o un formato antiguo. Quita la contraseña o guárdalo como .docx o .pptx y vuelve a intentarlo.',
    file_damaged: 'No hemos podido abrir este archivo. Guárdalo de nuevo o pega el texto.',
    file_no_text:
      'No hemos encontrado texto en este archivo. Si es un escaneo o una foto, pega el texto.',
    session_not_found: 'No se ha encontrado la sesión.',
    session_finished: 'Esta sesión ya ha terminado.',
    time_up: 'Se ha acabado el tiempo. Termina la sesión para ver cómo lo has hecho.',
    last_turn: 'Ese era tu último turno. Termina la sesión para ver cómo lo has hecho.',
    session_full:
      'Es todo lo que Pip puede aprender de una vez. Termina la sesión para ver cómo lo has hecho.',
    answer_already_sent: 'Tu última respuesta ya se ha enviado.',
    nothing_explained: 'Explica algo primero y luego termina.',
    finish_first: 'Termina la sesión antes de responder a la pregunta.',
    nothing_to_answer: 'En esta sesión no queda nada por responder.',
    drawings_used_up:
      'Pip ya ha leído todos los dibujos que puede en esta sesión. Escribe tu respuesta.',
    no_writing_found: 'No hemos encontrado nada escrito. Escribe más grande o usa el teclado.',
    pip_busy: 'Pip está ocupado ahora mismo. Espera un minuto y vuelve a intentarlo.',
    pip_down: 'Tu compañero no puede responder ahora mismo. Inténtalo de nuevo.',
    drawing_unavailable:
      'Pip no puede leer tu dibujo ahora mismo. Vuelve a intentarlo o escribe tu respuesta.',
    invalid_input: 'Algo no está bien. Revísalo y vuelve a intentarlo.',
    request_too_large: 'Es demasiado grande para enviarlo.',
    length_required: 'No se ha enviado. Inténtalo de nuevo.',
    offline: 'No se puede conectar con Telmi. Revisa tu conexión y vuelve a intentarlo.',
    timeout: 'Telmi ha tardado demasiado en responder. Revisa tu conexión y vuelve a intentarlo.',
    server_error: 'Algo ha fallado por nuestra parte. Inténtalo de nuevo.',
  },
};
