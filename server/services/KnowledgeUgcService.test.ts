import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ items: [] as any[] }));

vi.mock("./appState", () => ({
  readAppState: vi.fn(async () => state.items),
  writeAppState: vi.fn(async (_scope: string, _key: string, items: any[]) => {
    state.items = items;
    return true;
  }),
}));

import {
  listKnowledgeUgcWebsites,
  saveKnowledgeUgcWebsite,
  searchKnowledgeUgcWebsites,
} from "./KnowledgeUgcService";

describe("Knowledge UGC websites", () => {
  beforeEach(() => {
    state.items = [];
  });

  it("stores an explicitly selected browser page with provenance and de-duplicates its URL", async () => {
    const first = await saveKnowledgeUgcWebsite({
      userId: "user-owner",
      visitId: "visit-one",
      url: "https://example.com/topic#section",
      title: "Topic source",
      text: "A source selected by the user.",
      visitedAt: "2026-08-12T10:00:00.000Z",
    });
    const second = await saveKnowledgeUgcWebsite({
      userId: "user-owner",
      visitId: "visit-two",
      url: "https://example.com/topic",
      title: "Updated topic source",
      text: "Updated captured content.",
      visitedAt: "2026-08-12T11:00:00.000Z",
    });

    expect(second.id).toBe(first.id);
    expect(second.category).toBe("ugc");
    expect(second.provenance).toEqual({
      source: "live_browser",
      selection: "explicit_user_save",
      capturedAt: "2026-08-12T11:00:00.000Z",
    });
    expect(await listKnowledgeUgcWebsites("user-owner")).toHaveLength(1);
  });

  it("retrieves saved websites by title, URL, or captured content", async () => {
    await saveKnowledgeUgcWebsite({
      userId: "user-owner",
      visitId: "visit-one",
      url: "https://example.com/architecture",
      title: "Architecture reference",
      text: "A detailed source about provenance and systems.",
      visitedAt: "2026-08-12T10:00:00.000Z",
    });

    const results = await searchKnowledgeUgcWebsites("user-owner", "provenance systems");
    expect(results.map((item) => item.title)).toEqual(["Architecture reference"]);
  });
});
