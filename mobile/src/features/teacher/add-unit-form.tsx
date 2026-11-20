import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { addUnit, readMaterialFile } from '@/api/teaching';
import { Button } from '@/components/button';
import { ErrorMessage } from '@/components/error-message';
import { TextField } from '@/components/text-field';
import {
  MATERIAL_FILE_TYPES,
  appendMaterial,
  describeUploadErrors,
  describeUploads,
  type UploadOutcome,
} from '@/features/teacher/material-upload';
import {
  MATERIAL_MAX_LENGTH,
  validateMaterial,
  validateUnitTitle,
} from '@/features/teacher/validation';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import { colors, cornerRadius, panelShadow, spacing, textStyles } from '@/theme';

type AddUnitFormProps = {
  classroomId: string;
  onAdded: () => void;
  onCancel: () => void;
};

/** Add a topic and the material students will be checked against. */
export function AddUnitForm({ classroomId, onAdded, onCancel }: AddUnitFormProps) {
  const texts = useTexts();
  const [title, setTitle] = useState('');
  const [material, setMaterial] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUpload() {
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: MATERIAL_FILE_TYPES,
        multiple: true,
        // On the web, keep the browser's File instead of copying it into a base64 string
        base64: false,
      });
    } catch {
      setFormError(texts.addUnit.openFilesFailed);
      return;
    }
    if (picked.canceled) {
      return;
    }

    setUploading(true);
    setFormError(null);
    setUploadNotice(null);
    const outcomes: UploadOutcome[] = [];
    // One at a time, so the text lands in the order the teacher picked the files
    for (const asset of picked.assets) {
      try {
        const result = await readMaterialFile(classroomId, asset);
        // Add to whatever is in the box now, including anything typed while this was reading
        setMaterial((current) => appendMaterial(current, result.text));
        outcomes.push({ fileName: asset.name, read: true, truncated: result.truncated });
      } catch (error) {
        const message = errorText(error, texts, texts.addUnit.readFailed);
        outcomes.push({ fileName: asset.name, read: false, error: message });
      }
    }
    setUploadNotice(describeUploads(outcomes, texts.addUnit));
    setFormError(describeUploadErrors(outcomes));
    setMaterialError(null);
    setUploading(false);
  }

  async function handleSave() {
    const nextTitleError = validateUnitTitle(title, texts);
    const nextMaterialError = validateMaterial(material, texts);
    setTitleError(nextTitleError);
    setMaterialError(nextMaterialError);
    setFormError(null);
    if (nextTitleError || nextMaterialError) {
      return;
    }

    setSaving(true);
    try {
      await addUnit(classroomId, title.trim(), material.trim());
      onAdded();
    } catch (error) {
      setFormError(errorText(error, texts, texts.addUnit.saveFailed));
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        {texts.addUnit.heading}
      </Text>
      <TextField
        label={texts.addUnit.title}
        error={titleError}
        value={title}
        onChangeText={setTitle}
      />
      <Button
        label={texts.addUnit.upload}
        variant="secondary"
        onPress={handleUpload}
        loading={uploading}
        disabled={saving}
      />
      <Text style={styles.uploadHint}>{texts.addUnit.uploadHint}</Text>
      {uploadNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {uploadNotice}
        </Text>
      ) : null}
      <TextField
        label={texts.addUnit.material}
        hint={texts.addUnit.materialHint(material.trim().length, MATERIAL_MAX_LENGTH)}
        error={materialError}
        value={material}
        onChangeText={setMaterial}
        multiline
        // Uploads may run past the limit, so the cap never hides text the teacher still has to cut
        maxLength={Math.max(MATERIAL_MAX_LENGTH + 500, material.length)}
        style={styles.material}
      />
      <ErrorMessage message={formError} style={styles.error} />
      <Button
        label={texts.addUnit.save}
        onPress={handleSave}
        loading={saving}
        disabled={uploading}
      />
      <Button label={texts.addUnit.cancel} variant="secondary" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.medium,
    padding: spacing.medium,
    borderRadius: cornerRadius,
    backgroundColor: colors.panel,
    boxShadow: panelShadow,
  },
  heading: {
    ...textStyles.section,
    color: colors.text,
    marginBottom: spacing.small,
  },
  uploadHint: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginTop: 4,
    marginBottom: spacing.medium,
  },
  notice: {
    ...textStyles.body,
    color: colors.text,
    marginBottom: spacing.medium,
  },
  material: {
    minHeight: 180,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  error: {
    marginBottom: spacing.small,
  },
});
