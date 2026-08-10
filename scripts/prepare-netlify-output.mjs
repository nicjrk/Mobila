import { cpSync, existsSync, rmSync } from "node:fs";

const source = ".output/public";
const target = "dist";

// Nitro uses `.output/public` for the local/default preset, but Netlify's
// preset writes the public directory directly to `dist`.
if (existsSync(source)) {
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
} else if (!existsSync(target)) {
  throw new Error(`Expected Nitro output directory was not generated: ${source}`);
}
