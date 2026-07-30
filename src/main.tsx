import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  installSystemNetworkFeedback,
  SystemFeedbackProvider,
} from './components/system/SystemFeedback';

installSystemNetworkFeedback();

void import('./App').then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SystemFeedbackProvider>
        <App />
      </SystemFeedbackProvider>
    </StrictMode>,
  );
});
