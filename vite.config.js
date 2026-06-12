import { defineConfig } from "vite";
import { resolve } from "path";
import { cpSync, existsSync } from "fs";

// The real WASA site photos live in the repo-root `photos/` folder so the
// local static server (serve.ps1, which serves the repo root) finds them at
// `/photos/...`. Vite only bundles assets in `public/` or those imported via
// `new URL(...)`, and these are referenced by plain runtime strings — so
// without this they'd be missing from `dist/` and 404 on the Pages deploy.
// Copy the folder into the build output verbatim after each build.
function copyPhotos() {
  return {
    name: "copy-site-photos",
    apply: "build",
    writeBundle() {
      const src = resolve(__dirname, "photos");
      if (existsSync(src)) {
        cpSync(src, resolve(__dirname, "dist/photos"), { recursive: true });
      }
    },
  };
}

// Multi-page setup: Vite only treats `index.html` as an entry by default,
// so additional pages (here `wasa-map.html`) must be listed explicitly or
// they won't end up in the production build / Pages deploy.
export default defineConfig({
  base: "/hydrological_cycle/",
  // Site-wide Mapillary token shipped at build time from a GitHub Actions
  // secret (VITE_MAPILLARY_TOKEN). PUBLIC by design — anyone with DevTools
  // can read the bundled JS — so the token MUST be locked to this site's
  // origin via the Mapillary developer dashboard's referrer allowlist.
  // Per-user tokens entered through the "Set token" UI take precedence and
  // are stored only in the user's localStorage.
  define: {
    __MAPILLARY_TOKEN__: JSON.stringify(process.env.VITE_MAPILLARY_TOKEN || ""),
  },
  plugins: [copyPhotos()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        wasaMap: resolve(__dirname, "wasa-map.html"),
      },
    },
  },
});