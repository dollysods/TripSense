import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import * as Sentry from "@sentry/react";

/**
 * Sentry client-side error tracking.
 * Cookieless / GDPR-safe config per Production Plan B4: no PII
 * collection, no performance tracing, no session replay. DSN comes
 * from VITE_SENTRY_DSN (.env.local for dev, Vercel env var for prod);
 * init is skipped entirely if it isn't set.
 */
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // No replay integration - session replay stays off.
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
