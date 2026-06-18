import react from "@vitejs/plugin-react";
import { build } from "vite";

await build({
  configFile: false,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.split("\\").join("/");
          if (!normalizedId.includes("/node_modules/")) return undefined;
          if (normalizedId.includes("/node_modules/react/") || normalizedId.includes("/node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (normalizedId.includes("/node_modules/phaser/")) {
            return "vendor-phaser";
          }
          if (normalizedId.includes("/node_modules/zustand/")) {
            return "vendor-state";
          }
          return "vendor";
        }
      }
    }
  }
});
