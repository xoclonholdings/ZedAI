export const ENV = {
  PORT: Number(process.env.PORT || 7001),
  DB_URL: process.env.DATABASE_URL || "file:./data/zed.sqlite",
  OLLAMA_HOST: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
  ZED_MODEL: process.env.ZED_MODEL || "llama3.1:8b-instruct",
  EMBED_MODEL: process.env.EMBED_MODEL || "Xenova/bge-small-en-v1.5",
  RAG_TOPK: Number(process.env.RAG_TOPK || 6),
  MAX_STEPS: Number(process.env.MAX_STEPS || 3),
};
