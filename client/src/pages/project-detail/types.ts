export interface ProjectSource {
  id: string;
  label: string;
  url?: string;
  text?: string;
  notes?: string;
  addedAt: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  color: string;
  conversationIds: string[];
  instructions?: string;
  sources?: ProjectSource[];
}

export type AddSourceMode = "file" | "url" | "text";
