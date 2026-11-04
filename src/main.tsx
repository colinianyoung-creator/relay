import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/lib/auth'
import { ActionItemsProvider } from '@/components/ActionItemsProvider'
import { FeedbackProvider } from '@/components/FeedbackProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ActionItemsProvider>
          <FeedbackProvider>
            <App />
          </FeedbackProvider>
        </ActionItemsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
