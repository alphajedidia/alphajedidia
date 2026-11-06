import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Owner: solfa-interface (I-01). Placeholder until wave 2.
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
