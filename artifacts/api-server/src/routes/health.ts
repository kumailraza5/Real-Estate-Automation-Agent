import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

import { checkAppointments, checkOverdueTasks } from "../engine/scheduler";

if (process.env.NODE_ENV !== "production") {
  router.post("/test/scheduler", async (req, res) => {
    await checkAppointments();
    await checkOverdueTasks();
    res.json({ status: "scheduler executed manually" });
  });
}

export default router;
