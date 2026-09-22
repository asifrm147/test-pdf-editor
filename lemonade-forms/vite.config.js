import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Front end on 5173; /api and /mock-blob proxy to the local API server on 8787.
export default defineConfig({
  plugins: [react()],
  publicDir: "public", // serves /templates/*.pdf
  server: { port: 5173, proxy: { "/api": "http://localhost:8787", "/mock-blob": "http://localhost:8787" } },
});
