import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // ffmpeg.wasm spawns its own worker — let Vite leave it alone
  optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"] },
  server: { proxy: { "/api": process.env.VITE_API_PROXY || "http://localhost:3000" } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore"], react: ["react", "react-dom", "react-router-dom"] } } },
  },
});
