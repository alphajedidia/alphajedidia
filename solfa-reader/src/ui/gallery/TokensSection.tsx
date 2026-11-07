import type { CSSProperties } from 'react';
import { ICON_NAMES, Icon } from '../icons/Icon';
import { Logo } from '../components/Logo';
import { VOICE_ORDER, DEFAULT_VOICE_NAMES, voiceClass } from '../voices';
import { GallerySection, Specimen } from './GallerySection';

const SURFACES = ['bg', 'surface', 'surface-2', 'surface-3', 'border', 'border-strong'];
const INKS = ['text', 'text-muted', 'brand', 'brand-soft', 'gold', 'focus'];
const FEEDBACK = ['danger', 'warning', 'success', 'info', 'loop-bg', 'uncertain-bg'];
const TYPE = [
  ['2xl', '28 · Title'],
  ['xl', '22 · Screen title'],
  ['lg', '18 · Section'],
  ['md', '16 · Body text'],
  ['sm', '14 · Secondary'],
  ['xs', '13 · Meta'],
];

function Swatch({ name }: { name: string }) {
  const style = { background: `var(--sr-${name})` } as CSSProperties;
  return (
    <div className="sr-gallery__swatch">
      <span className="sr-gallery__chip" style={style} />
      <code>--sr-{name}</code>
    </div>
  );
}

/** Brand, colour tokens, voice colours, type scale and the icon set. */
export function TokensSection() {
  return (
    <>
      <GallerySection id="brand" title="Brand">
        <div className="sr-gallery__brand">
          <Logo size={96} title="Solfa Reader" />
          <Logo size={48} />
          <Logo size={24} />
          <div>
            <p className="sr-gallery__wordmark">Solfa Reader</p>
            <p className="sr-muted">A hymn-book that sings: four voice lines held by a brace.</p>
          </div>
        </div>
      </GallerySection>

      <GallerySection id="colors" title="Colour tokens" note="Switch the theme at the top: every token flips.">
        <div className="sr-gallery__swatches">
          {[...SURFACES, ...INKS, ...FEEDBACK].map((n) => (
            <Swatch key={n} name={n} />
          ))}
        </div>
      </GallerySection>

      <GallerySection
        id="voices"
        title="Voice colours"
        note="Text colour on page, card, tint and loop band; filled = current beat. Letters always accompany colour."
      >
        <div className="sr-gallery__voices">
          {VOICE_ORDER.map((v) => (
            <div key={v} className={`sr-gallery__voice ${voiceClass(v)}`}>
              <span className="sr-gallery__vfill">{v}</span>
              <span className="sr-gallery__vtext">{DEFAULT_VOICE_NAMES[v]}</span>
              <span className="sr-gallery__vsoft">d :r :m</span>
              <span className="sr-gallery__vloop">s :f :m</span>
            </div>
          ))}
        </div>
      </GallerySection>

      <GallerySection id="type" title="Type">
        <div className="sr-stack sr-stack--sm">
          {TYPE.map(([size, text]) => (
            <p key={size} style={{ fontSize: `var(--sr-fs-${size})` } as CSSProperties}>
              {text}
            </p>
          ))}
          <Specimen label="Sol-fa (mono, 20px, punctuation must stay visible)">
            <p className="sr-solfa-text">| d.,r :m, :f'  :s  ! l.t :d' :-  :-  ||</p>
          </Specimen>
          <Specimen label="Uncertain characters (OCR review)">
            <p className="sr-solfa-text">
              | m :<span className="sr-uncertain">n</span> :f :s |
            </p>
          </Specimen>
        </div>
      </GallerySection>

      <GallerySection id="icons" title={`Icons (${ICON_NAMES.length})`}>
        <div className="sr-gallery__icons">
          {ICON_NAMES.map((name) => (
            <div key={name} className="sr-gallery__icon">
              <Icon name={name} size={28} />
              <code>{name}</code>
            </div>
          ))}
        </div>
      </GallerySection>
    </>
  );
}
