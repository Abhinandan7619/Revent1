import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    // Completely disable HMR and file watching to prevent auto-reloads
    // This is necessary for K8s ingress environments with short timeouts
    hmr: false,
    watch: {
      usePolling: false,
      ignored: ['**/*'],
    },
  },
  // Disable client-side error overlay that might trigger reloads
  define: {
    '__VUE_OPTIONS_API__': false,
    '__VUE_PROD_DEVTOOLS__': false,
  },
})
