import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

// Portability: the app must run anywhere, not just on Replit. PORT/BASE_PATH
// fall back to sensible defaults instead of throwing, and all @replit/* plugins
// are loaded optionally so the build still works if those packages are absent.
const DEFAULT_PORT = 21869;
const rawPort = process.env.PORT;
const parsedPort = rawPort ? Number(rawPort) : NaN;
const port =
  !Number.isNaN(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
if (rawPort && port === DEFAULT_PORT) {
  console.warn(`[vite] Invalid PORT "${rawPort}"; falling back to ${DEFAULT_PORT}.`);
}

const basePath = process.env.BASE_PATH || "/";

const isReplit = process.env.REPL_ID !== undefined;
const isDev = process.env.NODE_ENV !== "production";

/** Load an optional plugin; silently skip it if the package isn't installed. */
async function optionalPlugin(
  load: () => Promise<PluginOption | PluginOption[]>,
): Promise<PluginOption[]> {
  try {
    const p = await load();
    return Array.isArray(p) ? p : [p];
  } catch {
    return [];
  }
}

const replitPlugins: PluginOption[] = [
  ...(await optionalPlugin(() =>
    import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
  )),
  ...(isDev && isReplit
    ? await optionalPlugin(() =>
        import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
        ),
      )
    : []),
];

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    ...replitPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
