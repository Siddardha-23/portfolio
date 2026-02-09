import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Force initial theme check on load to prevent flicker
const root = document.documentElement;
const storedTheme = localStorage.getItem('theme') || 'system';

if (storedTheme === 'dark' || 
    (storedTheme === 'system' && 
     window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  root.classList.add('dark');
} else {
  root.classList.remove('dark');
}

createRoot(document.getElementById('root')!).render(<App />);
