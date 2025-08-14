import { embed } from "../memory/embeddings";
import { searchChunks } from "../memory/semantic";
import { prisma } from "../../db/prisma";

export async function retrieve(query: string, topk: number) {
  const qv = await embed(query);
  const hits = await searchChunks(qv, topk);
  const docs = await prisma.doc.findMany({ where: { id: { in: [...new Set(hits.map(h=>h.docId))] } } });
  const byId = new Map(docs.map(d => [d.id, d]));
  return hits.map(h => ({ uri: byId.get(h.docId)?.uri || undefined, title: byId.get(h.docId)?.title || undefined, text: h.text }));
}
