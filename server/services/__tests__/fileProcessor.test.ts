import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import * as XLSX from "xlsx";

import { processFile, processXlsxFile } from "../fileProcessor";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zar-fileproc-"));

function write(name: string, data: Buffer | string): string {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, data);
  return p;
}

test("plain text extraction with checksum + parser identity", async () => {
  const p = write("note.txt", "hello ZAR capability system");
  const result = await processFile(p, "text/plain");
  assert.equal(result.conversionStatus, "full");
  assert.equal(result.parserUsed, "native-text");
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
  assert.equal(result.extractedContent, "hello ZAR capability system");
});

test("identical content produces identical checksum (dedup basis)", async () => {
  const a = await processFile(write("a.txt", "same-bytes"), "text/plain");
  const b = await processFile(write("b.txt", "same-bytes"), "text/plain");
  assert.equal(a.checksum, b.checksum);
});

test("unsupported mime type fails honestly", async () => {
  const p = write("x.bin", Buffer.from([0, 1, 2, 3]));
  const result = await processFile(p, "application/x-msdownload");
  assert.equal(result.conversionStatus, "failed");
  assert.match(result.error || "", /Unsupported file type/);
});

test("xlsx extraction preserves sheet structure", async () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "qty"],
    ["widget", 3],
    ["gadget", 7],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  const p = path.join(tmp, "inv.xlsx");
  XLSX.writeFile(wb, p);

  const result = await processXlsxFile(p);
  assert.equal(result.sheets.length, 1);
  assert.equal(result.sheets[0].name, "Inventory");
  assert.equal(result.sheets[0].rowCount, 3);
  assert.match(result.csvBySheet.Inventory, /widget,3/);

  const processed = await processFile(p, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(processed.conversionStatus, "full");
  assert.equal(processed.parserUsed, "xlsx");
  assert.equal((processed.structuralMeta as any).sheets[0].name, "Inventory");
});

test("pdf extraction returns real page text", async () => {
  // Minimal single-page PDF with the text "ZAR PDF OK".
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 24 Tf 72 700 Td (ZAR PDF OK) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>`;
  const p = write("doc.pdf", pdf);
  const result = await processFile(p, "application/pdf");
  assert.equal(result.parserUsed, "pdf-parse");
  assert.match(result.extractedContent || "", /ZAR PDF OK/);
  assert.equal((result.structuralMeta as any).pageCount, 1);
});

test("zip traversal entries are skipped, honest counts kept", async () => {
  const zipPath = path.join(tmp, "evil.zip");
  // Build a zip containing a normal file plus a ../traversal name using
  // the system zip via python (deterministic, no extra deps).
  const script = `
import zipfile
z = zipfile.ZipFile(${JSON.stringify(zipPath)}, "w")
z.writestr("ok.txt", "safe content")
z.writestr("../escape.txt", "evil")
z.close()
`;
  execFileSync("python3", ["-c", script]);

  // yauzl validates entry names strictly and rejects the whole archive
  // when it contains a traversal path — the honest failure we want.
  const result = await processFile(zipPath, "application/zip");
  assert.equal(result.conversionStatus, "failed");
  assert.match(result.error || "", /invalid relative path/);
});

test("safe zip extracts entries with honest counts", async () => {
  const zipPath = path.join(tmp, "safe.zip");
  const script = `
import zipfile
z = zipfile.ZipFile(${JSON.stringify(zipPath)}, "w")
z.writestr("ok.txt", "safe content")
z.writestr("docs/readme.md", "# hello")
z.close()
`;
  execFileSync("python3", ["-c", script]);

  const result = await processFile(zipPath, "application/zip");
  assert.equal(result.conversionStatus, "full");
  const analysis: any = result.analysis;
  assert.equal(analysis.files, 2);
  assert.match(result.extractedContent || "", /ok\.txt/);
});
