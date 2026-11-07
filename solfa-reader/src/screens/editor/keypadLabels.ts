// Translated accessible names for the SolfaKeypad keys.
import { useMemo } from 'react';
import type { VoiceId } from '../../core';
import { useI18n, type MessageKey } from '../../i18n';
import type { SolfaKeypadLabels } from '../../ui';

/** All keypad labels in the current language. */
export function useKeypadLabels(): SolfaKeypadLabels {
  const { t } = useI18n();
  return useMemo(
    () => ({
      keypad: t('keypad.keypad'),
      backspace: t('keypad.backspace'),
      left: t('keypad.left'),
      right: t('keypad.right'),
      newline: t('keypad.newline'),
      undo: t('editor.undo'),
      redo: t('editor.redo'),
      space: t('keypad.space'),
      chromatic: t('keypad.chromatic'),
      octaveUp: t('keypad.octaveUp'),
      comma: t('keypad.comma'),
      dot: t('keypad.dot'),
      hold: t('keypad.hold'),
      weakBeat: t('keypad.weakBeat'),
      barLine: t('keypad.barLine'),
      mediumBeat: t('keypad.mediumBeat'),
      doubleBar: t('keypad.doubleBar'),
      voiceLine: (v: VoiceId) => t('keypad.voiceLine', { voice: t(`voice.${v}` as MessageKey) }),
    }),
    [t],
  );
}
