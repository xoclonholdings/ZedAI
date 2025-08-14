import { create } from "zustand";
// removed
type Message = { role: "user"|"assistant"|"tool"; content: string; createdAt?: string };
type Thread = { id: string; title?: string };

type State = {
  activeThreadId?: string;
  messages: Message[];
  sending: boolean;
  setThread(id: string): void;
  setMessages(ms: Message[]): void;
  setSending(v: boolean): void;
};

export const useZed = create<State>((set) => ({
  activeThreadId: undefined,
  messages: [],
  sending: false,
  setThread: (id) => set({ activeThreadId: id }),
  setMessages: (m) => set({ messages: m }),
  setSending: (v) => set({ sending: v }),
}));
