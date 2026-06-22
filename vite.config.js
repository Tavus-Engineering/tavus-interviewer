import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { apiPlugin } from "./api/_lib/vite-plugin.js";
export default defineConfig({
    plugins: [react(), apiPlugin()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
            "@config": path.resolve(__dirname, "config"),
        },
    },
});
