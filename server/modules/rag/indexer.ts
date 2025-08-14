import { prisma } from "../../db/prisma";
import { embed } from "../memory/embeddings";

export async function indexText({ title, uri, text }: { title?: string; uri?: string; text: string }) {
  const doc = await prisma.doc.create({ data: { source: "upload", uri, title } });
  const chunks = chunk(text, 800, 120);
  let ord = 0, count=0;
  for (const ch of chunks) {
    const v = await embed(ch);
    await prisma.docChunk.create({ data: { docId: doc.id, ord: ord++, text: ch, embedding: v as any } });
    count++;
  }
  return { docId: doc.id, chunks: count };
}

function chunk(s: string, size: number, overlap: number) {
  const arr: string[] = [];
  for (let i=0;i<s.length;i+= (size-overlap)) arr.push(s.slice(i, i+size));
  return arr;
}
