import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, clientsTable, notesTable, activityLogsTable, agentsTable } from "@workspace/db";
import {
  ListClientsResponse,
  CreateClientBody,
  CreateClientResponse,
  GetClientParams,
  GetClientResponse,
  UpdateClientParams,
  UpdateClientBody,
  UpdateClientResponse,
  DeleteClientParams,
  GetClientNotesParams,
  GetClientNotesResponse,
  CreateClientNoteParams,
  CreateClientNoteBody,
  CreateClientNoteResponse,
  GetClientActivityParams,
  GetClientActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const withAgent = {
  id: clientsTable.id,
  firstName: clientsTable.firstName,
  lastName: clientsTable.lastName,
  email: clientsTable.email,
  phone: clientsTable.phone,
  status: clientsTable.status,
  budget: clientsTable.budget,
  preferredPropertyType: clientsTable.preferredPropertyType,
  assignedAgentId: clientsTable.assignedAgentId,
  assignedAgentName: agentsTable.name,
  createdAt: clientsTable.createdAt,
};

router.get("/clients", async (req, res): Promise<void> => {
  const rows = await db
    .select(withAgent)
    .from(clientsTable)
    .leftJoin(agentsTable, eq(clientsTable.assignedAgentId, agentsTable.id))
    .orderBy(clientsTable.createdAt);
  res.json(ListClientsResponse.parse(rows));
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db.insert(clientsTable).values(parsed.data).returning();
  await db.insert(activityLogsTable).values({
    action: "created",
    entityType: "client",
    entityId: client.id,
    description: `Client ${client.firstName} ${client.lastName} was added to CRM`,
    performedBy: "system",
  });
  const row = await db.select(withAgent).from(clientsTable).leftJoin(agentsTable, eq(clientsTable.assignedAgentId, agentsTable.id)).where(eq(clientsTable.id, client.id));
  res.status(201).json(CreateClientResponse.parse(row[0]));
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db.select(withAgent).from(clientsTable).leftJoin(agentsTable, eq(clientsTable.assignedAgentId, agentsTable.id)).where(eq(clientsTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(GetClientResponse.parse(rows[0]));
});

router.patch("/clients/:id", async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(clientsTable).set(parsed.data).where(eq(clientsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  const row = await db.select(withAgent).from(clientsTable).leftJoin(agentsTable, eq(clientsTable.assignedAgentId, agentsTable.id)).where(eq(clientsTable.id, updated.id));
  res.json(UpdateClientResponse.parse(row[0]));
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [client] = await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id)).returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.sendStatus(204);
});

// Notes
router.get("/clients/:id/notes", async (req, res): Promise<void> => {
  const params = GetClientNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const notes = await db.select().from(notesTable).where(and(eq(notesTable.entityType, "client"), eq(notesTable.entityId, params.data.id))).orderBy(notesTable.createdAt);
  res.json(GetClientNotesResponse.parse(notes));
});

router.post("/clients/:id/notes", async (req, res): Promise<void> => {
  const params = CreateClientNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateClientNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [note] = await db.insert(notesTable).values({ ...parsed.data, entityType: "client", entityId: params.data.id }).returning();
  res.status(201).json(CreateClientNoteResponse.parse(note));
});

// Activity
router.get("/clients/:id/activity", async (req, res): Promise<void> => {
  const params = GetClientActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await db.select().from(activityLogsTable).where(and(eq(activityLogsTable.entityType, "client"), eq(activityLogsTable.entityId, params.data.id))).orderBy(activityLogsTable.createdAt);
  res.json(GetClientActivityResponse.parse(logs));
});

export default router;
