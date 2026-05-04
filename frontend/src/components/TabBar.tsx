import { FileIcon } from "../lib/file-icons";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { IconClose } from "../lib/icons";

export interface OpenFile {
  path: string;
  language: string;
}

interface TabBarProps {
  openFiles: OpenFile[];
  activePath: string | null;
  dirtyFiles: Set<string>;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
}

export function TabBar({
  openFiles,
  activePath,
  dirtyFiles,
  onTabClick,
  onTabClose,
}: TabBarProps) {
  if (openFiles.length === 0) return null;

  return (
    <div className="flex bg-[var(--color-background-dark)] border-b border-[var(--color-border)] overflow-x-auto shrink-0 h-[35px]">
      {openFiles.map((file) => {
        const isActive = file.path === activePath;
        const isDirty = dirtyFiles.has(file.path);
        const fileName = file.path.split("/").pop() || file.path;

        return (
          <div
            key={file.path}
            className="flex items-center gap-1.5 px-3 text-[13px] cursor-pointer select-none border-r border-[var(--color-border)] min-w-0 relative transition-colors"
            style={{
              backgroundColor: isActive ? "var(--color-card)" : "transparent",
              color: isActive ? "var(--color-foreground)" : "var(--color-foreground-dim)",
            }}
            onClick={() => onTabClick(file.path)}
          >
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-[var(--color-primary)]" />
            )}
            <FileIcon name={fileName} size={12} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">
              {fileName}
            </span>
            {isDirty && (
              <span className="text-[8px] leading-none text-[var(--color-primary)]">●</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-5 w-5 p-0 rounded-sm text-[var(--color-active)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-border)]"
              style={{
                color: isActive ? undefined : "transparent",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.path);
              }}
            >
              <IconClose size={14} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
