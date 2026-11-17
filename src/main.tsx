import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/app-shell.css'
import { AppRoot } from './app/AppRoot'
import { createApp } from './app/bootstrap'
import { AppErrorBoundary } from './app/AppErrorBoundary'

const { registry, services } = createApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppRoot registry={registry} services={services} />
    </AppErrorBoundary>
  </StrictMode>,
)
