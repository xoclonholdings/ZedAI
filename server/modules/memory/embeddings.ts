import { pipeline } from "@xenova/transformers";

let embedder: any;

export async function getEmbedder(model = "Xenova/bge-small-en-v1.5") {
  if (!embedder) embedder = await pipeline("feature-extraction", model);
  return embedder;
}
export async function embed(text: string): Promise<number[]> {
  const model = await getEmbedder();
  // @ts-ignore
  const out = await model(text, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}
export function cosineSim(a: number[], b: number[]) {
  let s=0; for (let i=0;i<a.length;i++) s += a[i]*b[i];
  return s;
}
