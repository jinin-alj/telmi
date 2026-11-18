import type { UserRole } from '@/api/types';
import { ChoiceGroup } from '@/components/choice-group';
import { useTexts } from '@/i18n/language-context';

type RolePickerProps = {
  value: UserRole;
  onChange: (role: UserRole) => void;
};

/** Choice between a student and a teacher account. */
export function RolePicker({ value, onChange }: RolePickerProps) {
  const texts = useTexts();
  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'student', label: texts.roles.student },
    { value: 'teacher', label: texts.roles.teacher },
  ];

  return (
    <ChoiceGroup
      label={texts.roles.label}
      options={roleOptions}
      value={value}
      onChange={onChange}
    />
  );
}
