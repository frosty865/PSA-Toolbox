import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
/* PSA Toolbox branding (repo root shared/) */
import '../../../shared/psa-tokens.css';
import '../../../shared/cisa_styles.css';
import './index.css';

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
