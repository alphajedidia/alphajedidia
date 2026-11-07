import { useState } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { ListItem, List } from '../components/ListItem';
import { Sheet } from '../components/Sheet';
import { ToastHost, type ToastItem } from '../components/Toast';
import { Icon } from '../icons/Icon';
import { GallerySection } from './GallerySection';

let toastSeq = 0;

/** Sheet, Dialog and the live ToastHost. */
export function OverlaySection() {
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = () => {
    toastSeq += 1;
    setToasts((t) => [...t, { id: String(toastSeq), message: `Link copied (${toastSeq})`, tone: 'success' }]);
  };
  return (
    <GallerySection id="overlays" title="Sheet · Dialog · ToastHost">
      <div className="sr-cluster">
        <Button icon="more" onClick={() => setSheet(true)} data-open="sheet">
          Open sheet
        </Button>
        <Button variant="danger" icon="trash" onClick={() => setDialog(true)} data-open="dialog">
          Delete…
        </Button>
        <Button icon="check" onClick={addToast} data-open="toast">
          Show toast
        </Button>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Song actions"
        footer={
          <Button variant="primary" onClick={() => setSheet(false)}>
            Done
          </Button>
        }
      >
        <List inset={false}>
          <ListItem leading={<Icon name="edit" />} title="Edit the sol-fa" onClick={() => setSheet(false)} />
          <ListItem leading={<Icon name="share" />} title="Share with the choir" onClick={() => setSheet(false)} />
          <ListItem leading={<Icon name="download" />} title="Download practice audio" subtitle="WAV · current mix" onClick={() => setSheet(false)} />
          <ListItem leading={<Icon name="file" />} title="Download MIDI" onClick={() => setSheet(false)} />
          <ListItem leading={<Icon name="copy" />} title="Duplicate" onClick={() => setSheet(false)} />
        </List>
      </Sheet>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        alert
        tone="danger"
        icon="trash"
        title="Delete this song?"
        description="“Hira fiderana” will be removed from this phone. Shared links keep working."
        actions={
          <>
            <Button onClick={() => setDialog(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setDialog(false)}>
              Delete
            </Button>
          </>
        }
      />

      <ToastHost toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </GallerySection>
  );
}
