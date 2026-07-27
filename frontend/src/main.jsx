import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { store } from './redux/store'
import { Provider } from 'react-redux'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
/* AG Grid CSS must load BEFORE index.css so our --ag-* variable overrides win */
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './index.css';

// Register AG Grid modules GLOBALLY at the entry point
ModuleRegistry.registerModules([AllCommunityModule]);

console.log('🚀 TVS-PED Production Build Active');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <>
        <App />
        <Toaster position="top-right" />
      </>
    </Provider>
  </StrictMode>,
)
