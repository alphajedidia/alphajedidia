import type { ReactNode } from 'react';

interface GallerySectionProps {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}

/** A titled block of the Gallery (`data-gallery` is used by the screenshot script). */
export function GallerySection({ id, title, note, children }: GallerySectionProps) {
  return (
    <section id={id} data-gallery={id} className="sr-gallery__section">
      <h2 className="sr-gallery__h2">{title}</h2>
      {note && <p className="sr-gallery__note">{note}</p>}
      <div className="sr-gallery__body">{children}</div>
    </section>
  );
}

/** A labelled specimen inside a section. */
export function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sr-gallery__specimen">
      <p className="sr-gallery__label">{label}</p>
      {children}
    </div>
  );
}
