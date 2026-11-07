// Entry point (I-01). The design system is imported first so tokens.css and base.css are
// defined before any component or screen CSS.
import './ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
