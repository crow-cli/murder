import { useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Mosaic,
  MosaicNode,
  MosaicWindow,
} from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import "./index.css";

type View = "editor" | "terminal" | "chat" | "inspector";

const INITIAL_LAYOUT: MosaicNode<View> = {
  direction: "row",
  first: {
    direction: "column",
    first: "editor",
    second: "terminal",
    splitPercentage: 50,
  },
  second: "chat",
  splitPercentage: 70,
};

const TITLE_MAP: Record<View, string> = {
  editor: "📝 Editor",
  terminal: "📟 Terminal",
  chat: "💬 Agent Chat",
  inspector: "🌳 Layout Tree",
};

function Inspector({ layout }: { layout: MosaicNode<View> | null }) {
  return (
    <div className="w-full h-full font-mono text-xs text-green-400 p-4 overflow-auto bg-[#0f0a1a]">
      <h3 className="text-white mb-2 border-b border-gray-700 pb-1">
        Current Mosaic Tree
      </h3>
      <pre className="whitespace-pre-wrap break-all">
        {layout
          ? JSON.stringify(layout, null, 2)
          : "Waiting for layout change..."}
      </pre>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Reset Layout
      </button>
    </div>
  );
}

function App() {
  const [layout, setLayout] = useState<MosaicNode<View> | null>(INITIAL_LAYOUT);

  const renderTile = (view: View, path: (string | number)[]) => {
    if (view === "inspector") {
      return (
        <MosaicWindow<View>
          path={path}
          title={TITLE_MAP[view]}
          toolbarControls={[]}
        >
          <Inspector layout={layout} />
        </MosaicWindow>
      );
    }
    return (
      <MosaicWindow<View>
        path={path}
        title={TITLE_MAP[view]}
        toolbarControls={[]}
      >
        <div className="w-full h-full p-4 flex flex-col items-center justify-center text-sm overflow-auto bg-[#14101f]">
          <div className="text-gray-400">
            <p className="text-2xl mb-2">
              {view === "editor" ? "💻" : view === "terminal" ? "⌨️" : "🤖"}
            </p>
            <p>{TITLE_MAP[view]} Content Placeholder</p>
            <p className="text-xs mt-2 opacity-50">
              Drag tabs or borders to resize/split
            </p>
          </div>
        </div>
      </MosaicWindow>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-screen h-screen bg-[#14101f]">
        <Mosaic<View>
          value={layout}
          onChange={(newLayout) => setLayout(newLayout)}
          renderTile={renderTile}
          className="mosaic-blueprint-theme"
        />
      </div>
    </DndProvider>
  );
}

export default App;
