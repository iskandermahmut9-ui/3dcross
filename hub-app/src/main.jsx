import { StrictMode } from 'react'
import './index.css';
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext' // <-- 1. ДОБАВИЛИ ИМПОРТ

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 2. ОБЕРНУЛИ APP В AUTH PROVIDER */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)