import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The desktop and the musician page served through a personal QR link.
  build: { rollupOptions: { input: { main: "index.html", ears: "ears.html" } } },
  server: { host: "127.0.0.1", port: 5173, proxy: {
    "/api": "http://127.0.0.1:3000",
    "/ws": { target: "ws://127.0.0.1:3000", ws: true },
  }},
});
