import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, agentsTable } from "@workspace/db";
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
  clientId: tasksTable.clientId,
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
    .orderBy(tasksTable.createdAt);
  if (qp.data.status) rows = rows.filter((t) => t.status === qp.data.status);
  if (qp.data.type) rows = rows.filter((t) => t.type === qp.data.type);
  if (qp.data.assignedAgentId != null) rows = rows.filter((t) => t.assignedAgentId === qp.data.assignedAgentId);
  if (qp.data.dueDate) rows = rows.filter((t) => t.dueDate === qp.data.dueDate);
  res.json(ListTasksResponse.parse(rows));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db.insert(tasksTable).values(parsed.data).returning();
  const row = await db.select(withAgent).from(tasksTable).leftJoin(agentsTable, eq(tasksTable.assignedAgentId, agentsTable.id)).where(eq(tasksTable.id, task.id));
  res.status(201).json(CreateTaskResponse.parse(row[0]));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db.select(withAgent).from(tasksTable).leftJoin(agentsTable, eq(tasksTable.assignedAgentId, agentsTable.id)).where(eq(tasksTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(GetTaskResponse.parse(rows[0]));
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
  const [updated] = await db.update(tasksTable).set(parsed.data).where(eq(tasksTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const row = await db.select(withAgent).from(tasksTable).leftJoin(agentsTable, eq(tasksTable.assignedAgentId, agentsTable.id)).where(eq(tasksTable.id, updated.id));
  res.json(UpdateTaskResponse.parse(row[0]));
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
