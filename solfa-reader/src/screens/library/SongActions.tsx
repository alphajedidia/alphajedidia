// Song actions from the library (⋮): play, edit, rename, duplicate, share, download, delete.
import { useEffect, useState } from 'react';
import { downloadText } from '../../app/download';
import { safeFileName } from '../../app/format';
import { duplicateSong, renameSong } from '../../app/library';
import { navigate } from '../../app/navigation';
import { useToast } from '../../app/toasts';
import { useT } from '../../i18n';
import { deleteSong, saveSong, type SongRecord } from '../../storage';
import { Button, Dialog, Field, Icon, List, ListItem, Sheet } from '../../ui';
import { ShareSheet } from '../share/ShareSheet';

export type SongDialog = 'actions' | 'rename' | 'delete' | 'share' | null;

export interface SongActionsProps {
  song: SongRecord | null;
  dialog: SongDialog;
  setDialog: (d: SongDialog) => void;
  /** Reload the list after a change. */
  onChanged: () => void;
}

/** Sheets and dialogs for one song of the library. */
export function SongActions({ song, dialog, setDialog, onChanged }: SongActionsProps) {
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState('');
  useEffect(() => {
    if (dialog === 'rename' && song) setName(song.title);
  }, [dialog, song]);

  if (!song) return null;
  const close = () => setDialog(null);

  const doRename = async () => {
    const title = name.trim();
    if (!title) return;
    close();
    await renameSong(song, title);
    toast.show({ message: t('library.renamed'), tone: 'success' });
    onChanged();
  };

  const doDuplicate = async () => {
    close();
    await duplicateSong(song, t('library.copyTitle', { title: song.title }));
    toast.show({ message: t('library.duplicated'), tone: 'success' });
    onChanged();
  };

  const doDelete = async () => {
    close();
    const removed = song;
    await deleteSong(removed.id);
    onChanged();
    toast.show({
      message: t('library.deleted', { title: removed.title }),
      action: {
        label: t('library.undo'),
        onClick: () => {
          void saveSong(removed).then(onChanged);
        },
      },
    });
  };

  return (
    <>
      <Sheet
        open={dialog === 'actions'}
        onClose={close}
        title={song.title}
        closeLabel={t('common.close')}
      >
        <List inset={false} aria-label={t('library.songActions', { title: song.title })}>
          <ListItem leading={<Icon name="play" />} title={t('library.actionPlay')} onClick={() => navigate(`/play/${encodeURIComponent(song.id)}`)} />
          <ListItem leading={<Icon name="edit" />} title={t('library.actionEdit')} onClick={() => navigate(`/edit/${encodeURIComponent(song.id)}`)} />
          <ListItem leading={<Icon name="share" />} title={t('library.actionShare')} onClick={() => setDialog('share')} />
          <ListItem leading={<Icon name="text" />} title={t('library.actionRename')} onClick={() => setDialog('rename')} />
          <ListItem leading={<Icon name="copy" />} title={t('library.actionDuplicate')} onClick={() => void doDuplicate()} />
          <ListItem
            leading={<Icon name="download" />}
            title={t('library.actionDownload')}
            onClick={() => {
              close();
              downloadText(song.text, safeFileName(song.title, 'solfa'));
            }}
          />
          <ListItem leading={<Icon name="trash" />} title={t('library.actionDelete')} onClick={() => setDialog('delete')} />
        </List>
      </Sheet>

      <Dialog
        open={dialog === 'rename'}
        onClose={close}
        title={t('library.renameTitle')}
        actions={
          <>
            <Button onClick={close}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={() => void doRename()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doRename();
          }}
        >
          <Field label={t('library.renameLabel')} value={name} onChange={(e) => setName(e.currentTarget.value)} autoFocus />
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'delete'}
        onClose={close}
        alert
        tone="danger"
        icon="trash"
        title={t('library.deleteTitle', { title: song.title })}
        description={t('library.deleteDesc')}
        actions={
          <>
            <Button onClick={close}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => void doDelete()} data-testid="delete-confirm">
              {t('common.delete')}
            </Button>
          </>
        }
      />

      <ShareSheet open={dialog === 'share'} onClose={close} title={song.title} text={song.text} />
    </>
  );
}
