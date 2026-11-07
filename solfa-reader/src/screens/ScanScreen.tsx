// Scan flow (I-05): capture → crop → read → review, one route per step so the browser back
// button works. The canvases travel through app/session.ts. The OCR module is imported only here.
import { useRef, useState, type ChangeEvent } from 'react';
import { goBack, navigate } from '../app/navigation';
import type { ScanStep } from '../app/router';
import { releaseScanImages, scanSession } from '../app/session';
import { useSettings } from '../app/settings';
import { useToast } from '../app/toasts';
import { useT } from '../i18n';
import { Button, Card, Icon, SegmentedControl, Spinner, TopBar } from '../ui';
import { CropStep } from './scan/CropStep';
import { ReadStep } from './scan/ReadStep';
import { ReviewStep } from './scan/ReviewStep';
import './ScanScreen.css';

/** `#/scan`, `#/scan/crop`, `#/scan/read`, `#/scan/review`. */
export default function ScanScreen({ step }: { step: ScanStep }) {
  if (step === 'crop') return <CropStep />;
  if (step === 'read') return <ReadStep />;
  if (step === 'review') return <ReviewStep />;
  return <CaptureStep />;
}

function CaptureStep() {
  const t = useT();
  const toast = useToast();
  const { settings, update } = useSettings();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setOpening(true);
    try {
      const ocr = await import('../ocr');
      const session = scanSession();
      session.ocrLoaded = true;
      releaseScanImages();
      session.photo = await ocr.loadImageToCanvas(file);
      session.result = null;
      session.text = null;
      session.savedId = null;
      navigate('/scan/crop');
    } catch (err) {
      console.warn('[scan] could not open the image', err);
      toast.show({ message: t('scan.openFailed'), tone: 'error', duration: 0 });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="sr-page" data-testid="screen-scan">
      <TopBar title={t('scan.title')} onBack={() => goBack()} backLabel={t('common.back')} />
      <main className="sr-container sr-page__body sr-stack">
        <Card tone="brand" title={t('scan.tipsTitle')} actions={<Icon name="scan" size={32} className="sr-scan__tipsicon" />}>
          <ul className="sr-tips">
            {(['scan.tip1', 'scan.tip2', 'scan.tip3', 'scan.tip4'] as const).map((k) => (
              <li key={k}>
                <Icon name="check-circle" size={20} />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="sr-stack sr-stack--sm">
          <SegmentedControl<'printed' | 'handwritten'>
            label={t('scan.kind')}
            block
            value={settings.handwriting ? 'handwritten' : 'printed'}
            onChange={(v) => update({ handwriting: v === 'handwritten' })}
            options={[
              { value: 'printed', label: t('scan.printed'), icon: 'text' },
              { value: 'handwritten', label: t('scan.handwritten'), icon: 'edit' },
            ]}
          />
          <p className="sr-muted">{settings.handwriting ? t('scan.handwrittenHint') : t('scan.printedHint')}</p>
        </div>
        <p className="sr-muted sr-scan__privacy">
          <Icon name="check-circle" size={18} /> {t('scan.privacy')}
        </p>
        {opening && (
          <p className="sr-scan__opening" role="status">
            <Spinner size="sm" /> {t('scan.opening')}
          </p>
        )}
      </main>
      <div className="sr-page__bottom">
        <div className="sr-page__bottom-inner">
          <Button variant="primary" size="lg" icon="camera" block disabled={opening} onClick={() => cameraRef.current?.click()}>
            {t('scan.takePhoto')}
          </Button>
          <Button icon="image" block disabled={opening} onClick={() => galleryRef.current?.click()}>
            {t('scan.chooseImage')}
          </Button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-file-input"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="scan-camera"
          onChange={(e) => void onFile(e)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="sr-file-input"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="scan-file"
          onChange={(e) => void onFile(e)}
        />
      </div>
    </div>
  );
}
