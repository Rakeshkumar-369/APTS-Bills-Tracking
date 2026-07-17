import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AppProvider } from './context/AppContext'  // ← Add this import
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>  {/* ← Wrap App with AppProvider */}
      <App />
    </AppProvider>
  </React.StrictMode>,
)