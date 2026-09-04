import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./src/v2", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL("./dist-v2", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
  },
  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },
});
