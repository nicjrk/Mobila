// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/**
 * The dev devtools plugin injects a `data-tsd-source` prop into every JSX element.
 * react-three-fiber cannot apply unknown props onto three.js objects and throws
 * `Cannot set "data-tsd-source"`, blanking the 3D canvas. Strip that prop from the
 * files that render three.js elements.
 */
const stripDevtoolsSourceInR3F = (): Plugin => ({
  name: "strip-tsd-source-in-r3f",
  enforce: "post",
  transform(code, id) {
    if (!/src\/components\/wardrobe\/.*\.tsx/.test(id)) return null;
    if (!code.includes("data-tsd-source")) return null;
    return {
      code: code.replace(/"data-tsd-source":\s*"[^"]*",?\s*/g, ""),
      map: null,
    };
  },
});

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: { plugins: [stripDevtoolsSourceInR3F()] },
});
