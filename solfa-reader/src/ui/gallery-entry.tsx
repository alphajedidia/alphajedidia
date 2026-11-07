// Dev-only entry for gallery.html (not part of the production build).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index';
import { Gallery } from './Gallery';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Gallery />
    </StrictMode>,
  );
}
