import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Expose REACT_APP_* env vars to the client via import.meta.env
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'REACT_APP_'])
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    envPrefix: ['VITE_', 'REACT_APP_'],
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: true,
      hmr: {
        clientPort: 443,
        protocol: 'wss',
      },
    },
    define: {
      'process.env.REACT_APP_BACKEND_URL': JSON.stringify(env.REACT_APP_BACKEND_URL || ''),
    },
  }
})
