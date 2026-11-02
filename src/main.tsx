import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './firebase/authContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const container = document.getElementById('root') || (() => {
  const el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
  return el;
})();

const root = createRoot(container);
root.render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);

// Graceful dissolution of the initial luxury loading shell once React renders
requestAnimationFrame(() => {
  const shell = document.getElementById('ft-initial-shell');
  if (shell) {
    shell.style.transition = 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    shell.style.opacity = '0';
    shell.style.transform = 'scale(1.02)';
    shell.style.pointerEvents = 'none';
    setTimeout(() => {
      try {
        shell.remove();
      } catch {}
    }, 480);
  }
});


