import { useState, useEffect, useCallback, useRef } from "react";
import { ws } from "../lib/ws-client";
import { FileIcon } from "../lib/file-icons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { IconClose } from "../lib/icons";
import { cn } from "../lib/utils";
import * as settings from "../lib/settings";

interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface FolderPickerProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

const HOME_PATH = "/home";

const QUICK_PICKS = [
  { label: "~", path: HOME_PATH },
  { label: "/", path: "/" },
  { label: "/tmp", path: "/tmp" },
];

export function FolderPicker({
  initialPath,
  onSelect,
  onClose,
}: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || HOME_PATH);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isHidden = (name: string): boolean => name.startsWith(".") && name !== "." && name !== "..";

  const showHidden = settings.getSettings().folderPicker.showHiddenFiles;

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await ws.invoke<{ entries: DirEntry[] }>("read_dir", {
        path,
      });
      const filtered = showHidden ? result.entries : result.entries.filter((e) => !isHidden(e.name));
      const sorted = [...filtered].sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setCurrentPath(path);
    } catch (e: any) {
      setError(`Cannot read directory: ${e.message || e}`);
      setEntries([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDir(initialPath || HOME_PATH);
  }, [initialPath, loadDir]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const navigateTo = (path: string) => {
    loadDir(path);
  };

  const navigateUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const parent = "/" + parts.join("/");
    loadDir(parent === "/" ? "/" : parent);
  };

  const handlePathInput = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLInputElement;
      loadDir(target.value);
    }
  };

  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg w-[520px] max-h-[480px] flex flex-col shadow-xl text-[var(--color-foreground)]"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <span className="text-[13px] font-semibold">Open Folder</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-border)]" onClick={onClose}>
            <IconClose size={16} />
          </Button>
        </div>

        {/* Quick picks */}
        <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-[var(--color-border)]">
          {QUICK_PICKS.map((qp) => (
            <Button
              key={qp.path}
              variant={currentPath === qp.path ? "default" : "outline"}
              size="sm"
              onClick={() => navigateTo(qp.path)}
              className={cn(
                "h-6 text-[11px] px-2 border-[var(--color-border)]",
                currentPath === qp.path
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)]/90"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]"
              )}
            >
              {qp.label}
            </Button>
          ))}
        </div>

        {/* Path input */}
        <div className="flex gap-2 px-4 py-2 border-b border-[var(--color-border)] items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={navigateUp}
            disabled={currentPath === "/"}
            className="h-7 px-2 text-xs border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] disabled:opacity-50"
          >
            ↑
          </Button>
          <Input
            ref={inputRef as any}
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={handlePathInput}
            className="h-7 text-xs bg-[var(--color-border)] border-[var(--color-active)] focus-visible:ring-[var(--color-primary)]"
          />
        </div>

        {/* Breadcrumb */}
        <div className="flex gap-1 flex-wrap items-center px-4 py-1.5 text-[11px] text-[var(--color-foreground-dim)] border-b border-[var(--color-border)]">
          <BreadcrumbLink
            path="/"
            currentPath={currentPath}
            onClick={navigateTo}
          />
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-[var(--color-border)]">/</span>
              <BreadcrumbLink
                path={"/" + pathParts.slice(0, i + 1).join("/")}
                currentPath={currentPath}
                onClick={navigateTo}
              >
                {part}
              </BreadcrumbLink>
            </span>
          ))}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto py-1 min-h-[200px] max-h-[260px]">
          {loading && (
            <div className="p-4 text-center text-[var(--color-muted-foreground)]">Loading...</div>
          )}
          {error && (
            <div className="p-4 text-center text-[var(--color-destructive)] text-[12px]">
              {error}
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="p-4 text-center text-[var(--color-muted-foreground)] text-[12px]">
              Empty directory
            </div>
          )}
          {entries.map((entry) => (
            <div
              key={entry.path}
              onClick={() => {
                if (entry.is_dir) navigateTo(entry.path);
              }}
              className="flex items-center gap-2 px-4 py-1 text-[13px] transition-colors"
              style={{
                cursor: entry.is_dir ? "pointer" : "default",
                color: entry.is_dir ? "var(--color-foreground)" : "var(--color-muted-foreground)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-border)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <FileIcon name={entry.name} isDir={entry.is_dir} size={14} />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {entry.name}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onSelect(currentPath)}
          >
            Select This Folder
          </Button>
        </div>
      </div>
    </div>
  );
}

function BreadcrumbLink({
  path,
  currentPath,
  onClick,
  children,
}: {
  path: string;
  currentPath: string;
  onClick: (p: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <span
      className="cursor-pointer transition-colors"
      style={{
        color: currentPath === path ? "var(--color-primary)" : "var(--color-foreground-dim)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.color =
          currentPath === path ? "var(--color-primary)" : "var(--color-foreground-dim)")
      }
      onClick={() => onClick(path)}
    >
      {children ?? path}
    </span>
  );
}
