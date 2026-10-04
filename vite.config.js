import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { proxy: { "/api": process.env.VITE_API_PROXY || "http://localhost:3000" } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore"], react: ["react", "react-dom", "react-router-dom"] } } },
  },
});
