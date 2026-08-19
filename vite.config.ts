import { defineConfig } from 'vite';

// Repo is served from https://<user>.github.io/CastleBuild/, so assets
// need that base path in production builds; local dev stays at /.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/CastleBuild/' : '/',
});
