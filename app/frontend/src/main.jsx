import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import QuizCreator from './QuizCreator.jsx'

const path = window.location.pathname;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/create' ? <QuizCreator /> : <App />}
  </StrictMode>,
)
