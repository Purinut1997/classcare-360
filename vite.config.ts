import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          icons: ['lucide-react'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [react()],
});
