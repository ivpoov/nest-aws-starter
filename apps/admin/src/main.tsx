import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { ErrorBoundary } from './components/Layout/ErrorBoundary';
import { ADMIN_PRODUCT_NAME } from './constants/product.constants';
import { logger } from './utils/logger';
import './styles/global.css';

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent): void => {
  logger.error('Unhandled rejection', event.reason);
});

// The tab title comes from the same variable as everything else on screen.
// index.html cannot read it — Vite substitutes env into HTML only for
// variables that are set, and a fresh clone has none — so the default lives
// in one place and is applied here.
document.title = ADMIN_PRODUCT_NAME;

const container: HTMLElement | null = document.getElementById('root');

if (!container) throw new Error('Root container missing');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
