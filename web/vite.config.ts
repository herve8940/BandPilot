import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {gzipSync} from "node:zlib";
import {readFileSync} from "node:fs";
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: "bandpilot-compressed-assets",
    apply: "build",
    enforce: "post",
    generateBundle() {
      this.emitFile({type:"asset",fileName:"licenses/PDF.js.txt",source:readFileSync(new URL("./node_modules/pdfjs-dist/LICENSE",import.meta.url))});
    },
    async writeBundle(options,bundle) {
      // Vite finalizes lazy-import preloads after generateBundle. Compress the exact bytes served.
      for (const name of Object.keys(bundle)) {
        if (!/\.(?:m?js|css)$/.test(name)) continue;
        const path=resolve(options.dir!,name);
        // Android AssetManager removes a .gz suffix and would collide with the original.
        await writeFile(path+'.gzip',gzipSync(await readFile(path)));
      }
    },
  }],
  // The desktop and the musician page served through a personal QR link.
  build: { rollupOptions: { input: { main: "index.html", ears: "ears.html" } } },
  server: { host: "127.0.0.1", port: 5173, proxy: {
    "/api": "http://127.0.0.1:3000",
    "/ws": { target: "ws://127.0.0.1:3000", ws: true },
  }},
});
