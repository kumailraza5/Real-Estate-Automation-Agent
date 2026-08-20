import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agentsTable } from "@workspace/db";
import {
  CreateAgentBody,
  UpdateAgentBody,
  UpdateAgentParams,
  GetAgentParams,
  DeleteAgentParams,
  ListAgentsResponse,
  GetAgentResponse,
  CreateAgentResponse,
  UpdateAgentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/agents", async (req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.createdAt);
  res.json(ListAgentsResponse.parse(JSON.parse(JSON.stringify(agents))));
});

router.post("/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [agent] = await db.insert(agentsTable).values(parsed.data).returning();
  res.status(201).json(CreateAgentResponse.parse(JSON.parse(JSON.stringify(agent))));
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const params = GetAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, params.data.id));
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(GetAgentResponse.parse(JSON.parse(JSON.stringify(agent))));
});

router.patch("/agents/:id", async (req, res): Promise<void> => {
  const params = UpdateAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [agent] = await db.update(agentsTable).set(parsed.data).where(eq(agentsTable.id, params.data.id)).returning();
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(UpdateAgentResponse.parse(JSON.parse(JSON.stringify(agent))));
});

router.delete("/agents/:id", async (req, res): Promise<void> => {
  const params = DeleteAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [agent] = await db.delete(agentsTable).where(eq(agentsTable.id, params.data.id)).returning();
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
