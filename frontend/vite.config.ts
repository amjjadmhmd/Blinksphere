import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // publicDir الافتراضي = ./public داخل frontend، وفيه data/ (cube.bin + JSON)
  // حتى تُرفع مع النشر وتُخدم على /data/ في dev و production.
  server: {
    port: 5173,
    proxy: {
      // في التطوير فقط: نحوّل /api إلى دالة Vercel المنشورة (المفتاح يبقى على السيرفر)
      "/api": {
        target: "https://blinksphere.vercel.app",
        changeOrigin: true,
      },
    },
  },
});
