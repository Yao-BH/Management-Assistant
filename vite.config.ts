import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: "frontend",
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8766"
    }
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ["echarts"],
          xlsx: ["xlsx"]
        }
      }
    }
  }
});
