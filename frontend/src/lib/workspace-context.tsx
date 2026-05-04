/** Workspace context — allows App.tsx to open files in the active mosaic tile */
import { createContext, useContext, useCallback, useState } from "react";

interface WorkspaceContextType {
  openFile: (path: string) => Promise<void>;
  openTerminal: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  openFile: async () => {},
  openTerminal: () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [handlers, setHandlers] = useState<{
    openFile?: (path: string) => Promise<void>;
    openTerminal?: () => void;
  }>({});

  const openFile = useCallback(async (path: string) => {
    if (handlers.openFile) await handlers.openFile(path);
  }, [handlers]);

  const openTerminal = useCallback(() => {
    if (handlers.openTerminal) handlers.openTerminal();
  }, [handlers]);

  const register = useCallback((h: typeof handlers) => {
    setHandlers(h);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ openFile, openTerminal }}>
      {children}
      {/* Hidden registrar component */}
      <WorkspaceRegistrar register={register} />
    </WorkspaceContext.Provider>
  );
}

function WorkspaceRegistrar({ register }: { register: (h: { openFile?: (path: string) => Promise<void>; openTerminal?: () => void }) => void }) {
  // This component doesn't render anything, it just provides the registration hook
  // The actual registration happens in MosaicLayout or WorkspacePane
  return null;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

// Global accessor for non-React code
let _globalOpenFile: ((path: string) => Promise<void>) | null = null;
let _globalOpenTerminal: (() => void) | null = null;

export function setGlobalWorkspaceHandlers(openFile: (path: string) => Promise<void>, openTerminal: () => void) {
  _globalOpenFile = openFile;
  _globalOpenTerminal = openTerminal;
}

export function globalOpenFile(path: string) {
  return _globalOpenFile?.(path);
}

export function globalOpenTerminal() {
  return _globalOpenTerminal?.();
}
