import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, leadsTable, notesTable, activityLogsTable, agentsTable } from "@workspace/db";
import {
  ListLeadsQueryParams,
  ListLeadsResponse,
  CreateLeadBody,
  CreateLeadResponse,
  GetLeadParams,
  GetLeadResponse,
  UpdateLeadParams,
  UpdateLeadBody,
  UpdateLeadResponse,
  DeleteLeadParams,
  GetLeadNotesParams,
  GetLeadNotesResponse,
  CreateLeadNoteParams,
  CreateLeadNoteBody,
  CreateLeadNoteResponse,
  GetLeadActivityParams,
  GetLeadActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leads", async (req, res): Promise<void> => {
  const qp = ListLeadsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }
  const leads = await db
    .select({
      id: leadsTable.id,
      firstName: leadsTable.firstName,
      lastName: leadsTable.lastName,
      email: leadsTable.email,
      phone: leadsTable.phone,
      status: leadsTable.status,
      score: leadsTable.score,
      source: leadsTable.source,
      budget: leadsTable.budget,
      propertyType: leadsTable.propertyType,
      notes: leadsTable.notes,
      assignedAgentId: leadsTable.assignedAgentId,
      assignedAgentName: agentsTable.name,
      createdAt: leadsTable.createdAt,
      updatedAt: leadsTable.updatedAt,
    })
    .from(leadsTable)
    .leftJoin(agentsTable, eq(leadsTable.assignedAgentId, agentsTable.id))
    .orderBy(leadsTable.createdAt);

  let filtered = leads;
  if (qp.data.status) {
    filtered = filtered.filter((l) => l.status === qp.data.status);
  }
  if (qp.data.assignedAgentId != null) {
    filtered = filtered.filter((l) => l.assignedAgentId === qp.data.assignedAgentId);
  }
  res.json(ListLeadsResponse.parse(filtered));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [lead] = await db.insert(leadsTable).values(parsed.data).returning();
  // Log activity
  await db.insert(activityLogsTable).values({
    action: "created",
    entityType: "lead",
    entityId: lead.id,
    description: `Lead ${lead.firstName} ${lead.lastName} was created`,
    performedBy: "system",
  });
  const row = await db
    .select({
      id: leadsTable.id,
      firstName: leadsTable.firstName,
      lastName: leadsTable.lastName,
      email: leadsTable.email,
      phone: leadsTable.phone,
      status: leadsTable.status,
      score: leadsTable.score,
      source: leadsTable.source,
      budget: leadsTable.budget,
      propertyType: leadsTable.propertyType,
      notes: leadsTable.notes,
      assignedAgentId: leadsTable.assignedAgentId,
      assignedAgentName: agentsTable.name,
      createdAt: leadsTable.createdAt,
      updatedAt: leadsTable.updatedAt,
    })
    .from(leadsTable)
    .leftJoin(agentsTable, eq(leadsTable.assignedAgentId, agentsTable.id))
    .where(eq(leadsTable.id, lead.id));
  res.status(201).json(CreateLeadResponse.parse(row[0]));
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select({
      id: leadsTable.id,
      firstName: leadsTable.firstName,
      lastName: leadsTable.lastName,
      email: leadsTable.email,
      phone: leadsTable.phone,
      status: leadsTable.status,
      score: leadsTable.score,
      source: leadsTable.source,
      budget: leadsTable.budget,
      propertyType: leadsTable.propertyType,
      notes: leadsTable.notes,
      assignedAgentId: leadsTable.assignedAgentId,
      assignedAgentName: agentsTable.name,
      createdAt: leadsTable.createdAt,
      updatedAt: leadsTable.updatedAt,
    })
    .from(leadsTable)
    .leftJoin(agentsTable, eq(leadsTable.assignedAgentId, agentsTable.id))
    .where(eq(leadsTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(GetLeadResponse.parse(rows[0]));
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(leadsTable).set(parsed.data).where(eq(leadsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  await db.insert(activityLogsTable).values({
    action: "updated",
    entityType: "lead",
    entityId: updated.id,
    description: `Lead ${updated.firstName} ${updated.lastName} was updated`,
    performedBy: "system",
  });
  const row = await db
    .select({
      id: leadsTable.id,
      firstName: leadsTable.firstName,
      lastName: leadsTable.lastName,
      email: leadsTable.email,
      phone: leadsTable.phone,
      status: leadsTable.status,
      score: leadsTable.score,
      source: leadsTable.source,
      budget: leadsTable.budget,
      propertyType: leadsTable.propertyType,
      notes: leadsTable.notes,
      assignedAgentId: leadsTable.assignedAgentId,
      assignedAgentName: agentsTable.name,
      createdAt: leadsTable.createdAt,
      updatedAt: leadsTable.updatedAt,
    })
    .from(leadsTable)
    .leftJoin(agentsTable, eq(leadsTable.assignedAgentId, agentsTable.id))
    .where(eq(leadsTable.id, updated.id));
  res.json(UpdateLeadResponse.parse(row[0]));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [lead] = await db.delete(leadsTable).where(eq(leadsTable.id, params.data.id)).returning();
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.sendStatus(204);
});

// Notes
router.get("/leads/:id/notes", async (req, res): Promise<void> => {
  const params = GetLeadNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const notes = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.entityType, "lead"), eq(notesTable.entityId, params.data.id)))
    .orderBy(notesTable.createdAt);
  res.json(GetLeadNotesResponse.parse(notes));
});

router.post("/leads/:id/notes", async (req, res): Promise<void> => {
  const params = CreateLeadNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateLeadNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [note] = await db
    .insert(notesTable)
    .values({ ...parsed.data, entityType: "lead", entityId: params.data.id })
    .returning();
  res.status(201).json(CreateLeadNoteResponse.parse(note));
});

// Activity
router.get("/leads/:id/activity", async (req, res): Promise<void> => {
  const params = GetLeadActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(and(eq(activityLogsTable.entityType, "lead"), eq(activityLogsTable.entityId, params.data.id)))
    .orderBy(activityLogsTable.createdAt);
  res.json(GetLeadActivityResponse.parse(logs));
});

export default router;
