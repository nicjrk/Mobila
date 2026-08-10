import { supabase } from "@/integrations/supabase/client";
import { normalizeConfig } from "./design-file";
import type { Config } from "./wardrobe";

/** Normalizează / validează un JSON venit din cloud într-un Config sigur. */
function sanitize(raw: unknown): Config | null {
  try {
    return normalizeConfig(raw);
  } catch {
    return null;
  }
}

/** Creează un proiect nou în cloud și întoarce UUID-ul lui. */
export async function createProject(config: Config, name = "Untitled wardrobe") {
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, config: config as unknown as never })
    .select("id")
    .single();
  if (error) throw error;
  const { error: revisionError } = await supabase.from("project_revisions").insert({
    project_id: data.id,
    config: config as unknown as never,
  });
  // Revisions are additive. A project must still be usable when the optional
  // migration has not reached the connected Supabase instance yet.
  if (revisionError) return data.id as string;
  return data.id as string;
}

/** Actualizează un proiect existent. */
export async function updateProject(id: string, config: Config) {
  const { error } = await supabase
    .from("projects")
    .update({ config: config as unknown as never })
    .eq("id", id);
  if (error) throw error;
  const { error: revisionError } = await supabase.from("project_revisions").insert({
    project_id: id,
    config: config as unknown as never,
  });
  if (revisionError) return;
}

export async function loadProjectRevisions(
  id: string,
): Promise<{ id: string; createdAt: string; config: Config }[]> {
  const { data, error } = await supabase
    .from("project_revisions")
    .select("id, created_at, config")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).flatMap((revision) => {
    const config = sanitize(revision.config);
    return config ? [{ id: revision.id, createdAt: revision.created_at, config }] : [];
  });
}

/** Încarcă un proiect public după UUID (fără cont). */
export async function loadProject(id: string): Promise<Config | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("config")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return sanitize(data.config);
}

export function projectUrl(id: string) {
  const url = new URL(window.location.href);
  url.search = `?project=${id}`;
  return url.toString();
}
