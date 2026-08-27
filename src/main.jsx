import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/system.css'
import './styles/surfaces.css'
import './styles/support.css'

if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', () => {
    const el = document.activeElement;
    if (el && typeof el.blur === 'function' && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
      el.blur();
    }
  }, { passive: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
