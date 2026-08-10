import { decodeConfig, encodeConfig } from "./share";
import type { Config } from "./wardrobe";

export type RecentProject = {
  id: string;
  name: string;
  updatedAt: string;
  config: Config;
  versions: ProjectVersion[];
};

export type ProjectVersion = { id: string; createdAt: string; config: Config };

const STORAGE_KEY = "wardrobe-recent-projects-v1";
const MAX_RECENT = 8;

export function loadRecentProjects(): RecentProject[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const value = entry as Partial<RecentProject>;
      if (typeof value.id !== "string" || typeof value.name !== "string") return [];
      const config = value.config ? decodeConfig(encodeConfig(value.config)) : null;
      return config
        ? [
            {
              id: value.id,
              name: value.name,
              updatedAt: value.updatedAt ?? new Date(0).toISOString(),
              config,
              versions: Array.isArray(value.versions)
                ? value.versions.flatMap((version) => {
                    if (!version || typeof version !== "object") return [];
                    const candidate = version as Partial<ProjectVersion>;
                    const versionConfig = candidate.config
                      ? decodeConfig(encodeConfig(candidate.config))
                      : null;
                    return versionConfig
                      ? [
                          {
                            id: candidate.id ?? crypto.randomUUID(),
                            createdAt: candidate.createdAt ?? new Date(0).toISOString(),
                            config: versionConfig,
                          },
                        ]
                      : [];
                  })
                : [
                    {
                      id: crypto.randomUUID(),
                      createdAt: value.updatedAt ?? new Date(0).toISOString(),
                      config,
                    },
                  ],
            },
          ]
        : [];
    });
  } catch {
    return [];
  }
}

export function saveRecentProject(config: Config, name: string): RecentProject[] {
  const now = new Date().toISOString();
  const normalizedName = name.trim() || "Untitled wardrobe";
  const projects = loadRecentProjects();
  const existing = projects.find((project) => project.name === normalizedName);
  if (existing) {
    const updated: RecentProject = {
      ...existing,
      updatedAt: now,
      config,
      versions: [{ id: crypto.randomUUID(), createdAt: now, config }, ...existing.versions].slice(
        0,
        20,
      ),
    };
    const next = [updated, ...projects.filter((project) => project.id !== existing.id)].slice(
      0,
      MAX_RECENT,
    );
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The editor remains usable when browser storage is unavailable.
    }
    return next;
  }
  const project: RecentProject = {
    id: crypto.randomUUID(),
    name: normalizedName,
    updatedAt: now,
    config,
    versions: [{ id: crypto.randomUUID(), createdAt: now, config }],
  };
  const next = [project, ...projects].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The editor remains usable when browser storage is unavailable.
  }
  return next;
}

export function removeRecentProject(id: string): RecentProject[] {
  const next = loadRecentProjects().filter((project) => project.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures; the current design is unaffected.
  }
  return next;
}
