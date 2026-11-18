import type { Texts } from '@/i18n/en';

// Mirrors backend/app/schemas/classrooms.py so errors show before sending
const CLASS_NAME_MAX_LENGTH = 80;
const SUBJECT_MAX_LENGTH = 60;
const UNIT_TITLE_MAX_LENGTH = 120;
export const MATERIAL_MIN_LENGTH = 50;
export const MATERIAL_MAX_LENGTH = 12000;

/** Error for a required short text field, or null if it's valid. */
function validateRequiredText(
  value: string,
  missingMessage: string,
  maxLength: number,
  texts: Texts,
): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return missingMessage;
  }
  if (trimmed.length > maxLength) {
    return texts.validation.atMost(maxLength);
  }
  return null;
}

/** Error for a class name, or null. */
export function validateClassName(name: string, texts: Texts): string | null {
  return validateRequiredText(
    name,
    texts.teacherValidation.classNameMissing,
    CLASS_NAME_MAX_LENGTH,
    texts,
  );
}

/** Error for a subject, or null. */
export function validateSubject(subject: string, texts: Texts): string | null {
  return validateRequiredText(
    subject,
    texts.teacherValidation.subjectMissing,
    SUBJECT_MAX_LENGTH,
    texts,
  );
}

/** Error for a unit title, or null. */
export function validateUnitTitle(title: string, texts: Texts): string | null {
  return validateRequiredText(
    title,
    texts.teacherValidation.titleMissing,
    UNIT_TITLE_MAX_LENGTH,
    texts,
  );
}

/** Error for unit material, or null; too little gives the checker nothing to grade against. */
export function validateMaterial(material: string, texts: Texts): string | null {
  const length = material.trim().length;
  if (length < MATERIAL_MIN_LENGTH) {
    return texts.teacherValidation.materialTooShort(MATERIAL_MIN_LENGTH);
  }
  if (length > MATERIAL_MAX_LENGTH) {
    return texts.teacherValidation.materialTooLong(MATERIAL_MAX_LENGTH);
  }
  return null;
}
