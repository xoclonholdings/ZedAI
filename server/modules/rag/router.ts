import { Router } from "express";
import { indexText } from "./indexer";
export const ragRouter = Router();
ragRouter.post("/index", async (req, res) => {
  const { title, uri, text } = req.body || {};
  if (typeof text !== "string" || text.length < 1) return res.status(400).json({ error: "text required" });
  const out = await indexText({ title, uri, text });
  res.json(out);
});
export default ragRouter;
