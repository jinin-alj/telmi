import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { readDrawing } from '@/api/study';
import type { Drawing, InputMode } from '@/api/types';
import { Button } from '@/components/button';
import { appendReading } from '@/features/session/drawing';
import { DrawingPad } from '@/features/session/drawing-pad';
import type { SpeechLanguage } from '@/speech/languages';
import { useSpeechToText } from '@/speech/use-speech-to-text';
import { colors, cornerRadius, fonts, minimumTouchSize, spacing, textStyles } from '@/theme';

// Matches TURN_MAX_CHARACTERS in backend/app/schemas/study_sessions.py
const MAX_CHARACTERS = 2000;
const MICROPHONE_SIZE = 96;

// Expo Go and browsers like Firefox can't recognise speech; tell students what they can do instead
const NO_VOICE_NOTE =
  Platform.OS === 'web'
    ? "Voice isn't available in this browser. Use Chrome or Safari to talk, or type below."
    : 'Voice needs the full Telmi app. For now, type below.';

const MODE_LINKS: Record<InputMode, string> = {
  talk: 'Talk instead',
  type: 'Type instead',
  draw: 'Draw instead',
};

type VoiceInputProps = {
  sessionId: string;
  language: SpeechLanguage;
  prompt: string;
  typingPrompt: string;
  submitLabel: string;
  // The mode is how the answer was given when it was sent, even if it was edited by typing
  onSubmit: (text: string, inputMode: InputMode) => Promise<void>;
};

/** Speak, type or draw an answer, review and fix the text, then send it. */
export function VoiceInput({
  sessionId,
  language,
  prompt,
  typingPrompt,
  submitLabel,
  onSubmit,
}: VoiceInputProps) {
  const speech = useSpeechToText();
  const [mode, setMode] = useState<InputMode>(speech.isAvailable ? 'talk' : 'type');
  const [editedText, setEditedText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // A ref rather than state, so a second tap in the same moment already sees it
  const startingMicrophone = useRef(false);
  // The language the current recording started in
  const recordingLanguage = useRef(language);

  // Recognition can't change language mid-recording, so stop; the next tap uses the new one
  useEffect(() => {
    if (speech.isListening && language !== recordingLanguage.current) {
      recordingLanguage.current = language;
      speech.stopListening();
    }
  }, [language, speech]);

  // Once the student edits the transcript, their version wins over what was heard
  const text = editedText ?? speech.transcript;
  const hasText = text.trim() !== '';
  const typing = mode === 'type';
  const otherModes = (['talk', 'type', 'draw'] as const).filter(
    (option) => option !== mode && (option !== 'talk' || speech.isAvailable),
  );

  function switchMode(next: InputMode) {
    if (speech.isListening) {
      speech.stopListening();
    }
    setMode(next);
  }

  async function handleReadDrawing(drawing: Drawing) {
    const reading = await readDrawing(sessionId, drawing);
    // Add to what's already there, so a student can mix speaking, typing and drawing
    setEditedText((current) => appendReading(current ?? speech.transcript, reading.text));
  }

  async function handleMicrophonePress() {
    if (speech.isListening) {
      speech.stopListening();
      return;
    }
    // A second tap while the permission prompt is up would make the browser throw
    if (startingMicrophone.current) {
      return;
    }
    startingMicrophone.current = true;
    recordingLanguage.current = language;
    setEditedText(null);
    speech.clearTranscript();
    try {
      await speech.startListening(language);
    } finally {
      startingMicrophone.current = false;
    }
  }

  function handleStartOver() {
    setEditedText(null);
    speech.clearTranscript();
  }

  async function handleSend() {
    if (!hasText || sending) {
      return;
    }
    if (speech.isListening) {
      speech.stopListening();
    }
    setSending(true);
    setSendError(null);
    try {
      await onSubmit(text.trim().slice(0, MAX_CHARACTERS), mode);
      setEditedText(null);
      speech.clearTranscript();
    } catch (error) {
      setSendError(error instanceof ApiError ? error.message : 'That did not send. Try again.');
    } finally {
      setSending(false);
    }
  }

  const showTranscriptBox = typing || hasText || speech.isListening;

  return (
    <View style={styles.container}>
      {!speech.isAvailable ? <Text style={styles.note}>{NO_VOICE_NOTE}</Text> : null}

      {mode === 'talk' ? (
        <View style={styles.microphoneArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={speech.isListening ? 'Stop talking' : 'Tap to talk'}
            accessibilityState={{ busy: speech.isListening }}
            onPress={handleMicrophonePress}
            disabled={sending}
            style={[styles.microphone, speech.isListening ? styles.microphoneListening : null]}
          >
            <View style={styles.microphoneIcon} />
          </Pressable>
          <Text style={styles.microphoneLabel}>
            {speech.isListening ? 'Listening… tap to stop' : prompt}
          </Text>
        </View>
      ) : null}

      {speech.errorMessage ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {speech.errorMessage}
        </Text>
      ) : null}

      {/* Hidden rather than removed, so switching to typing and back keeps the drawing */}
      <View style={mode === 'draw' ? null : styles.hidden}>
        <DrawingPad onRead={handleReadDrawing} />
      </View>

      {showTranscriptBox ? (
        <TextInput
          accessibilityLabel={
            typing
              ? typingPrompt
              : mode === 'draw'
                ? 'What Pip read from your drawing. You can fix mistakes here.'
                : 'What Pip heard. You can fix mistakes here.'
          }
          placeholder={typing ? typingPrompt : ''}
          placeholderTextColor={colors.mutedText}
          value={text}
          onChangeText={setEditedText}
          editable={!speech.isListening && !sending}
          multiline
          maxLength={MAX_CHARACTERS}
          style={styles.transcript}
        />
      ) : null}

      {sendError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {sendError}
        </Text>
      ) : null}

      {hasText && !speech.isListening ? (
        <>
          <Button label={submitLabel} onPress={handleSend} loading={sending} />
          {!typing ? (
            <Button label="Start over" variant="secondary" onPress={handleStartOver} />
          ) : null}
        </>
      ) : null}

      {otherModes.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={MODE_LINKS[option]}
          onPress={() => switchMode(option)}
          style={styles.switchMode}
        >
          <Text style={styles.switchModeLabel}>{MODE_LINKS[option]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.medium,
  },
  hidden: {
    display: 'none',
  },
  note: {
    ...textStyles.body,
    color: colors.mutedText,
    marginBottom: spacing.small,
  },
  microphoneArea: {
    alignItems: 'center',
    marginVertical: spacing.medium,
  },
  microphone: {
    width: MICROPHONE_SIZE,
    height: MICROPHONE_SIZE,
    borderRadius: MICROPHONE_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pip never shows red, so recording is a darker coral with a soft ring
  microphoneListening: {
    backgroundColor: colors.primaryPressed,
    borderWidth: 8,
    borderColor: colors.primarySoft,
  },
  microphoneIcon: {
    width: 22,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.onPrimary,
  },
  microphoneLabel: {
    ...textStyles.body,
    color: colors.text,
    marginTop: spacing.small,
    textAlign: 'center',
  },
  transcript: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: cornerRadius,
    backgroundColor: colors.panel,
    padding: 12,
    fontFamily: fonts.body,
    fontSize: textStyles.body.fontSize,
    color: colors.text,
    textAlignVertical: 'top',
  },
  error: {
    ...textStyles.body,
    color: colors.error,
    marginTop: spacing.small,
  },
  switchMode: {
    minHeight: minimumTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.small,
  },
  switchModeLabel: {
    ...textStyles.body,
    color: colors.link,
    textDecorationLine: 'underline',
  },
});
