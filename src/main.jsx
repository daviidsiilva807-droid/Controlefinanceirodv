import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { LimiteDeErro } from './components/LimiteDeErro'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Fora do BrowserRouter de propósito: se o próprio roteador falhar, a
        tela de erro ainda precisa aparecer. */}
    <LimiteDeErro>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LimiteDeErro>
  </StrictMode>
)
