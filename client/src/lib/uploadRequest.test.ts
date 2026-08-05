import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadRequest } from "./uploadRequest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("uploadRequest", () => {
  it("returns a successful JSON upload response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ files: [{ id: "file-1" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));

    const result = await uploadRequest<{ files: Array<{ id: string }> }>(
      "/api/upload",
      new FormData(),
    );

    expect(result.files[0].id).toBe("file-1");
  });

  it("surfaces the server's actual failure message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "report.pdf: Failed to parse PDF" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
    ));

    await expect(uploadRequest("/api/upload", new FormData())).rejects.toThrow(
      "report.pdf: Failed to parse PDF",
    );
  });

  it("aborts a stalled upload and returns a recoverable timeout message", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    ));

    await expect(
      uploadRequest("/api/upload", new FormData(), { timeoutMs: 5 }),
    ).rejects.toThrow("The upload timed out. Check your connection and try again.");
  });
});

