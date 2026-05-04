/** Workspace context — allows App.tsx to open files/terminals as mosaic tiles */
import { createContext, useContext, useCallback, useState } from "react";
import type { MosaicNode } from "react-mosaic-component";
import type { ViewId } from "../components/MosaicLayout";

interface WorkspaceContextType {
  openFile: (path: string) => Promise<void>;
  openTerminal: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  openFile: async () => {},
  openTerminal: () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [openFile, setOpenFile] = useState<(path: string) => Promise<void>>(
    async () => {},
  );
  const [openTerminal, setOpenTerminal] = useState<() => void>(() => {});
  const [getLayout, setGetLayout] = useState<() => MosaicNode<ViewId> | null>(
    () => null,
  );

  const registerOpenFile = useCallback(
    (fn: (path: string) => Promise<void>) => {
      setOpenFile(() => fn);
    },
    [],
  );

  const registerOpenTerminal = useCallback((fn: () => void) => {
    setOpenTerminal(() => fn);
  }, []);

  const registerGetLayout = useCallback(
    (fn: () => MosaicNode<ViewId> | null) => {
      setGetLayout(() => fn);
    },
    [],
  );

  return (
    <WorkspaceContext.Provider value={{ openFile, openTerminal }}>
      {children}
      <Registrar
        registerOpenFile={registerOpenFile}
        registerOpenTerminal={registerOpenTerminal}
        registerGetLayout={registerGetLayout}
      />
    </WorkspaceContext.Provider>
  );
}

function Registrar({
  registerOpenFile,
  registerOpenTerminal,
  registerGetLayout,
}: {
  registerOpenFile: (fn: (path: string) => Promise<void>) => void;
  registerOpenTerminal: (fn: () => void) => void;
  registerGetLayout: (fn: () => MosaicNode<ViewId> | null) => void;
}) {
  return null;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

// Global accessors for non-React code
let _globalOpenFile: ((path: string) => Promise<void>) | null = null;
let _globalOpenTerminal: (() => void) | null = null;
let _globalOpenChat: (() => void) | null = null;
let _getLayout: (() => MosaicNode<ViewId> | null) | null = null;

export function setGlobalOpenFile(fn: (path: string) => Promise<void>) {
  _globalOpenFile = fn;
}

export function setGlobalOpenTerminal(fn: () => void) {
  _globalOpenTerminal = fn;
}

export function setGlobalOpenChat(fn: () => void) {
  _globalOpenChat = fn;
}

export function setGetLayout(fn: () => MosaicNode<ViewId> | null) {
  _getLayout = fn;
}

export function globalOpenFile(path: string) {
  return _globalOpenFile?.(path);
}

export function globalOpenTerminal() {
  return _globalOpenTerminal?.();
}

export function globalOpenChat() {
  return _globalOpenChat?.();
}

export function getMosaicLayout(): MosaicNode<ViewId> | null {
  return _getLayout?.() ?? null;
}
