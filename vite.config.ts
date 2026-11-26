// One config for both apps: `--mode booking` or `--mode status` picks the
// app folder, its output folder and the local API it proxies to.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const APPS = {
  booking: { port: 5173, api: "http://localhost:8080" },
  status: { port: 5174, api: "http://localhost:8081" },
} as const;

export default defineConfig(({ mode }) => {
  const app = mode in APPS ? (mode as keyof typeof APPS) : "booking";
  const root = fileURLToPath(new URL(`./apps/${app}`, import.meta.url));
  return {
    root,
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    plugins: [react()],
    define: { __APP__: JSON.stringify(app) },
    build: { outDir: fileURLToPath(new URL(`./dist/${app}`, import.meta.url)), emptyOutDir: true, sourcemap: true },
    server: { port: APPS[app].port, proxy: { "/api": process.env.API_URL ?? APPS[app].api } },
    test: { root: fileURLToPath(new URL(".", import.meta.url)), include: ["test/**/*.test.ts"] },
  };
});
