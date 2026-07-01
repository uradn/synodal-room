import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/tiles": {
        target: "http://localhost:8120",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles/, ""),
      },
      "/cog": {
        target: "http://localhost:8110",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cog/, "/cog"),
      },
      "/tms": {
        target: "https://lcz-generator.rub.de",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/tms/, ""),
      },
    },
  },
});
