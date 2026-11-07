// Player "more" sheet: edit, downloads (WAV practice file, MIDI, .solfa), score text size.
import { useT } from '../../i18n';
import type { TextSize } from '../../app/settings';
import { Icon, List, ListItem, SegmentedControl, Sheet, Spinner } from '../../ui';

export type ExportKind = 'wav' | 'midi' | 'solfa';

export interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onExport: (kind: ExportKind) => void;
  exporting: ExportKind | null;
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
}

/** Bottom sheet with the less frequent player actions. */
export function MoreSheet({ open, onClose, onEdit, onExport, exporting, textSize, onTextSize }: MoreSheetProps) {
  const t = useT();
  const lead = (kind: ExportKind) => (exporting === kind ? <Spinner size="md" /> : <Icon name="download" />);
  return (
    <Sheet open={open} onClose={onClose} title={t('common.more')} closeLabel={t('common.close')}>
      <div className="sr-stack">
        <List inset={false}>
          <ListItem leading={<Icon name="edit" />} title={t('player.edit')} onClick={onEdit} />
        </List>
        <h3 className="sr-section-title">{t('player.download')}</h3>
        <List inset={false}>
          <ListItem
            leading={lead('wav')}
            title={t('player.exportWav')}
            subtitle={t('player.exportWavDesc')}
            disabled={exporting !== null}
            onClick={() => onExport('wav')}
          />
          <ListItem
            leading={lead('midi')}
            title={t('player.exportMidi')}
            subtitle={t('player.exportMidiDesc')}
            disabled={exporting !== null}
            onClick={() => onExport('midi')}
          />
          <ListItem leading={lead('solfa')} title={t('player.exportSolfa')} onClick={() => onExport('solfa')} />
        </List>
        <div className="sr-stack sr-stack--sm">
          <h3 className="sr-section-title">{t('player.textSize')}</h3>
          <SegmentedControl
            label={t('player.textSize')}
            block
            value={textSize}
            onChange={onTextSize}
            options={[
              { value: 'md', label: 'A' },
              { value: 'lg', label: 'A+' },
              { value: 'xl', label: 'A++' },
            ]}
          />
        </div>
      </div>
    </Sheet>
  );
}
