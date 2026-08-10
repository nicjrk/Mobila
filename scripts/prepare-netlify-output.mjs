import { cpSync, existsSync, rmSync } from "node:fs";

const source = ".output/public";
const target = "dist";

if (!existsSync(source)) {
  throw new Error(`Expected Nitro output directory was not generated: ${source}`);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
