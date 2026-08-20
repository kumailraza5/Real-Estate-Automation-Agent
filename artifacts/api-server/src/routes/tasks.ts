import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, tasksTable, agentsTable, leadsTable } from "@workspace/db";
import { automationEngine } from "../engine/automationEngine";
import {
  ListTasksQueryParams,
  ListTasksResponse,
  CreateTaskBody,
  CreateTaskResponse,
  GetTaskParams,
  GetTaskResponse,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const withAgent = {
  id: tasksTable.id,
  title: tasksTable.title,
  description: tasksTable.description,
  type: tasksTable.type,
  status: tasksTable.status,
  priority: tasksTable.priority,
  dueDate: tasksTable.dueDate,
  dueTime: tasksTable.dueTime,
  assignedAgentId: tasksTable.assignedAgentId,
  assignedAgentName: agentsTable.name,
  leadId: tasksTable.leadId,
  leadName: sql<string>`trim(concat(${leadsTable.firstName}, ' ', coalesce(${leadsTable.lastName}, '')))`,
  clientId: tasksTable.clientId,
  sourceWorkflowId: tasksTable.sourceWorkflowId,
  sourceWorkflowName: tasksTable.sourceWorkflowName,
  isAutomated: tasksTable.isAutomated,
  createdAt: tasksTable.createdAt,
};

router.get("/tasks", async (req, res): Promise<void> => {
  const qp = ListTasksQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }
  let rows = await db
    .select(withAgent)
    .from(tasksTable)
    .leftJoin(agentsTable, eq(tasksTable.assignedAgentId, agentsTable.id))
    .leftJoin(leadsTable, eq(tasksTable.leadId, leadsTable.id))
    .orderBy(desc(tasksTable.createdAt));
  if (qp.data.status) rows = rows.filter((t) => t.status === qp.data.status);
  if (qp.data.type) rows = rows.filter((t) => t.type === qp.data.type);
  if (qp.data.assignedAgentId != null) rows = rows.filter((t) => t.assignedAgentId === qp.data.assignedAgentId);
  if (qp.data.dueDate) rows = rows.filter((t) => t.dueDate === qp.data.dueDate);
  res.json(ListTasksResponse.parse(JSON.parse(JSON.stringify(rows))));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db.insert(tasksTable).values(parsed.data).returning();
  const row = await db.select(withAgent).from(tasksTable).leftJoin(agentsTable, eq(tasksTable.assignedAgentId, agentsTable.id)).leftJoin(leadsTable, eq(tasksTable.leadId, leadsTable.id)).where(eq(tasksTable.id, task.id));
  res.status(201).json(CreateTaskResponse.parse(JSON.parse(JSON.stringify(row[0]))));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db.select(withAgent).from(tasksTable).leftJoin(agentsTable, eq(tasksTable.assignedAgentId, agentsTable.id)).leftJoin(leadsTable, eq(tasksTable.leadId, leadsTable.id)).where(eq(tasksTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(GetTaskResponse.parse(JSON.parse(JSON.stringify(rows[0]))));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [updated] = await db.update(tasksTable).set(parsed.data).where(eq(tasksTable.id, params.data.id)).returning();

  // Trigger Automation Engine
  const isNewlyCompleted = existing.status !== "completed" && updated.status === "completed";
  const eventName = isNewlyCompleted ? "TASK_COMPLETED" : "TASK_UPDATED";
  await automationEngine.triggerEvent(eventName, {
    entityType: "task",
    entityId: updated.id,
    entityName: updated.title,
    data: {
      id: updated.id,
      title: updated.title,
      type: updated.type,
      status: updated.status,
      priority: updated.priority,
      leadId: updated.leadId,
      assignedAgentId: updated.assignedAgentId,
      sourceWorkflowId: updated.sourceWorkflowId,
      isAutomated: updated.isAutomated,
    },
  });

  const rows = await db.select(withAgent).from(tasksTable).leftJoin(agentsTable, eq(tasksTable.assignedAgentId, agentsTable.id)).leftJoin(leadsTable, eq(tasksTable.leadId, leadsTable.id)).where(eq(tasksTable.id, params.data.id));
  res.json(UpdateTaskResponse.parse(JSON.parse(JSON.stringify(rows[0]))));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
