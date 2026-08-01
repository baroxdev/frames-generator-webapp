import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tanstackStart(), nitro(), react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    proxy: {
      "/webhook-test": {
        target: "https://workflow.seconds.id.vn",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
