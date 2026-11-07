// Design system public API (owner: solfa-design). Import from '../ui' only.
// Importing this module also loads the global styles (tokens first, then base).
// Catalogue, props and usage: docs/DESIGN.md. Live preview: gallery.html (dev) or Gallery.
import './tokens.css';
import './base.css';

export { cx } from './cx';
export { VOICE_ORDER, DEFAULT_VOICE_NAMES, voiceClass } from './voices';

// Icons and brand
export { Icon, ICON_NAMES, type IconName, type IconProps } from './icons/Icon';
export { Logo, LogoMark, type LogoProps } from './components/Logo';

// Core components
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './components/Button';
export { IconButton, type IconButtonProps } from './components/IconButton';
export { TopBar, type TopBarProps } from './components/TopBar';
export { Card, type CardProps } from './components/Card';
export { List, ListItem, type ListProps, type ListItemProps } from './components/ListItem';
export {
  Field,
  type FieldProps,
  type FieldInputProps,
  type FieldTextareaProps,
} from './components/Field';
export { Slider, snapToStep, type SliderProps } from './components/Slider';
export { Switch, type SwitchProps } from './components/Switch';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentOption,
} from './components/SegmentedControl';
export { Chip, type ChipProps, type ChipTone } from './components/Chip';
export { Sheet, type SheetProps } from './components/Sheet';
export { Dialog, type DialogProps } from './components/Dialog';
export {
  Toast,
  ToastHost,
  type ToastProps,
  type ToastHostProps,
  type ToastItem,
  type ToastTone,
  type ToastAction,
} from './components/Toast';
export { ProgressBar, type ProgressBarProps } from './components/ProgressBar';
export { Spinner, type SpinnerProps } from './components/Spinner';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';
export { VoiceBadge, type VoiceBadgeProps } from './components/VoiceBadge';

// Sol-fa components
export {
  SolfaKeypad,
  DEFAULT_KEYPAD_LABELS,
  DIATONIC_NOTES,
  RAISED_NOTES,
  LOWERED_NOTES,
  type SolfaKeypadProps,
  type SolfaKeypadLabels,
  type KeypadAction,
} from './solfa/SolfaKeypad';
export {
  ScoreView,
  type ScoreViewProps,
  type ScoreViewHandle,
  type BeatClickInfo,
} from './solfa/ScoreView';
export { beatText, separatorFor } from './solfa/beatText';
export {
  VoiceMixerRow,
  DEFAULT_MIXER_LABELS,
  type VoiceMixerRowProps,
  type VoiceMixerLabels,
} from './solfa/VoiceMixerRow';
export {
  TransportBar,
  DEFAULT_TRANSPORT_LABELS,
  type TransportBarProps,
  type TransportLabels,
} from './solfa/TransportBar';
export {
  PhotoStrip,
  cropRect,
  type PhotoStripProps,
  type StripRect,
  type StripImage,
} from './solfa/PhotoStrip';
