import { Router } from "express";
import { runSuite } from "./suite";
export const evalRouter = Router();
evalRouter.post("/run", async (_req, res) => {
  const r = await runSuite();
  res.json({ ok: r.every(x=>x.ok), checks: r });
});
export default evalRouter;
