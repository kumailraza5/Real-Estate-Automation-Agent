import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, leadsTable, notesTable, activityLogsTable, agentsTable, tasksTable, appointmentsTable, clientsTable } from "@workspace/db";
import { automationEngine } from "../engine/automationEngine";
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

const LEAD_STATUS_ORDER = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed', 'converted'];
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
    .orderBy(desc(leadsTable.createdAt));

  let filtered = leads;
  if (qp.data.status) {
    filtered = filtered.filter((l) => l.status === qp.data.status);
  }
  if (qp.data.assignedAgentId != null) {
    filtered = filtered.filter((l) => l.assignedAgentId === qp.data.assignedAgentId);
  }
  
  const mapped = filtered.map(l => ({
    ...l,
    budget: l.budget != null ? Number(l.budget) : null
  }));
  

  res.json(ListLeadsResponse.parse(JSON.parse(JSON.stringify(mapped))));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.assignedAgentId) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, parsed.data.assignedAgentId));
    if (agent && agent.status === "inactive") {
      res.status(400).json({ error: "Cannot assign to an inactive agent" });
      return;
    }
  }
  const insertData = {
    ...parsed.data,
    budget: parsed.data.budget != null ? String(parsed.data.budget) : undefined,
  };
  const [lead] = await db.insert(leadsTable).values(insertData).returning();
  // Log activity
  await db.insert(activityLogsTable).values({
    action: "created",
    entityType: "lead",
    entityId: lead.id,
    description: `Lead ${lead.firstName} ${lead.lastName} was created`,
    performedBy: "system",
  });

  await automationEngine.triggerEvent("LEAD_CREATED", {
    entityType: "lead",
    entityId: lead.id,
    entityName: `${lead.firstName} ${lead.lastName}`,
    data: {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      status: lead.status,
      score: lead.score,
      source: lead.source,
      budget: Number(lead.budget || 0),
      propertyType: lead.propertyType,
      notes: lead.notes,
      assignedAgentId: lead.assignedAgentId,
    },
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
    
  const leadData = row[0];
  if (leadData.budget != null) leadData.budget = Number(leadData.budget) as any;
  res.status(201).json(CreateLeadResponse.parse(JSON.parse(JSON.stringify(leadData))));
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
      clientId: clientsTable.id,
    })
    .from(leadsTable)
    .leftJoin(agentsTable, eq(leadsTable.assignedAgentId, agentsTable.id))
    .leftJoin(clientsTable, eq(clientsTable.leadId, leadsTable.id))
    .where(eq(leadsTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const leadData = rows[0];
  if (leadData.budget != null) leadData.budget = Number(leadData.budget) as any;
  res.json(GetLeadResponse.parse(JSON.parse(JSON.stringify(leadData))));
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
  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (parsed.data.assignedAgentId && parsed.data.assignedAgentId !== existing.assignedAgentId) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, parsed.data.assignedAgentId));
    if (agent && agent.status === "inactive") {
      res.status(400).json({ error: "Cannot assign to an inactive agent" });
      return;
    }
  }

  if (parsed.data.status && parsed.data.status !== existing.status) {
    const currentIndex = LEAD_STATUS_ORDER.indexOf(existing.status);
    const newIndex = LEAD_STATUS_ORDER.indexOf(parsed.data.status);
    if (newIndex < currentIndex) {
      res.status(400).json({ error: "Cannot move pipeline backwards" });
      return;
    }
  }

  const updateData = {
    ...parsed.data,
    budget: parsed.data.budget != null ? String(parsed.data.budget) : undefined,
  };
  const [updated] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, params.data.id)).returning();

  await db.insert(activityLogsTable).values({
    action: "updated",
    entityType: "lead",
    entityId: updated.id,
    description: `Lead ${updated.firstName} ${updated.lastName} was updated`,
    performedBy: "system",
  });

  const eventData = {
    id: updated.id,
    firstName: updated.firstName,
    lastName: updated.lastName,
    email: updated.email,
    status: updated.status,
    score: updated.score,
    source: updated.source,
    budget: Number(updated.budget || 0),
    propertyType: updated.propertyType,
    notes: updated.notes,
    assignedAgentId: updated.assignedAgentId,
  };
  const previousData = {
    id: existing.id,
    firstName: existing.firstName,
    lastName: existing.lastName,
    email: existing.email,
    status: existing.status,
    score: existing.score,
    source: existing.source,
    budget: Number(existing.budget || 0),
    propertyType: existing.propertyType,
    notes: existing.notes,
    assignedAgentId: existing.assignedAgentId,
  };
  
  if (JSON.stringify(eventData) !== JSON.stringify(previousData)) {
    await automationEngine.triggerEvent("LEAD_UPDATED", {
      entityType: "lead",
      entityId: updated.id,
      entityName: `${updated.firstName} ${updated.lastName}`,
      data: eventData,
      previousData: previousData
    });
  }
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
    
  const leadData = row[0];
  if (leadData.budget != null) leadData.budget = Number(leadData.budget) as any;
  res.json(UpdateLeadResponse.parse(JSON.parse(JSON.stringify(leadData))));
});

router.post("/leads/:id/convert", async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const leadId = params.data.id;
  
  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(leadsTable).where(eq(leadsTable.id, leadId));
      if (!existing) {
        throw new Error("Lead not found");
      }
      
      if (existing.status === "converted") {
        throw new Error("Lead is already converted");
      }

      const [client] = await tx.insert(clientsTable).values({
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email,
        phone: existing.phone,
        status: "prospect",
        budget: existing.budget,
        preferredPropertyType: existing.propertyType,
        assignedAgentId: existing.assignedAgentId,
        leadId: existing.id,
      }).returning();
      
      const [updatedLead] = await tx.update(leadsTable).set({
        status: "converted",
      }).where(eq(leadsTable.id, leadId)).returning();

      await tx.insert(activityLogsTable).values({
        action: "converted",
        entityType: "lead",
        entityId: leadId,
        description: `Lead converted to Client ${client.firstName} ${client.lastName}`,
        performedBy: "system",
      });

      await tx.insert(activityLogsTable).values({
        action: "created",
        entityType: "client",
        entityId: client.id,
        description: `Client created from Lead conversion (Lead ID: ${leadId})`,
        performedBy: "system",
      });
      
      return { client, existing, updatedLead };
    });

    // Trigger Automations outside transaction
    await automationEngine.triggerEvent("CLIENT_CREATED", {
      entityType: "client",
      entityId: result.client.id,
      entityName: `${result.client.firstName} ${result.client.lastName}`,
      data: {
        id: result.client.id,
        firstName: result.client.firstName,
        lastName: result.client.lastName,
        status: result.client.status,
        budget: Number(result.client.budget || 0),
        preferredPropertyType: result.client.preferredPropertyType,
        assignedAgentId: result.client.assignedAgentId,
        leadId: result.client.leadId,
      },
    });
    
    await automationEngine.triggerEvent("LEAD_UPDATED", {
      entityType: "lead",
      entityId: result.updatedLead.id,
      entityName: `${result.updatedLead.firstName} ${result.updatedLead.lastName}`,
      data: {
        id: result.updatedLead.id,
        firstName: result.updatedLead.firstName,
        lastName: result.updatedLead.lastName,
        email: result.updatedLead.email,
        status: result.updatedLead.status,
        score: result.updatedLead.score,
        source: result.updatedLead.source,
        budget: Number(result.updatedLead.budget || 0),
        propertyType: result.updatedLead.propertyType,
        assignedAgentId: result.updatedLead.assignedAgentId,
      },
      previousData: {
        id: result.existing.id,
        firstName: result.existing.firstName,
        lastName: result.existing.lastName,
        email: result.existing.email,
        status: result.existing.status,
        score: result.existing.score,
        source: result.existing.source,
        budget: Number(result.existing.budget || 0),
        propertyType: result.existing.propertyType,
        assignedAgentId: result.existing.assignedAgentId,
      }
    });

    res.status(200).json({ success: true, clientId: result.client.id });
  } catch (err: any) {
    if (err.message === "Lead not found") {
      res.status(404).json({ error: err.message });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const leadId = params.data.id;
  
  // Delete associated tasks and appointments to avoid foreign key constraints
  await db.delete(tasksTable).where(eq(tasksTable.leadId, leadId));
  await db.delete(appointmentsTable).where(eq(appointmentsTable.leadId, leadId));
  
  const [lead] = await db.delete(leadsTable).where(eq(leadsTable.id, leadId)).returning();
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
  res.json(GetLeadNotesResponse.parse(JSON.parse(JSON.stringify(notes))));
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
  res.status(201).json(CreateLeadNoteResponse.parse(JSON.parse(JSON.stringify(note))));
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
  res.json(GetLeadActivityResponse.parse(JSON.parse(JSON.stringify(logs))));
});

export default router;
