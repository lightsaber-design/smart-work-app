import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/.test(id)) return "vendor-map";
          if (/[\\/]node_modules[\\/]recharts[\\/]/.test(id)) return "vendor-charts";
          if (
            /[\\/]node_modules[\\/](@radix-ui[\\/]react-(dialog|dropdown-menu|popover|select|tabs)|lucide-react)[\\/]/.test(id)
          ) {
            return "vendor-ui";
          }
          return undefined;
        },
      },
    },
  },
});
