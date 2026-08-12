export const NEXYS_DOCK_CONTROL_IDS = [
  "chat",
  "upload",
  "ideas",
  "task",
  "search",
] as const;

export type NexysDockControlId = (typeof NEXYS_DOCK_CONTROL_IDS)[number];

export interface NexysDockControlDefinition {
  readonly id: NexysDockControlId;
  readonly label: string;
  readonly route: string | null;
}

/**
 * The locked ZAR NEXYS dock. Chat and Upload are universal controls;
 * Ideas, Task, and Search are the three direct controls of the Operate Desk.
 * History is intentionally not included because it remains a Console option
 * outside the five-button Dock.
 */
export const NEXYS_DOCK_CONTROLS: readonly NexysDockControlDefinition[] = [
  { id: "chat", label: "Chat", route: "/chat" },
  { id: "upload", label: "Upload", route: null },
  { id: "ideas", label: "Ideas", route: "/desk/ideas" },
  { id: "task", label: "Task", route: "/desk/task" },
  { id: "search", label: "Search", route: null },
];

export function getNexysDockControl(controlId: NexysDockControlId): NexysDockControlDefinition {
  const control = NEXYS_DOCK_CONTROLS.find((candidate) => candidate.id === controlId);
  if (!control) throw new Error(`Missing NEXYS dock control: ${controlId}`);
  return control;
}
