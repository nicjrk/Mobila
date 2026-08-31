import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .flatMap((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) return [];

        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^"|"$/g, "");
        return [[key, value]];
      }),
  );
}

const env = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
};
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.",
  );
  process.exitCode = 1;
} else {
  const supabase = createClient(url, key);
  let hasErrors = false;

  for (const table of ["projects", "project_revisions"]) {
    const { data, error } = await supabase.from(table).select("id").limit(1);

    if (error) {
      hasErrors = true;
      console.error(`[FAIL] ${table}: ${error.code || "unknown"} ${error.message}`);
      continue;
    }

    console.log(`[OK] ${table} reachable (sampled ${data?.length ?? 0} row(s))`);
  }

  if (hasErrors) process.exitCode = 1;
}
