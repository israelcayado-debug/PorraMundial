import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve("client"),
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000"
    }
  },
  build: {
    outDir: path.resolve("client", "dist"),
    emptyOutDir: true
  }
});
