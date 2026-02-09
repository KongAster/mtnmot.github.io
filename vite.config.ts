
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries for better caching and loading speed on Netlify
          vendor: ['react', 'react-dom', 'recharts', 'lucide-react', 'file-saver'],
          utils: ['xlsx', 'jspdf', 'html2canvas', 'docx'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  },
});
