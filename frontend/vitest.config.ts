import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Pin auth-gate default OFF the bypass so the local .env (VITE_AUTH_DISABLED=true)
    // doesn't leak into tests; the AuthGate bypass test stubs it true explicitly.
    env: {
      VITE_AUTH_DISABLED: 'false',
    },
  },
});
