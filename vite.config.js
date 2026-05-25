import { defineConfig } from "vite";
import { resolve } from "path";

// Multi-page setup: Vite only treats `index.html` as an entry by default,
// so additional pages (here `wasa-map.html`) must be listed explicitly or
// they won't end up in the production build / Pages deploy.
export default defineConfig({
  base: "/hydrological_cycle/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        wasaMap: resolve(__dirname, "wasa-map.html"),
      },
    },
  },
});