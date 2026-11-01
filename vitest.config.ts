import { defineConfig } from "vitest/config"
import viteReact from "@vitejs/plugin-react"

// Dedicated test config: only the React transform (for JSX in data modules),
// not the full TanStack Start build plugin, so unit tests stay lightweight.
export default defineConfig({
  // Same `@/*` -> ./src/* resolution the app build uses (vite.config.ts), so a
  // test can import a feature module that imports by alias.
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  plugins: [viteReact()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
