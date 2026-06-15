import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // In-process tests (require('../index')) exercise the real auth gate; the
    // api test server is also started with AUTH_DISABLED=true. The dedicated
    // auth-middleware test clears this per-case to verify enforcement.
    env: {
      AUTH_DISABLED: 'true',
    },
  },
});
