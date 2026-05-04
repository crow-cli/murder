/** Mosaic layout wrapper — replaces the old center area */
import { useState, useCallback, useRef, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Mosaic,
  MosaicNode,
  MosaicWindow,
  MosaicBranch,
} from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import WorkspacePane, { type WorkspacePaneHandle } from "./WorkspacePane";
import { setGlobalWorkspaceHandlers } from "../lib/workspace-context";

export type ViewId = string; // e.g. "ws-1", "ws-2"

interface MosaicLayoutProps {
  workspaceRoot: string | null;
}

const INITIAL_LAYOUT: MosaicNode<ViewId> = "ws-1";

export default function MosaicLayout({ workspaceRoot }: MosaicLayoutProps) {
  const [layout, setLayout] = useState<MosaicNode<ViewId>>(INITIAL_LAYOUT);
  const activePaneRef = useRef<WorkspacePaneHandle | null>(null);

  // Register global handlers so App.tsx can open files
  useEffect(() => {
    setGlobalWorkspaceHandlers(
      async (path: string) => {
        if (activePaneRef.current) {
          await activePaneRef.current.openFile(path);
        }
      },
      () => {
        if (activePaneRef.current) {
          activePaneRef.current.openTerminal();
        }
      }
    );
  }, []);

  const renderTile = useCallback((viewId: ViewId, path: MosaicBranch[]) => {
    return (
      <MosaicWindow<ViewId>
        path={path}
        title="Workspace"
        toolbarControls={[]}
        className="bg-[var(--color-background-dark)]"
      >
        <WorkspacePane
          id={viewId}
          workspaceRoot={workspaceRoot}
          onActivate={(handle) => {
            activePaneRef.current = handle;
          }}
        />
      </MosaicWindow>
    );
  }, [workspaceRoot]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-full h-full">
        <Mosaic<ViewId>
          value={layout}
          onChange={(newLayout) => {
            if (newLayout !== null) setLayout(newLayout);
          }}
          renderTile={renderTile}
          className="murder-mosaic-theme"
          resize={{ minimumPaneSizePercentage: 10 }}
        />
      </div>
    </DndProvider>
  );
}
