import { useEffect, useState } from 'react';
import { Logo } from './components/Logo';
import { SegmentedControl } from './components/SegmentedControl';
import { TopBar } from './components/TopBar';
import { CoreSection } from './gallery/CoreSection';
import { OverlaySection } from './gallery/OverlaySection';
import { SolfaSection } from './gallery/SolfaSection';
import { TokensSection } from './gallery/TokensSection';
import './gallery/Gallery.css';

type Theme = 'auto' | 'light' | 'dark';

function initialTheme(): Theme {
  const t = new URLSearchParams(window.location.search).get('theme');
  return t === 'light' || t === 'dark' ? t : 'auto';
}

/**
 * Living style guide (D-07): every component in its states, with a theme switch.
 * Dev/review tool only — its English text is not user-facing, so it is not translated.
 * Open gallery.html in dev, or lazy-load it on the `#/gallery` route.
 */
export function Gallery() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="sr-gallery">
      <TopBar
        leading={<Logo size={32} />}
        title="Solfa Reader — design system"
        subtitle="Gallery · D-07"
      />
      <main className="sr-container sr-gallery__main">
        <SegmentedControl
          label="Theme"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'auto', label: 'Auto', icon: 'settings' },
            { value: 'light', label: 'Light', icon: 'sun' },
            { value: 'dark', label: 'Dark', icon: 'moon' },
          ]}
        />
        <TokensSection />
        <CoreSection />
        <OverlaySection />
        <SolfaSection />
      </main>
    </div>
  );
}
