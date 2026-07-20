import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, workflowsTable, workflowExecutionsTable } from "@workspace/db";
import {
  ListWorkflowsResponse,
  CreateWorkflowBody,
  CreateWorkflowResponse,
  GetWorkflowParams,
  GetWorkflowResponse,
  UpdateWorkflowParams,
  UpdateWorkflowBody,
  UpdateWorkflowResponse,
  DeleteWorkflowParams,
  ToggleWorkflowParams,
  ToggleWorkflowResponse,
  GetWorkflowExecutionsParams,
  GetWorkflowExecutionsResponse,
  ListWorkflowExecutionsQueryParams,
  ListWorkflowExecutionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/workflows", async (req, res): Promise<void> => {
  const rows = await db.select().from(workflowsTable).orderBy(workflowsTable.createdAt);
  res.json(ListWorkflowsResponse.parse(JSON.parse(JSON.stringify(rows))));
});

router.post("/workflows", async (req, res): Promise<void> => {
  const parsed = CreateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [wf] = await db.insert(workflowsTable).values(parsed.data).returning();
  res.status(201).json(CreateWorkflowResponse.parse(wf));
});

router.get("/workflows/:id", async (req, res): Promise<void> => {
  const params = GetWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [wf] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  if (!wf) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.json(GetWorkflowResponse.parse(JSON.parse(JSON.stringify(wf))));
});

router.patch("/workflows/:id", async (req, res): Promise<void> => {
  const params = UpdateWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [wf] = await db.update(workflowsTable).set(parsed.data).where(eq(workflowsTable.id, params.data.id)).returning();
  if (!wf) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.json(UpdateWorkflowResponse.parse(JSON.parse(JSON.stringify(wf))));
});

router.delete("/workflows/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [wf] = await db.delete(workflowsTable).where(eq(workflowsTable.id, params.data.id)).returning();
  if (!wf) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.sendStatus(204);
});

router.patch("/workflows/:id/toggle", async (req, res): Promise<void> => {
  const params = ToggleWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  const [wf] = await db.update(workflowsTable).set({ isActive: !existing.isActive }).where(eq(workflowsTable.id, params.data.id)).returning();
  res.json(ToggleWorkflowResponse.parse(JSON.parse(JSON.stringify(wf))));
});

router.get("/workflows/:id/executions", async (req, res): Promise<void> => {
  const params = GetWorkflowExecutionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const execs = await db
    .select({
      id: workflowExecutionsTable.id,
      workflowId: workflowExecutionsTable.workflowId,
      workflowName: workflowsTable.name,
      status: workflowExecutionsTable.status,
      triggeredBy: workflowExecutionsTable.triggeredBy,
      triggerEntityId: workflowExecutionsTable.triggerEntityId,
      actionsExecuted: workflowExecutionsTable.actionsExecuted,
      errorMessage: workflowExecutionsTable.errorMessage,
      executedAt: workflowExecutionsTable.executedAt,
    })
    .from(workflowExecutionsTable)
    .leftJoin(workflowsTable, eq(workflowExecutionsTable.workflowId, workflowsTable.id))
    .where(eq(workflowExecutionsTable.workflowId, params.data.id))
    .orderBy(workflowExecutionsTable.executedAt);
  res.json(GetWorkflowExecutionsResponse.parse(JSON.parse(JSON.stringify(execs))));
});

router.get("/workflow-executions", async (req, res): Promise<void> => {
  const qp = ListWorkflowExecutionsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }
  let rows = await db
    .select({
      id: workflowExecutionsTable.id,
      workflowId: workflowExecutionsTable.workflowId,
      workflowName: workflowsTable.name,
      status: workflowExecutionsTable.status,
      triggeredBy: workflowExecutionsTable.triggeredBy,
      triggerEntityId: workflowExecutionsTable.triggerEntityId,
      actionsExecuted: workflowExecutionsTable.actionsExecuted,
      errorMessage: workflowExecutionsTable.errorMessage,
      executedAt: workflowExecutionsTable.executedAt,
    })
    .from(workflowExecutionsTable)
    .leftJoin(workflowsTable, eq(workflowExecutionsTable.workflowId, workflowsTable.id))
    .orderBy(workflowExecutionsTable.executedAt);
  if (qp.data.status) rows = rows.filter((e) => e.status === qp.data.status);
  res.json(ListWorkflowExecutionsResponse.parse(JSON.parse(JSON.stringify(rows))));
});

export default router;
