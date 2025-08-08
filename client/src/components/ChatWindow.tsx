import { useState } from "react";
import MemorySignalPanel from "./MemorySignalPanel";

export default function ChatWindow() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <div className="relative h-full w-full">
      <button
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700"
        onClick={() => setIsPanelOpen(true)}
      >
        Memory & Signal
      </button>
      {/* ...existing chat UI... */}
      <MemorySignalPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </div>
  );
}
