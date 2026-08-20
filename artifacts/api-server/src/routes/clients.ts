import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, clientsTable, notesTable, activityLogsTable, agentsTable, tasksTable, appointmentsTable } from "@workspace/db";
import { automationEngine } from "../engine/automationEngine";
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
  leadId: clientsTable.leadId,
  createdAt: clientsTable.createdAt,
};

const formatClient = (c: any) =>
  c
    ? JSON.parse(
        JSON.stringify({
          ...c,
          budget: c.budget != null ? Number(c.budget) : null,
        })
      )
    : c;

router.get("/clients", async (req, res): Promise<void> => {
  const rows = await db
    .select(withAgent)
    .from(clientsTable)
    .leftJoin(agentsTable, eq(clientsTable.assignedAgentId, agentsTable.id))
    .orderBy(desc(clientsTable.createdAt));
  res.json(ListClientsResponse.parse(rows.map(formatClient)));
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const insertData = {
    ...parsed.data,
    budget: parsed.data.budget != null ? String(parsed.data.budget) : undefined,
  };
  const [client] = await db.insert(clientsTable).values(insertData).returning();
  await db.insert(activityLogsTable).values({
    action: "created",
    entityType: "client",
    entityId: client.id,
    description: `Client ${client.firstName} ${client.lastName} was added to CRM`,
    performedBy: "system",
  });
  const row = await db.select(withAgent).from(clientsTable).leftJoin(agentsTable, eq(clientsTable.assignedAgentId, agentsTable.id)).where(eq(clientsTable.id, client.id));

  // Trigger Automation Engine
  await automationEngine.triggerEvent("CLIENT_CREATED", {
    entityType: "client",
    entityId: client.id,
    entityName: `${client.firstName} ${client.lastName}`,
    data: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      status: client.status,
      budget: Number(client.budget || 0),
      preferredPropertyType: client.preferredPropertyType,
      assignedAgentId: client.assignedAgentId,
      leadId: client.leadId,
    },
  });

  res.status(201).json(CreateClientResponse.parse(formatClient(row[0])));
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
  res.json(GetClientResponse.parse(formatClient(rows[0])));
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
  const [existing] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const updateData = {
    ...parsed.data,
    budget: parsed.data.budget != null ? String(parsed.data.budget) : undefined,
  };
  const [updated] = await db.update(clientsTable).set(updateData).where(eq(clientsTable.id, params.data.id)).returning();

  const row = await db.select(withAgent).from(clientsTable).leftJoin(agentsTable, eq(clientsTable.assignedAgentId, agentsTable.id)).where(eq(clientsTable.id, updated.id));

  // Trigger Automation Engine
  await automationEngine.triggerEvent("CLIENT_UPDATED", {
    entityType: "client",
    entityId: updated.id,
    entityName: `${updated.firstName} ${updated.lastName}`,
    data: {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      status: updated.status,
      budget: Number(updated.budget || 0),
      preferredPropertyType: updated.preferredPropertyType,
      assignedAgentId: updated.assignedAgentId,
      leadId: updated.leadId,
    },
    previousData: {
      id: existing.id,
      firstName: existing.firstName,
      lastName: existing.lastName,
      status: existing.status,
      budget: Number(existing.budget || 0),
      preferredPropertyType: existing.preferredPropertyType,
      assignedAgentId: existing.assignedAgentId,
      leadId: existing.leadId,
    }
  });

  res.json(UpdateClientResponse.parse(formatClient(row[0])));
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const clientId = params.data.id;

  // Delete associated tasks and appointments to avoid foreign key constraints
  await db.delete(tasksTable).where(eq(tasksTable.clientId, clientId));
  await db.delete(appointmentsTable).where(eq(appointmentsTable.clientId, clientId));

  const [client] = await db.delete(clientsTable).where(eq(clientsTable.id, clientId)).returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  
  // Trigger Automation Engine
  await automationEngine.triggerEvent("CLIENT_DELETED", {
    entityType: "client",
    entityId: client.id,
    entityName: `${client.firstName} ${client.lastName}`,
    data: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      status: client.status,
      budget: Number(client.budget || 0),
      preferredPropertyType: client.preferredPropertyType,
      assignedAgentId: client.assignedAgentId,
      leadId: client.leadId,
    },
  });

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
  res.json(GetClientNotesResponse.parse(JSON.parse(JSON.stringify(notes))));
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
  res.status(201).json(CreateClientNoteResponse.parse(JSON.parse(JSON.stringify(note))));
});

// Activity
router.get("/clients/:id/activity", async (req, res): Promise<void> => {
  const params = GetClientActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await db.select().from(activityLogsTable).where(and(eq(activityLogsTable.entityType, "client"), eq(activityLogsTable.entityId, params.data.id))).orderBy(activityLogsTable.createdAt);
  res.json(GetClientActivityResponse.parse(JSON.parse(JSON.stringify(logs))));
});

export default router;
