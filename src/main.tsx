import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/app-shell.css'
import { AppShell } from './app/AppShell'
import { createApp } from './app/bootstrap'
import { AppErrorBoundary } from './app/AppErrorBoundary'

const { registry } = createApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppShell registry={registry} />
    </AppErrorBoundary>
  </StrictMode>,
)
