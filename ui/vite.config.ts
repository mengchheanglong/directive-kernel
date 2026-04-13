import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": {
        target: process.env.DIRECTIVE_FRONTEND_API_ORIGIN || "http://127.0.0.1:43128",
        changeOrigin: true,
      },
    },
  },
});
