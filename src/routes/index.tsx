import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import LeftPanel from "@/components/wardrobe/LeftPanel";
import RightPanel from "@/components/wardrobe/RightPanel";
import ModularPanel from "@/components/wardrobe/ModularPanel";
import {
  dedupeUnitIds,
  defaultConfig,
  enterUnderStairs,
  newUnit,
  totalPrice,
  billOfMaterials,
  DEFAULT_MODULAR_ROOM,
  type Config,
  type Unit,
  type WallId,
} from "@/lib/wardrobe";
import { alignToWall, footprintSize, nextUnitX, snapUnitToRoom } from "@/lib/units";
import { addFitting, fittingsOf, moveFitting, removeFitting } from "@/lib/fittings";
import {
  loadPresets,
  loadKitchenLayouts,
  removeKitchenLayout,
  saveKitchenLayout,
  removePreset,
  savePreset,
  unitFromPreset,
  type CabinetPreset,
  type PresetCategory,
  type SavedKitchenLayout,
} from "@/lib/presets";
import PresetBar from "@/components/wardrobe/PresetBar";
import SavePresetDialog from "@/components/wardrobe/SavePresetDialog";
import OnboardingDialog from "@/components/wardrobe/OnboardingDialog";
import RecentProjectsDialog from "@/components/wardrobe/RecentProjectsDialog";
import PlanView from "@/components/wardrobe/PlanView";
import FrontView from "@/components/wardrobe/FrontView";
import { planItems } from "@/lib/plan";
import type { DoorSel } from "@/components/wardrobe/Scene";
import { buildShareUrl, decodeConfig, encodeConfig } from "@/lib/share";
import {
  createProject,
  loadProject,
  loadProjectRevisions,
  projectUrl,
  updateProject,
} from "@/lib/projects";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHistoryState } from "@/hooks/use-history-state";
import { validateConfig } from "@/lib/validation";
import { normalizeConfig, parseDesignFile } from "@/lib/design-file";
import { downloadBlob, downloadDataUrl } from "@/lib/download";
import {
  loadRecentProjects,
  removeRecentProject,
  saveRecentProject,
  type ProjectVersion,
  type RecentProject,
} from "@/lib/recent-projects";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  FileDown,
  Save,
  Boxes,
  MousePointer2,
  Link2,
  Trash2,
  Plus,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Undo2,
  Redo2,
  AlertTriangle,
  CircleHelp,
  Clock3,
  FileUp,
  Grid3X3,
  Eye,
  EyeOff,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const Scene = lazy(() => import("@/components/wardrobe/Scene"));
const ModularScene = lazy(() => import("@/components/wardrobe/ModularScene"));
// Bump the storage schema after changing the default scene to a clean canvas.
// Older saved designs remain untouched but are not injected into new projects.
const STORAGE_KEY = "wardrobe-design-v3";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Custom 3D Wardrobe Planner — Design Your Fitted Wardrobe" },
      {
        name: "description",
        content:
          "Design a fitted wardrobe in 3D: set width, height and depth, pick finishes and door styles, add shelves, rails, drawers and lighting, and see live pricing.",
      },
      { property: "og:title", content: "Custom 3D Wardrobe Planner" },
      {
        property: "og:description",
        content:
          "Interactive 3D wardrobe configurator with real-time dimensions, finishes, interior fittings and live price breakdown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planner,
});

function Planner() {
  const configHistory = useHistoryState<Config>(defaultConfig());
  const config = configHistory.value;
  const setConfigState = configHistory.setValue;
  const setConfigTransient = configHistory.setTransient;
  const { undo, redo, beginTransaction, commitTransaction, cancelTransaction, isTransaction } =
    configHistory;
  const [activeBay, setActiveBay] = useState(0);
  const [activeWall, setActiveWall] = useState<WallId>("a");
  const [doorSel, setDoorSel] = useState<DoorSel>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [editInterior, setEditInterior] = useState(false);
  const [selectedFitting, setSelectedFitting] = useState<string | null>(null);
  const [doorUnit, setDoorUnit] = useState<string | null>(null);
  const [presets, setPresets] = useState<CabinetPreset[]>([]);
  const [savedKitchenLayouts, setSavedKitchenLayouts] = useState<SavedKitchenLayout[]>([]);
  const [projectName, setProjectName] = useState("Hallway Wardrobe");
  const [fullscreen, setFullscreen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [viewMode, setViewMode] = useState<"3d" | "2d" | "front">("3d");
  const [showGrid, setShowGrid] = useState(true);
  const [cleanPreview, setCleanPreview] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [assemblyWorkspace, setAssemblyWorkspace] = useState(false);
  const [presetTarget, setPresetTarget] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "unsaved">("saved");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRecentProjects, setShowRecentProjects] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const importInput = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const validationIssues = useMemo(() => validateConfig(config), [config]);
  const validationErrors = validationIssues.filter((issue) => issue.severity === "error");
  const clipboard = useRef<Unit | null>(null);
  const isModular = config.roomShape === "modular";
  const isAssemblyWorkspace = assemblyWorkspace || isModular;
  const setActive = (wall: WallId, bay: number) => {
    setActiveWall(wall);
    setActiveBay(bay);
  };
  const selectModularUnit = (id: string | null, additive = false) => {
    if (!id) {
      setSelectedUnit(null);
      setSelectedUnitIds([]);
      return;
    }
    if (additive) {
      setSelectedUnitIds((ids) =>
        ids.includes(id) ? ids.filter((candidate) => candidate !== id) : [...ids, id],
      );
      setSelectedUnit(id);
      return;
    }
    setSelectedUnit(id);
    setSelectedUnitIds([id]);
  };
  const setConfig = useCallback(
    (fn: (c: Config) => Config) => setConfigState((c) => fn(c)),
    [setConfigState],
  );
  const setConfigTransientValue = useCallback(
    (fn: (c: Config) => Config) => setConfigTransient((c) => fn(c)),
    [setConfigTransient],
  );

  const total = totalPrice(config);

  const saveProjectToLibrary = () => {
    if (config.units.length === 0) {
      toast.error("Add at least one cabinet before saving the project");
      return;
    }
    const name = window.prompt("Name this project", projectName || "My kitchen");
    if (!name?.trim()) return;
    setSavedKitchenLayouts(saveKitchenLayout(config, name.trim()));
    setProjectName(name.trim());
    toast.success("Project saved to Preset Library");
  };

  useEffect(() => setPresets(loadPresets()), []);
  useEffect(() => setSavedKitchenLayouts(loadKitchenLayouts()), []);
  useEffect(() => setRecentProjects(loadRecentProjects()), []);

  useEffect(() => {
    const onContext = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; x: number; y: number }>).detail;
      setContextMenu(detail);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    const onPointerDown = () => setContextMenu(null);
    window.addEventListener("wardrobe-unit-context", onContext);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("wardrobe-unit-context", onContext);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  useEffect(() => {
    try {
      setShowOnboarding(window.localStorage.getItem("wardrobe-onboarding-v1") !== "done");
    } catch {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (isTransaction) return;
    setSaveState("unsaved");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        setSaveState("saved");
      } catch {
        setSaveState("unsaved");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [config, isTransaction]);

  const patchUnit = useCallback(
    (id: string, p: Partial<Unit>) =>
      setConfigState((c) => ({
        ...c,
        units: c.units.map((u) => (u.id === id ? { ...u, ...p } : u)),
      })),
    [setConfigState],
  );

  const interior = useMemo(
    () => ({
      editInterior,
      onToggleEditInterior: () => {
        setEditInterior((v) => {
          toast(v ? "Frame unlocked" : "Edit Interior Only — cabinet frame locked");
          return !v;
        });
      },
      selectedFitting,
      onSelectFitting: setSelectedFitting,
      onBeginTransaction: beginTransaction,
      onCommitTransaction: commitTransaction,
      onCancelTransaction: cancelTransaction,
      onMoveFitting: (unitId: string, fittingId: string, y: number, targetUnitId?: string) =>
        setConfigTransient((c) => {
          const src = c.units.find((u) => u.id === unitId);
          if (!src) return c;
          const fit = fittingsOf(src).find((f) => f.id === fittingId) ?? null;
          if (targetUnitId && targetUnitId !== unitId && fit) {
            return {
              ...c,
              units: c.units.map((u) =>
                u.id === unitId
                  ? removeFitting(u, fittingId)
                  : u.id === targetUnitId
                    ? addFitting(u, fit.type, y, fittingId)
                    : u,
              ),
            };
          }
          return {
            ...c,
            units: c.units.map((u) => (u.id === unitId ? moveFitting(u, fittingId, y) : u)),
          };
        }),
      onSelectDoor: (id: string | null) => {
        setDoorUnit(id);
        if (id) setSelectedUnit(id);
      },
      onMoveHandle: (unitId: string, y: number) =>
        setConfigTransient((c) => ({
          ...c,
          units: c.units.map((u) => (u.id === unitId ? { ...u, handleY: Math.round(y) } : u)),
        })),
    }),
    [
      editInterior,
      selectedFitting,
      beginTransaction,
      commitTransaction,
      cancelTransaction,
      setConfigTransient,
    ],
  );

  /** Drop a brand-new standalone cabinet into the scene and select it. */
  const addCabinet = (front: Unit["front"] = "door") => {
    const id = newUnit().id;
    setConfigState((c) => {
      const u = newUnit({
        id,
        name: `Cabinet ${c.units.length + 1}`,
        finish: c.finish,
        front,
        w: front === "double" ? 100 : 60,
        x: nextUnitX(c.units, front === "double" ? 100 : 60),
        z: c.units[0]?.z ?? 0,
      });
      return {
        ...c,
        roomShape: "modular",
        units: [...c.units, snapUnitToRoom(u, c.units, c.modularRoom)],
      };
    });
    setSelectedUnit(id);
    toast.success(front === "double" ? "2-door cabinet added" : "1-door cabinet added");
  };

  const pasteUnit = useCallback(
    (src: Unit) => {
      const createdId = newUnit().id;
      setConfigState((c) => {
        const { id: _drop, ...rest } = src;
        const clone = newUnit({
          ...rest,
          id: createdId,
          ...(src.fittings ? { fittings: src.fittings.map((fitting) => ({ ...fitting })) } : {}),
          ...(src.leaves
            ? {
                leaves: Object.fromEntries(
                  Object.entries(src.leaves).map(([k, v]) => [k, { ...v }]),
                ),
              }
            : {}),
          x: src.x + footprintSize(src).width,
          z: src.z,
        });
        const placed = snapUnitToRoom(clone, c.units, c.modularRoom);
        return { ...c, units: [...c.units, placed] };
      });
      setSelectedUnit(createdId);
      toast.success("Unit duplicated");
    },
    [setConfigState],
  );

  const unitActions = useMemo(
    () => ({
      onRotate: (id: string) =>
        setConfigState((c) => {
          const current = c.units.find((u) => u.id === id);
          if (!current) return c;
          const rotated = { ...current, rot: (current.rot + 90) % 360 };
          const placed = snapUnitToRoom(rotated, c.units, c.modularRoom);
          return { ...c, units: c.units.map((u) => (u.id === id ? placed : u)) };
        }),
      onDuplicate: (id: string) => {
        const src = config.units.find((u) => u.id === id);
        if (src) pasteUnit(src);
      },
      onDelete: (id: string) => {
        setConfigState((c) => ({ ...c, units: c.units.filter((u) => u.id !== id) }));
        setSelectedUnit(null);
        toast("Unit removed");
      },
      onAlignWall: (id: string) =>
        setConfigState((c) => {
          const current = c.units.find((u) => u.id === id);
          if (!current) return c;
          const placed = snapUnitToRoom(alignToWall(current), c.units, c.modularRoom);
          return { ...c, units: c.units.map((u) => (u.id === id ? placed : u)) };
        }),
      onToggleOpen: (id: string) =>
        setConfigState((c) => {
          const next = !c.units.find((u) => u.id === id)?.open;
          return {
            ...c,
            units: c.units.map((u) => (u.id === id ? { ...u, open: next } : u)),
          };
        }),
      onToggleDrawers: (id: string) =>
        setConfigState((c) => ({
          ...c,
          units: c.units.map((u) => (u.id === id ? { ...u, drawersOpen: !u.drawersOpen } : u)),
        })),
      onToggleSnap: (id: string) =>
        setConfigState((c) => ({
          ...c,
          units: c.units.map((u) => (u.id === id ? { ...u, snap: u.snap === false } : u)),
        })),
      onElevate: (id: string, delta: number) => {
        const u = config.units.find((x) => x.id === id);
        if (u) patchUnit(id, { y: Math.max(0, (u.y ?? 0) + delta) });
      },
      onSavePreset: (id: string) => setPresetTarget(id),
    }),
    [config.units, pasteUnit, patchUnit, setConfigState],
  );

  const presetUnit = config.units.find((u) => u.id === presetTarget) ?? null;

  /** Persist the selected cabinet, with every option intact, under a custom name. */
  const commitPreset = (name: string, category: PresetCategory) => {
    if (!presetUnit) return;
    setPresets(savePreset(presetUnit, name, category));
    toast.success("Saved to presets", { description: `${name} · ${category}` });
  };

  /** Spawn a saved preset into the live scene, keeping fronts, handles and fittings. */
  const insertPreset = (p: CabinetPreset) => {
    const id = newUnit().id;
    setConfigState((c) => {
      const u = {
        ...unitFromPreset(p, nextUnitX(c.units, footprintSize(p.unit).width), c.units[0]?.z ?? 0),
        id,
      };
      return {
        ...c,
        roomShape: "modular",
        units: [...c.units, snapUnitToRoom(u, c.units, c.modularRoom)],
      };
    });
    setSelectedUnit(id);
    toast.success(`${p.name} inserted`);
  };

  // Ctrl/Cmd + C / V pe unitatea selectată.
  useEffect(() => {
    if (!isModular) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      )
        return;
      const step = e.shiftKey ? 10 : 1;
      const nudge =
        e.key === "ArrowLeft"
          ? { x: -step }
          : e.key === "ArrowRight"
            ? { x: step }
            : e.key === "ArrowUp"
              ? { z: step }
              : e.key === "ArrowDown"
                ? { z: -step }
                : null;
      const moveIds = selectedUnitIds.length ? selectedUnitIds : selectedUnit ? [selectedUnit] : [];
      if (nudge && moveIds.length) {
        e.preventDefault();
        setConfigState((c) => ({
          ...c,
          units: (() => {
            const obstacles = c.units.filter((unit) => !moveIds.includes(unit.id));
            const moving = c.units.filter((unit) => moveIds.includes(unit.id));
            const placed = moving.reduce((result, unit) => {
              const moved = {
                ...unit,
                x: unit.x + (nudge.x ?? 0),
                z: unit.z + (nudge.z ?? 0),
              };
              return [...result, snapUnitToRoom(moved, [...obstacles, ...result], c.modularRoom)];
            }, [] as Unit[]);
            return c.units.map(
              (unit) => placed.find((candidate) => candidate.id === unit.id) ?? unit,
            );
          })(),
        }));
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedUnit) {
        e.preventDefault();
        setConfigState((c) => ({ ...c, units: c.units.filter((u) => u.id !== selectedUnit) }));
        setSelectedUnit(null);
        toast("Unit removed");
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "d" && selectedUnit) {
        const unit = config.units.find((candidate) => candidate.id === selectedUnit);
        if (unit) {
          e.preventDefault();
          pasteUnit(unit);
        }
        return;
      }
      if (k === "c" && selectedUnit) {
        const u = config.units.find((x) => x.id === selectedUnit);
        if (u) {
          e.preventDefault();
          clipboard.current = {
            ...u,
            ...(u.fittings ? { fittings: u.fittings.map((fitting) => ({ ...fitting })) } : {}),
            ...(u.leaves
              ? {
                  leaves: Object.fromEntries(
                    Object.entries(u.leaves).map(([key, leaf]) => [key, { ...leaf }]),
                  ),
                }
              : {}),
          };
          toast("Unit copied");
        }
      }
      if (k === "v" && clipboard.current) {
        e.preventDefault();
        pasteUnit(clipboard.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModular, selectedUnit, selectedUnitIds, config.units, pasteUnit, setConfigState]);

  useEffect(() => {
    const onHistoryKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onHistoryKey);
    return () => window.removeEventListener("keydown", onHistoryKey);
  }, [undo, redo]);

  // Încarcă designul din cloud (?project=UUID), din link (?d=...) sau din ultima salvare locală.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("project");
    if (pid) {
      setProjectId(pid);
      setBusy(true);
      Promise.all([loadProject(pid), loadProjectRevisions(pid).catch(() => [])])
        .then(([c, versions]) => {
          if (c) {
            setConfigState({ ...c, units: dedupeUnitIds(c.units) });
            setRecentProjects((projects) => [
              {
                id: pid,
                name: "Cloud project",
                updatedAt: new Date().toISOString(),
                config: c,
                versions: versions.length
                  ? versions
                  : [{ id: `${pid}-current`, createdAt: new Date().toISOString(), config: c }],
              },
              ...projects.filter((project) => project.id !== pid),
            ]);
            toast.success("Project loaded from the cloud");
          } else {
            toast.error("Project not found");
          }
        })
        .catch(() => toast.error("Could not load the project"))
        .finally(() => setBusy(false));
      return;
    }
    const code = params.get("d");
    if (code) {
      const fromLink = decodeConfig(code);
      if (fromLink) {
        try {
          const safe = normalizeConfig(fromLink);
          setConfigState(safe);
          toast.success("Design loaded from link");
        } catch {
          toast.error("Invalid design link");
        }
        return;
      }
      toast.error("Invalid link");
      return;
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved)
        setConfigState((c) => {
          try {
            const parsed = decodeConfig(encodeConfig(JSON.parse(saved)));
            if (!parsed) return c;
            const normalized = normalizeConfig(parsed);
            const oldRoom = normalized.modularRoom;
            const isLegacyRoom =
              oldRoom.width === 400 && oldRoom.depth === 365 && oldRoom.height === 260;
            return isLegacyRoom
              ? { ...normalized, modularRoom: { ...DEFAULT_MODULAR_ROOM } }
              : normalized;
          } catch {
            return c;
          }
        });
    } catch {
      /* ignore */
    }
  }, [setConfigState]);

  // Ține link-ul din bara de adrese mereu sincronizat cu designul curent.
  useEffect(() => {
    if (projectId || isTransaction) return;
    const url = new URL(window.location.href);
    url.search = `?d=${encodeConfig(config)}`;
    window.history.replaceState(null, "", url.toString());
  }, [config, projectId, isTransaction]);

  // Salvează în cloud (creează prima dată, apoi actualizează).
  const saveToCloud = async (): Promise<string | null> => {
    if (validationErrors.length > 0) {
      toast.error("Fix the configuration issues before saving");
      return null;
    }
    setBusy(true);
    try {
      if (projectId) {
        await updateProject(projectId, config);
        toast.success("Project updated in the cloud");
        return projectId;
      }
      const id = await createProject(config, projectName || "Wardrobe design");
      setProjectId(id);
      const url = projectUrl(id);
      window.history.replaceState(null, "", url);
      toast.success("Project saved to the cloud", { description: `ID: ${id.slice(0, 8)}…` });
      return id;
    } catch {
      toast.error("Could not save the project");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const resetDesign = () => {
    const currentShape = config.roomShape;
    const cleanBase = defaultConfig();
    const nextConfig =
      currentShape === "understairs"
        ? { ...enterUnderStairs(cleanBase), items: [] }
        : { ...cleanBase, roomShape: currentShape, items: [] };
    configHistory.reset(nextConfig);
    setActive("a", 0);
    setDoorSel(null);
    setSelectedUnit(null);
    setDoorUnit(null);
    setProjectId(null);
    window.history.replaceState(null, "", "/");
    toast("Design cleared", { description: `Stayed in ${currentShape} layout` });
  };

  const save = () => {
    if (validationErrors.length > 0) {
      toast.error("Fix the configuration issues before saving");
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setRecentProjects(saveRecentProject(config, projectName));
      toast.success("Design saved", { description: `Total €${total.toFixed(2)}` });
    } catch {
      toast.error("Could not save design");
    }
  };

  const openRecentProject = (project: RecentProject) => {
    configHistory.reset({ ...project.config, units: dedupeUnitIds(project.config.units) });
    setProjectName(project.name);
    setProjectId(null);
    setSelectedUnit(null);
    setShowRecentProjects(false);
    toast.success("Design loaded", { description: project.name });
  };

  const openRecentVersion = (project: RecentProject, version: ProjectVersion) => {
    configHistory.reset({ ...version.config, units: dedupeUnitIds(version.config.units) });
    setProjectName(project.name);
    setProjectId(null);
    setSelectedUnit(null);
    setShowRecentProjects(false);
    toast.success("Version loaded", {
      description: `${project.name} · ${new Date(version.createdAt).toLocaleString()}`,
    });
  };

  const share = async () => {
    const id = await saveToCloud();
    const url = id ? projectUrl(id) : buildShareUrl(config);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiat / Link copied", {
        description: "Trimite linkul clientului pentru a vedea și edita configurația.",
      });
    } catch {
      window.prompt("Copiază linkul proiectului / Copy project link:", url);
    }
  };

  const exportDesign = () => {
    if (validationErrors.length > 0) {
      toast.error("Fix the configuration issues before exporting");
      return;
    }
    const payload = {
      projectName,
      exportedAt: new Date().toISOString(),
      config,
      total,
      billOfMaterials: billOfMaterials(config),
    };
    const filename = `${projectName.trim().replace(/\s+/g, "-").toLowerCase() || "wardrobe-design"}.json`;
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      filename,
    );
    toast.success("Design exported", {
      description: "Configuration and bill of materials included.",
    });
  };

  const importDesign = async (file: File) => {
    try {
      const imported = parseDesignFile(await file.text());
      configHistory.reset(imported.config);
      setProjectId(null);
      setSelectedUnit(null);
      setDoorUnit(null);
      if (imported.projectName) setProjectName(imported.projectName);
      toast.success("Design imported");
    } catch (error) {
      toast.error("Could not import design", {
        description: error instanceof Error ? error.message : "Invalid JSON file",
      });
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  const exportCsv = () => {
    if (validationErrors.length > 0) {
      toast.error("Fix the configuration issues before exporting");
      return;
    }
    const rows = [["SKU", "Item", "Quantity", "Unit price", "Total"]].concat(
      billOfMaterials(config).map((line) => [
        line.sku ?? "CUSTOM",
        line.label,
        String(line.qty),
        String(line.unit),
        String(line.qty * line.unit),
      ]),
    );
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), "wardrobe-bom.csv");
    toast.success("BOM exported as CSV");
  };

  const exportPng = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      toast.error("3D viewport is not ready");
      return;
    }
    downloadDataUrl(canvas.toDataURL("image/png"), "wardrobe-preview.png");
    toast.success("Preview exported as PNG");
  };

  const exportPdf = () => {
    if (validationErrors.length > 0) {
      toast.error("Fix the configuration issues before exporting");
      return;
    }
    const report = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!report) {
      toast.error("Allow pop-ups to create the printable report");
      return;
    }
    const escape = (value: string) =>
      value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const lines = billOfMaterials(config)
      .map(
        (line) =>
          `<tr><td>${escape(line.sku ?? "CUSTOM")}</td><td>${escape(line.label)}</td><td>${line.qty}</td><td>€${line.unit.toFixed(2)}</td><td>€${(line.qty * line.unit).toFixed(2)}</td></tr>`,
      )
      .join("");
    const warnings = validationIssues
      .map((issue) => `<li class="${issue.severity}">${escape(issue.message)}</li>`)
      .join("");
    const planRows = planItems(config, selectedUnit, activeWall, activeBay)
      .map(
        (item) =>
          `<tr><td>${escape(item.label)}</td><td>${Math.round(item.x)} cm</td><td>${Math.round(item.z)} cm</td><td>${Math.round(item.width)} × ${Math.round(item.depth)} × ${Math.round(item.height)} cm</td></tr>`,
      )
      .join("");
    /* Legacy single-page report template retained only in source history.
    if (false) {
      report?.document
        .write(`<!doctype html><html><head><title>${escape(projectName || "Wardrobe design")}</title><style>
      body{font:14px Arial,sans-serif;color:#303632;margin:40px}h1{margin:0 0 6px}h2{margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:6px}.meta{color:#69736d;margin-bottom:24px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 7px;border-bottom:1px solid #e5e0d8}th{background:#eef4ef}.total{text-align:right;font-size:20px;font-weight:700;margin-top:18px}.error{color:#a33}.warning{color:#9a6a19}@media print{body{margin:18mm}button{display:none}}
    </style></head><body><h1>${escape(projectName || "Wardrobe design")}</h1><div class="meta">Generated ${new Date().toLocaleString()} · ${escape(config.roomShape)}</div><h2>Configuration</h2><p>Room width: ${config.width} cm · Height: ${config.height} cm · Depth: ${config.depth} cm</p><h2>Bill of materials</h2><table><thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead><tbody>${lines}</tbody></table><div class="total">Total: €${total.toFixed(2)}</div>${warnings ? `<h2>Warnings</h2><ul>${warnings}</ul>` : ""}</body></html>`);
    }
    */
    report.document
      .write(`<!doctype html><html><head><title>${escape(projectName || "Wardrobe design")}</title><style>
      body{font:14px Arial,sans-serif;color:#303632;margin:0}h1{margin:0 0 8px}h2{margin-top:22px;border-bottom:1px solid #ddd;padding-bottom:6px}.page{min-height:245mm;box-sizing:border-box;padding:18mm;break-after:page}.page:last-child{break-after:auto}.meta,.note{color:#69736d;margin-bottom:18px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 7px;border-bottom:1px solid #e5e0d8}th{background:#eef4ef}.total{text-align:right;font-size:20px;font-weight:700;margin-top:18px}.error{color:#a33}.warning{color:#9a6a19}.ok{color:#2f6d5a}@media print{body{margin:0}}
    </style></head><body>
    <section class="page"><h1>${escape(projectName || "Wardrobe design")}</h1><div class="meta">Generated ${new Date().toLocaleString()} · ${escape(config.roomShape)}</div><h2>Project summary</h2><p>Room width: ${config.width} cm · Height: ${config.height} cm · Depth: ${config.depth} cm</p><p>Cabinets: ${config.units.length} · Accessories: ${config.items.length}</p><div class="total">Total: €${total.toFixed(2)}</div></section>
    <section class="page"><h1>Views and dimensions</h1><h2>Top/front view data</h2><table><thead><tr><th>Object</th><th>X</th><th>Z</th><th>Dimensions</th></tr></thead><tbody>${planRows || `<tr><td colspan="4">No objects added yet.</td></tr>`}</tbody></table><p class="note">Coordinates and dimensions are generated from the same source used by the interactive 2D, Front and 3D views.</p></section>
    <section class="page"><h1>Bill of materials</h1><table><thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead><tbody>${lines}</tbody></table><div class="total">Total: €${total.toFixed(2)}</div>${warnings ? `<h2>Validation report</h2><ul>${warnings}</ul>` : `<p class="ok">No validation warnings.</p>`}</section></body></html>`);
    report.document.close();
    report.focus();
    report.setTimeout(() => report.print(), 250);
  };

  const toggleFullscreen = () => {
    const next = !fullscreen;
    setFullscreen(next);
    try {
      if (next) void document.documentElement.requestFullscreen?.();
      else if (document.fullscreenElement) void document.exitFullscreen?.();
    } catch {
      /* browser fullscreen is best-effort only */
    }
  };

  const setCameraPreset = (preset: "perspective" | "front" | "side" | "top") => {
    window.dispatchEvent(new CustomEvent("wardrobe-camera-preset", { detail: preset }));
  };

  const controlsNode = isModular ? (
    <ModularPanel
      config={config}
      projectName={projectName}
      setConfig={setConfig}
      selectedId={selectedUnit}
      setSelectedId={setSelectedUnit}
      selectedUnitIds={selectedUnitIds}
      setSelectedUnitIds={setSelectedUnitIds}
      validationIssues={validationIssues}
      presets={presets}
      onRemovePreset={(id) => setPresets(removePreset(id))}
      savedKitchenLayouts={savedKitchenLayouts}
      onSaveKitchenLayout={(name) => setSavedKitchenLayouts(saveKitchenLayout(config, name))}
      onRemoveKitchenLayout={(id) => setSavedKitchenLayouts(removeKitchenLayout(id))}
      onDuplicate={unitActions.onDuplicate}
      editInterior={editInterior}
      onToggleEditInterior={interior.onToggleEditInterior}
      selectedFitting={selectedFitting}
      onSelectFitting={setSelectedFitting}
    />
  ) : (
    <LeftPanel
      config={config}
      setConfig={setConfig}
      activeWall={activeWall}
      activeBay={activeBay}
      setActive={setActive}
      doorSel={doorSel}
      setDoorSel={setDoorSel}
      onEnterAssembly={() => setAssemblyWorkspace(true)}
    />
  );

  const sceneNode = (
    <ClientOnly
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Preparing 3D viewport…
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading 3D model…
          </div>
        }
      >
        {viewMode === "2d" ? (
          <PlanView
            config={config}
            selectedUnitId={selectedUnit}
            activeWall={activeWall}
            activeBay={activeBay}
            setActive={setActive}
            setConfigTransient={setConfigTransientValue}
            beginTransaction={beginTransaction}
            commitTransaction={commitTransaction}
            cancelTransaction={cancelTransaction}
            setSelectedUnit={setSelectedUnit}
            showGrid={showGrid && !cleanPreview}
          />
        ) : viewMode === "front" ? (
          <FrontView
            config={config}
            selectedUnitId={selectedUnit}
            activeWall={activeWall}
            activeBay={activeBay}
            setActive={setActive}
            setSelectedUnit={setSelectedUnit}
            showGrid={showGrid && !cleanPreview}
          />
        ) : isModular ? (
          <ModularScene
            units={config.units}
            room={config.modularRoom}
            selectedId={selectedUnit}
            selectedIds={selectedUnitIds}
            onSelect={selectModularUnit}
            beginTransaction={beginTransaction}
            commitTransaction={commitTransaction}
            cancelTransaction={cancelTransaction}
            onMove={(id, x, z) =>
              setConfigState((c) => ({
                ...c,
                units: c.units.map((u) => (u.id === id ? { ...u, x, z } : u)),
              }))
            }
            onTransform={(id, x, y, z) => patchUnit(id, { x, y, z })}
            actions={unitActions}
            interior={interior}
            showDimensions={config.showDimensions}
            drawersOpen={config.openDrawers ?? false}
            invalidUnitIds={[
              ...new Set(
                validationIssues
                  .filter((issue) => issue.severity === "error" && issue.unitId)
                  .map((issue) => issue.unitId!),
              ),
            ]}
          />
        ) : (
          <Scene
            config={config}
            activeWall={activeWall}
            activeBay={activeBay}
            setActive={setActive}
            doorSel={doorSel}
            onSelectDoor={setDoorSel}
            onMoveItem={(id, wall, bay, y) =>
              setConfigState((c) => ({
                ...c,
                items: c.items.map((i) => (i.id === id ? { ...i, wall, bay, y } : i)),
              }))
            }
            onDeleteItem={(id) => {
              setConfigState((c) => ({ ...c, items: c.items.filter((i) => i.id !== id) }));
              toast("Item removed");
            }}
          />
        )}
      </Suspense>
    </ClientOnly>
  );

  /** Floating viewport toolbar — full screen + panel visibility. */
  const viewportToolbar = (
    <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
      <div className="hidden items-center gap-1 rounded-lg border border-border bg-card/90 p-1 backdrop-blur sm:flex">
        <Button
          variant={viewMode === "2d" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-[10px]"
          onClick={() => setViewMode("2d")}
          title="Open 2D top plan"
        >
          2D Plan
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 gap-1 px-2 text-[10px] ${showGrid ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setShowGrid((value) => !value)}
          title={showGrid ? "Hide grid" : "Show grid"}
        >
          <Grid3X3 className="size-3" />
          Grid
        </Button>
        <Button
          variant={viewMode === "front" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-[10px]"
          onClick={() => setViewMode("front")}
          title="Open technical front elevation"
        >
          Front
        </Button>
        {(["perspective", "front", "side", "top"] as const).map((preset) => (
          <Button
            key={preset}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] capitalize"
            onClick={() => {
              setViewMode("3d");
              setCameraPreset(preset);
            }}
            title={`Camera ${preset} view`}
          >
            {preset === "perspective" ? "3D" : preset}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 backdrop-blur sm:hidden">
        <Button
          variant={viewMode === "3d" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2 text-[10px]"
          onClick={() => setViewMode("3d")}
        >
          3D
        </Button>
        <Button
          variant={viewMode === "2d" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2 text-[10px]"
          onClick={() => setViewMode("2d")}
        >
          2D
        </Button>
        <Button
          variant={viewMode === "front" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2 text-[10px]"
          onClick={() => setViewMode("front")}
        >
          Front
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`size-8 ${showGrid ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setShowGrid((value) => !value)}
          aria-label={showGrid ? "Hide grid" : "Show grid"}
        >
          <Grid3X3 className="size-3.5" />
        </Button>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-9 bg-card/90 backdrop-blur"
        aria-label="Reset camera"
        title="Reset camera"
        onClick={() => window.dispatchEvent(new CustomEvent("wardrobe-camera-reset"))}
      >
        <RotateCcw className="size-4" />
      </Button>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 sm:size-8"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("wardrobe-camera-zoom", { detail: 0.78 }))
          }
        >
          <ZoomIn className="size-3.5 sm:size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 sm:size-8"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("wardrobe-camera-zoom", { detail: 1.28 }))
          }
        >
          <ZoomOut className="size-3.5 sm:size-4" />
        </Button>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-9 bg-card/90 backdrop-blur"
        aria-label={cleanPreview ? "Exit clean preview" : "Open client presentation"}
        title={cleanPreview ? "Exit client presentation" : "Open client presentation"}
        onClick={() => setCleanPreview((value) => !value)}
      >
        {cleanPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
      {!isMobile && (
        <Button
          variant="outline"
          size="icon"
          className="size-9 bg-card/90 backdrop-blur"
          aria-label={panelOpen ? "Hide controls" : "Show controls"}
          title={panelOpen ? "Hide controls" : "Show controls"}
          onClick={() => setPanelOpen((v) => !v)}
        >
          {panelOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
        </Button>
      )}
      <Button
        variant="outline"
        size="icon"
        className="size-9 bg-card/90 backdrop-blur"
        aria-label={fullscreen ? "Exit full screen" : "Full screen focus view"}
        title={fullscreen ? "Exit full screen" : "Full screen focus view"}
        onClick={toggleFullscreen}
      >
        {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </Button>
      {contextMenu && isModular && (
        <div
          className="fixed z-50 min-w-44 rounded-xl border border-border bg-card p-1.5 text-xs shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-accent"
            onClick={() => {
              setSelectedUnit(contextMenu.id);
              setPanelOpen(true);
              setContextMenu(null);
            }}
          >
            Edit properties
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-accent"
            onClick={() => {
              unitActions.onDuplicate(contextMenu.id);
              setContextMenu(null);
            }}
          >
            Duplicate
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-accent"
            onClick={() => {
              const unit = config.units.find((candidate) => candidate.id === contextMenu.id);
              if (unit) clipboard.current = { ...unit };
              toast.success("Cabinet copied");
              setContextMenu(null);
            }}
          >
            Copy
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-destructive hover:bg-destructive/10"
            onClick={() => {
              unitActions.onDelete(contextMenu.id);
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  const presetBar = (
    <PresetBar
      presets={presets}
      onInsert={insertPreset}
      onDelete={(id) => {
        setPresets(removePreset(id));
        toast("Preset deleted");
      }}
    />
  );

  const hint = (
    <div className="pointer-events-none absolute bottom-3 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 glass-bar text-center text-[11px] text-muted-foreground shadow-sm">
      <MousePointer2 className="size-3.5 shrink-0" />
      {isMobile
        ? "One finger rotates · two fingers zoom/pan · select then drag a cabinet · double-tap to focus"
        : "Select then drag a cabinet · right-drag to orbit · Shift/middle-drag to pan · scroll to zoom · double-click / F to focus"}
    </div>
  );

  /** Mobile: controls live in a swipeable bottom sheet. */
  const mobileSheetNode = (
    <Drawer open={mobileSheet} onOpenChange={setMobileSheet}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-sm">Configurator</DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mb-3 grid grid-cols-2 gap-2 px-3 sm:grid-cols-3">
            <Button size="sm" className="h-10 gap-2" onClick={share} disabled={busy}>
              <Link2 className="size-4" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2"
              onClick={saveProjectToLibrary}
            >
              <Save className="size-4" />
              Save
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportPdf}>
              <FileDown className="size-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportDesign}>
              <FileDown className="size-4" />
              JSON
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportCsv}>
              <FileDown className="size-4" />
              BOM CSV
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={resetDesign}>
              <Trash2 className="size-4" />
              Clear
            </Button>
          </div>
          {controlsNode}
          <RightPanel
            config={config}
            onReset={resetDesign}
            validationIssues={validationIssues}
            selectedUnit={config.units.find((unit) => unit.id === selectedUnit) ?? null}
            onPatchUnit={(patch) => selectedUnit && patchUnit(selectedUnit, patch)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );

  return (
    <div className="flex h-screen min-h-[100dvh] flex-col bg-background font-sans">
      {!fullscreen && (
        <header className="glass-bar z-20 m-2 flex shrink-0 items-center justify-between gap-2 rounded-2xl px-3 py-2.5 sm:m-3 sm:flex-wrap sm:gap-3 sm:px-5 sm:py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Boxes className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-sm leading-tight font-semibold text-foreground sm:text-lg">
                {isAssemblyWorkspace ? "Modular Assembly Planner" : "Custom 3D Wardrobe Planner"}
              </h1>
              <p className="text-[11px] text-muted-foreground">Configure · Visualise · Order</p>
            </div>
          </div>
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card/70 p-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!configHistory.canUndo}
                onClick={configHistory.undo}
                title="Undo"
              >
                <Undo2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!configHistory.canRedo}
                onClick={configHistory.redo}
                title="Redo"
              >
                <Redo2 className="size-4" />
              </Button>
            </div>
            {validationIssues.length > 0 && (
              <div
                className={`hidden items-center gap-1 rounded-full px-3 py-1.5 text-xs sm:flex ${validationErrors.length ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}
                title={validationIssues.map((issue) => issue.message).join("\n")}
              >
                <AlertTriangle className="size-3.5" />
                {validationErrors.length
                  ? `${validationErrors.length} issue${validationErrors.length === 1 ? "" : "s"}`
                  : "Review"}
              </div>
            )}
            {isModular && (
              <>
                <Button size="sm" className="gap-2" onClick={() => addCabinet("door")}>
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Add New Cabinet</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => addCabinet("double")}>
                  2-door
                </Button>
              </>
            )}
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              aria-label="Project name"
              placeholder="Project name"
              className="h-9 w-40 rounded-lg border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary"
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={toggleFullscreen}>
              <Maximize2 className="size-4" />
              <span className="hidden sm:inline">Full Screen</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setShowOnboarding(true)}
              title="Show quick guide"
              aria-label="Show quick guide"
            >
              <CircleHelp className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowRecentProjects(true)}
            >
              <Clock3 className="size-4" />
              <span className="hidden sm:inline">Recent</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportPdf}>
              <FileDown className="size-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportDesign}>
              <FileDown className="size-4" />
              <span className="hidden sm:inline">Export JSON</span>
            </Button>
            <input
              ref={importInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importDesign(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => importInput.current?.click()}
            >
              <FileUp className="size-4" />
              <span className="hidden sm:inline">Import JSON</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
              <FileDown className="size-4" />
              <span className="hidden sm:inline">BOM CSV</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportPng}>
              <FileDown className="size-4" />
              <span className="hidden sm:inline">Preview PNG</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={saveProjectToLibrary}>
              <Save className="size-4" />
              <span className="hidden sm:inline">Save Project</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={resetDesign}>
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
            <Button size="sm" className="gap-2" disabled={busy} onClick={share}>
              <Link2 className="size-4" />
              <span className="hidden sm:inline">Share with Client</span>
            </Button>
            <div className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground lg:block">
              {isModular
                ? `${config.units.length} cabinet${config.units.length === 1 ? "" : "s"}`
                : `${config.items.length} accessory${config.items.length === 1 ? "" : "ies"}`}
            </div>
            <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-primary-foreground">
              <span className="text-[11px] tracking-wider uppercase opacity-80">Total</span>
              <span className="font-display text-base font-semibold tabular-nums">
                €{total.toFixed(2)}
              </span>
            </div>
            <span className="hidden text-[10px] text-muted-foreground lg:inline">
              {saveState === "saved" ? "Auto-saved" : "Saving…"}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1 sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              disabled={!configHistory.canUndo}
              onClick={configHistory.undo}
              aria-label="Undo"
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              disabled={!configHistory.canRedo}
              onClick={configHistory.redo}
              aria-label="Redo"
            >
              <Redo2 className="size-4" />
            </Button>
            {isModular && (
              <Button
                size="icon"
                className="size-9 shrink-0"
                onClick={() => addCabinet("door")}
                aria-label="Add cabinet"
              >
                <Plus className="size-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => setMobileSheet(true)}
              aria-label="Open controls"
            >
              <SlidersHorizontal className="size-4" />
            </Button>
            <div className="ml-1 flex min-w-0 items-center rounded-full bg-primary px-3 py-1.5 text-primary-foreground">
              <span className="font-display text-sm font-semibold tabular-nums">
                €{total.toFixed(2)}
              </span>
            </div>
          </div>
        </header>
      )}

      {fullscreen || isMobile ? (
        /* Focus view: canvas fills the screen, controls float above it. */
        <main className="relative min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          <div className="absolute inset-0">{sceneNode}</div>
          {!cleanPreview && presetBar}
          {viewportToolbar}
          {!cleanPreview && hint}
          {!isMobile && panelOpen && !cleanPreview && (
            <aside className="absolute top-3 bottom-3 left-3 z-10 w-[340px] overflow-y-auto rounded-2xl border border-border bg-panel/95 shadow-xl backdrop-blur">
              {controlsNode}
              <RightPanel
                config={config}
                onReset={resetDesign}
                validationIssues={validationIssues}
                selectedUnit={config.units.find((unit) => unit.id === selectedUnit) ?? null}
                onPatchUnit={(patch) => selectedUnit && patchUnit(selectedUnit, patch)}
              />
            </aside>
          )}
          {isMobile && (
            <>
              <Button
                size="sm"
                className="absolute bottom-[max(3.5rem,calc(1rem+env(safe-area-inset-bottom)))] left-1/2 z-20 -translate-x-1/2 gap-2 rounded-full px-4 shadow-lg"
                onClick={() => setMobileSheet(true)}
              >
                <SlidersHorizontal className="size-4" />
                Controls · €{total.toFixed(2)}
              </Button>
              {mobileSheetNode}
            </>
          )}
        </main>
      ) : (
        <main
          className={`grid min-h-0 flex-1 gap-3 overflow-y-auto px-3 pb-3 lg:overflow-hidden ${
            panelOpen ? "lg:grid-cols-[330px_1fr_330px]" : "lg:grid-cols-1"
          }`}
        >
          {panelOpen && !cleanPreview && (
            <aside className="rounded-2xl bg-panel lg:overflow-y-auto">{controlsNode}</aside>
          )}

          <section className="relative order-first h-[55vh] min-h-80 overflow-hidden rounded-2xl bg-secondary shadow-sm lg:order-none lg:h-auto">
            {sceneNode}
            {!cleanPreview && presetBar}
            {viewportToolbar}
            {!cleanPreview && hint}
          </section>

          {panelOpen && !cleanPreview && (
            <aside className="rounded-2xl bg-panel lg:overflow-y-auto">
              <RightPanel
                config={config}
                onReset={resetDesign}
                validationIssues={validationIssues}
                selectedUnit={config.units.find((unit) => unit.id === selectedUnit) ?? null}
                onPatchUnit={(patch) => selectedUnit && patchUnit(selectedUnit, patch)}
              />
            </aside>
          )}
        </main>
      )}

      <SavePresetDialog
        unit={presetUnit}
        open={!!presetTarget}
        onOpenChange={(v) => !v && setPresetTarget(null)}
        onSave={commitPreset}
      />
      <OnboardingDialog open={showOnboarding} onOpenChange={setShowOnboarding} />
      <RecentProjectsDialog
        open={showRecentProjects}
        projects={recentProjects}
        onOpenChange={setShowRecentProjects}
        onLoad={openRecentProject}
        onLoadVersion={openRecentVersion}
        onDelete={(id) => setRecentProjects(removeRecentProject(id))}
      />
    </div>
  );
}
