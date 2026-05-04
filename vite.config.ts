import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { imagetools } from 'vite-imagetools';

// Force the browser (and any intermediate proxy that honors origin headers)
// to always revalidate HTML and the service-worker-style entry files. Hashed
// assets emitted by Vite (`/assets/*-[hash].js|css|...`) are safe to cache
// because their URL changes whenever their contents change, so we leave those
// alone and only mark the unhashed entry points as no-store.
const noStorePaths = [
  "/",
  "/index.html",
  "/sw.js",
  "/service-worker.js",
  "/manifest.webmanifest",
  "/manifest.json",
  "/version.json",
];

const noStoreHtmlHeaders = (): Plugin => ({
  name: "lovable-no-store-html",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url || "").split("?")[0];
      const accept = req.headers.accept || "";
      const isHtml =
        noStorePaths.includes(url) ||
        url.endsWith(".html") ||
        accept.includes("text/html");
      if (isHtml) {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, max-age=0",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url || "").split("?")[0];
      const accept = req.headers.accept || "";
      const isHtml =
        noStorePaths.includes(url) ||
        url.endsWith(".html") ||
        accept.includes("text/html");
      if (isHtml) {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, max-age=0",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    sourcemap: true,
    // Ensure all built assets are content-hashed so they can be cached
    // aggressively without ever serving a stale build.
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    imagetools(),
    react(),
    noStoreHtmlHeaders(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
