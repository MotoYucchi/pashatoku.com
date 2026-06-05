import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import QuizCreator from './QuizCreator.jsx'
import AdminDashboard from './AdminDashboard.jsx'

const path = window.location.pathname;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/admin/create' || path === '/admin/edit' ? <QuizCreator /> : path === '/admin' ? <AdminDashboard /> : <App />}
  </StrictMode>,
)
