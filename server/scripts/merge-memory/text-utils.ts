import { createHash } from "crypto";
import fs from "fs/promises";

import { MAX_PREVIEW_LENGTH, type NormalizedMessage } from "./types";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    // fs.access throws on missing path *or* permission errors; for the
    // merge workflow both mean "skip this source", so the catch is
    // intentional and safe.
    return false;
  }
}

/** Collapses runs of blank lines and multi-space gaps; trims edges. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
}

/** ChatGPT exports store timestamps as seconds-since-epoch; convert to ISO. */
export function toIsoTime(input?: number | null): string | null {
  if (!input || Number.isNaN(input)) {
    return null;
  }

  const date = new Date(input * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/** 16-hex-char prefix of a sha256; used for fingerprints and content keys. */
export function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/** Strips characters that aren't safe in filenames on Windows/Linux/macOS. */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function summarizePreview(messages: NormalizedMessage[]): string {
  const body = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role}: ${message.text}`)
    .join("\n");

  return body.slice(0, MAX_PREVIEW_LENGTH).trim();
}

/**
 * Pulls text out of ChatGPT export content nodes, which can be a
 * string, a `{ parts: [...] }` object, a `{ text }` envelope, or a
 * `{ result }` tool-output envelope. Arrays are flattened with
 * newlines and re-normalized.
 */
export function extractTextFromContent(content: any): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return normalizeWhitespace(
      content.map((part) => extractTextFromContent(part)).filter(Boolean).join("\n"),
    );
  }

  if (typeof content === "object") {
    if (Array.isArray(content.parts)) {
      return extractTextFromContent(content.parts);
    }

    if (typeof content.text === "string") {
      return normalizeWhitespace(content.text);
    }

    if (typeof content.result === "string") {
      return normalizeWhitespace(content.result);
    }
  }

  return "";
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}
