import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { addUnit, readMaterialFile } from '@/api/teaching';
import { Button } from '@/components/button';
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
import { colors, spacing } from '@/theme';

type AddUnitFormProps = {
  classroomId: string;
  onAdded: () => void;
  onCancel: () => void;
};

/** Add a topic and the material students will be checked against. */
export function AddUnitForm({ classroomId, onAdded, onCancel }: AddUnitFormProps) {
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
      setFormError("Couldn't open your files. Try again, or paste the text instead.");
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
        const message = error instanceof ApiError ? error.message : 'Could not read this file.';
        outcomes.push({ fileName: asset.name, read: false, error: message });
      }
    }
    setUploadNotice(describeUploads(outcomes));
    setFormError(describeUploadErrors(outcomes));
    setMaterialError(null);
    setUploading(false);
  }

  async function handleSave() {
    const nextTitleError = validateUnitTitle(title);
    const nextMaterialError = validateMaterial(material);
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
      setFormError(error instanceof ApiError ? error.message : 'Could not add the unit.');
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        Add a unit
      </Text>
      <TextField label="Unit title" error={titleError} value={title} onChangeText={setTitle} />
      <Button
        label="Upload a file"
        variant="secondary"
        onPress={handleUpload}
        loading={uploading}
        disabled={saving}
      />
      <Text style={styles.uploadHint}>
        PDF, Word, PowerPoint, text or Markdown files. You can pick several, and check the text
        before saving.
      </Text>
      {uploadNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {uploadNotice}
        </Text>
      ) : null}
      <TextField
        label="Your material"
        hint={`Paste or upload your notes, slides or textbook pages. Students never see this; Pip and the checker use it. ${material.trim().length} of ${MATERIAL_MAX_LENGTH} characters.`}
        error={materialError}
        value={material}
        onChangeText={setMaterial}
        multiline
        // Typing stops a little past the limit, but uploaded text may be longer so the teacher
        // can choose what to cut; a lower cap here would hide part of it
        maxLength={Math.max(MATERIAL_MAX_LENGTH + 500, material.length)}
        style={styles.material}
      />
      {formError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {formError}
        </Text>
      ) : null}
      <Button label="Save unit" onPress={handleSave} loading={saving} disabled={uploading} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.medium,
    padding: spacing.medium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.small,
  },
  uploadHint: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 4,
    marginBottom: spacing.medium,
  },
  notice: {
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.medium,
  },
  material: {
    minHeight: 180,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.error,
    fontSize: 15,
    marginBottom: spacing.small,
  },
});
