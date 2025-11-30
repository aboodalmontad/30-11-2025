import * as React from 'react';
import { createRoot } from 'react-dom/client';
// Fix: Corrected the import path for the App component by removing the `.tsx` extension. This is standard practice and helps module resolvers correctly locate the file, resolving the "no default export" error.
import App from './App';

// Listen for logout events from other tabs to ensure session state is synchronized.
window.addEventListener('storage', (event) => {
  // When the 'lawyerAppLoggedOut' key is set, it indicates another tab has signed out.
  if (event.key === 'lawyerAppLoggedOut' && event.newValue === 'true') {
    // Reload the page to clear the local session state and redirect to the login page.
    // The flag is removed upon a new successful login, preventing reload loops.
    window.location.reload();
  }
});


// Register Service Worker for offline capabilities
if ('serviceWorker' in navigator) {
  // This listener handles messages from the service worker.
  // When a new service worker is activated, it sends a 'RELOAD_PAGE_NOW' message
  // to all clients, forcing them to reload to get the latest version. This is more
  // reliable than the 'controllerchange' event.
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'RELOAD_PAGE_NOW') {
      window.location.reload();
    }
  });


  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        
        // Function to check for updates
        const checkForUpdate = () => {
            console.log('Checking for service worker update...');
            registration.update();
        };

        // 1. Proactively check for an updated service worker on every page load.
        checkForUpdate();
        
        // 2. Set up a periodic check for updates (e.g., every hour)
        // This ensures long-running tabs also get updates.
        setInterval(checkForUpdate, 60 * 60 * 1000); // 1 hour
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

const container = document.getElementById('root');

// Wrapper component to manage the application's key, allowing for a full remount.
const AppWrapper = () => {
    const [appKey, setAppKey] = React.useState(0);

    // This function, when called, changes the key on the App component,
    // forcing React to unmount the old instance and mount a new one,
    // effectively resetting the entire application's state.
    const handleRefresh = () => {
        setAppKey(prevKey => prevKey + 1);
    };

    return <App key={appKey} onRefresh={handleRefresh} />;
};


if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>
  );
} else {
    console.error('Failed to find the root element');
}