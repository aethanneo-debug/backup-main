import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The mouse wheel over a focused number box changes its value instead of scrolling the page,
// so an amount could quietly go from 0 to -3. The box lets go of focus first, which makes the
// wheel scroll the page and leaves the amount as typed. Passive: it never blocks scrolling.
// Capture phase, so a container that stops the wheel event can't skip it.
document.addEventListener('wheel', (e) => {
  const box = e.target;
  if (box instanceof HTMLInputElement && box.type === 'number' && box === document.activeElement) box.blur();
}, {passive: true, capture: true});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
