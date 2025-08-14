import { prisma } from "../../db/prisma";
import { cosineSim } from "./embeddings";

export async function searchChunks(queryVec: number[], topk=6) {
  const chunks = await prisma.docChunk.findMany({ take: 2000 }); // simple scan for SQLite
  const scored = chunks.map(c => {
    const emb = (c.embedding as any) as number[] | null;
    const score = emb ? cosineSim(queryVec, emb) : -1;
    return { c, score };
  }).sort((a,b)=>b.score-a.score).slice(0, topk);
  return scored.map(s => ({ id: s.c.id, docId: s.c.docId, ord: s.c.ord, text: s.c.text, score: s.score }));
}
