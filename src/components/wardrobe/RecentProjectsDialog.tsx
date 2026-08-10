import { useState } from "react";
import { Clock3, FolderOpen, History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectVersion, RecentProject } from "@/lib/recent-projects";

export default function RecentProjectsDialog({
  open,
  projects,
  onOpenChange,
  onLoad,
  onLoadVersion,
  onDelete,
}: {
  open: boolean;
  projects: RecentProject[];
  onOpenChange: (open: boolean) => void;
  onLoad: (project: RecentProject) => void;
  onLoadVersion: (project: RecentProject, version: ProjectVersion) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Recent designs</DialogTitle>
          <DialogDescription>
            Continue a saved local design or remove an old version.
          </DialogDescription>
        </DialogHeader>
        {projects.length ? (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <Clock3 className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{project.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(project.updatedAt).toLocaleString()} · {project.config.units.length}{" "}
                    modular units · {project.versions.length} version
                    {project.versions.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Button size="sm" onClick={() => onLoad(project)}>
                  <FolderOpen className="mr-1 size-3.5" /> Open
                </Button>
                {project.versions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setExpanded((value) => (value === project.id ? null : project.id))
                    }
                    aria-label={`Show versions of ${project.name}`}
                  >
                    <History className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(project.id)}
                  aria-label={`Delete ${project.name}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
                {expanded === project.id && (
                  <div className="ml-8 space-y-1 rounded-lg bg-muted/40 p-2">
                    {project.versions.map((version, index) => (
                      <button
                        key={version.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-background"
                        onClick={() => onLoadVersion(project, version)}
                      >
                        <span>Version {project.versions.length - index}</span>
                        <span className="text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No recent designs yet. Save your first design to see it here.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
