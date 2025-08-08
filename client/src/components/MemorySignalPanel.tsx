import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface MemorySignalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "overview" | "signal" | "conversations" | "search";
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "signal", label: "Signal" },
  { key: "conversations", label: "Conversations" },
  { key: "search", label: "Search" },
];

export default function MemorySignalPanel({ isOpen, onClose, defaultTab = "overview" }: MemorySignalPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(defaultTab);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl border border-purple-500/30 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/20 bg-white/80 dark:bg-gray-900/80">
          <div className="font-bold text-lg text-purple-700 dark:text-purple-300">Memory & Signal</div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded hover:bg-purple-100 dark:hover:bg-purple-800">
            <X size={20} />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex border-b border-purple-500/10 bg-white/70 dark:bg-gray-900/70">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`flex-1 py-2 px-4 font-medium transition-colors ${tab === key ? "text-purple-600 dark:text-purple-300 border-b-2 border-purple-500" : "text-gray-500 dark:text-gray-400"}`}
              onClick={() => setTab(key as typeof tab)}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TODO: Wire up content for each tab */}
          <div className="text-center text-gray-500 dark:text-gray-400">Panel content for {tab}</div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-purple-500/20 bg-white/80 dark:bg-gray-900/80">
          <button className="px-4 py-2 rounded bg-purple-500 text-white font-medium hover:bg-purple-600">Sync</button>
          <button className="px-4 py-2 rounded bg-cyan-500 text-white font-medium hover:bg-cyan-600">Check Connection</button>
          <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-300 dark:hover:bg-gray-700" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
