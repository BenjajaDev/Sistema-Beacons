import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El CMS corre en http://localhost:5173 y el backend Express en http://localhost:3000.
// Para evitar problemas de CORS en desarrollo, redirigimos /beacons al backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/beacons": "http://localhost:3000",
    },
  },
});
