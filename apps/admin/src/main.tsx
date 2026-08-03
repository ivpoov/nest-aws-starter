import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { ErrorBoundary } from './components/Layout/ErrorBoundary';
import { logger } from './utils/logger';
import './styles/global.css';

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent): void => {
  logger.error('Unhandled rejection', event.reason);
});

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
