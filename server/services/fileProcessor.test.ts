import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { processFile, resolvedMimeType } from "./fileProcessor";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "../../shared/upload-policy";

const temporaryDirectories: string[] = [];

async function temporaryFile(name: string, content: string | Buffer): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zar-upload-test-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, name);
  await fs.writeFile(filePath, content);
  return filePath;
}

async function textPdf(): Promise<Buffer> {
  const encoded = await fs.readFile(
    path.resolve("server/services/fixtures/zar-upload.pdf.base64"),
    "utf8",
  );
  return Buffer.from(encoded.trim(), "base64");
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true }),
  ));
});

describe("the shared upload processor", () => {
  it("extracts real text and preserves the original file name", async () => {
    const filePath = await temporaryFile("notes.txt", "ZAR upload verification");
    const result = await processFile(filePath, "text/plain", "notes.txt");

    expect(result.originalName).toBe("notes.txt");
    expect(result.extractedContent).toBe("ZAR upload verification");
    expect(result.error).toBeUndefined();
  });

  it("extracts JSON sent by mobile browsers as an unknown MIME type", async () => {
    const filePath = await temporaryFile("knowledge.json", '{"system":"ZAR"}');
    const result = await processFile(filePath, "application/octet-stream", "knowledge.json");

    expect(result.mimeType).toBe("application/json");
    expect(result.extractedContent).toContain('"system":"ZAR"');
    expect(result.error).toBeUndefined();
  });

  it("extracts CSV into structured content", async () => {
    const filePath = await temporaryFile("records.csv", "name,status\nZAR,active\n");
    const result = await processFile(filePath, "text/csv", "records.csv");

    expect(result.extractedContent).toContain('"name": "ZAR"');
    expect(result.analysis).toMatchObject({ type: "csv", rows: 1, columns: 2 });
  });

  it("extracts text from an actual PDF byte stream", async () => {
    const filePath = await temporaryFile("foundation.pdf", await textPdf());
    const result = await processFile(filePath, "application/pdf", "foundation.pdf");

    expect(result.error).toBeUndefined();
    expect(result.extractedContent).toContain("ZAR AI Specification");
  });

  it("rejects images instead of injecting base64 into knowledge", async () => {
    const filePath = await temporaryFile(
      "screen.png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const result = await processFile(filePath, "image/png", "screen.png");

    expect(result.extractedContent).toBeUndefined();
    expect(result.error).toContain("Image analysis is not connected yet");
  });

  it("uses one 25 MB limit across the upload pipeline", () => {
    expect(MAX_UPLOAD_FILE_SIZE_BYTES).toBe(25 * 1024 * 1024);
    expect(resolvedMimeType("notes.md", "application/octet-stream")).toBe("text/markdown");
  });
});
