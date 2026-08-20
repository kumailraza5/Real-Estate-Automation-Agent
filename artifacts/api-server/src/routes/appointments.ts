import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appointmentsTable, agentsTable } from "@workspace/db";
import { automationEngine } from "../engine/automationEngine";
import {
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  CreateAppointmentBody,
  CreateAppointmentResponse,
  GetAppointmentParams,
  GetAppointmentResponse,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
  UpdateAppointmentResponse,
  DeleteAppointmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const withAgent = {
  id: appointmentsTable.id,
  title: appointmentsTable.title,
  description: appointmentsTable.description,
  type: appointmentsTable.type,
  startTime: appointmentsTable.startTime,
  endTime: appointmentsTable.endTime,
  status: appointmentsTable.status,
  location: appointmentsTable.location,
  assignedAgentId: appointmentsTable.assignedAgentId,
  assignedAgentName: agentsTable.name,
  leadId: appointmentsTable.leadId,
  clientId: appointmentsTable.clientId,
  propertyId: appointmentsTable.propertyId,
  createdAt: appointmentsTable.createdAt,
};

router.get("/appointments", async (req, res): Promise<void> => {
  const qp = ListAppointmentsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }
  let rows = await db
    .select(withAgent)
    .from(appointmentsTable)
    .leftJoin(agentsTable, eq(appointmentsTable.assignedAgentId, agentsTable.id))
    .orderBy(appointmentsTable.startTime);
  if (qp.data.type) rows = rows.filter((a) => a.type === qp.data.type);
  res.json(ListAppointmentsResponse.parse(JSON.parse(JSON.stringify(rows))));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = {
    ...parsed.data,
    startTime: new Date(parsed.data.startTime),
    endTime: new Date(parsed.data.endTime),
  };
  const [appt] = await db.insert(appointmentsTable).values(data).returning();

  // Trigger Automation Engine
  await automationEngine.triggerEvent("VIEWING_SCHEDULED", {
    entityType: "appointment",
    entityId: appt.id,
    entityName: appt.title,
    data: {
      id: appt.id,
      title: appt.title,
      type: appt.type,
      status: appt.status,
      leadId: appt.leadId,
      clientId: appt.clientId,
      propertyId: appt.propertyId,
      assignedAgentId: appt.assignedAgentId,
    },
  });

  const row = await db.select(withAgent).from(appointmentsTable).leftJoin(agentsTable, eq(appointmentsTable.assignedAgentId, agentsTable.id)).where(eq(appointmentsTable.id, appt.id));
  res.status(201).json(CreateAppointmentResponse.parse(JSON.parse(JSON.stringify(row[0]))));
});

router.get("/appointments/:id", async (req, res): Promise<void> => {
  const params = GetAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db.select(withAgent).from(appointmentsTable).leftJoin(agentsTable, eq(appointmentsTable.assignedAgentId, agentsTable.id)).where(eq(appointmentsTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.json(GetAppointmentResponse.parse(JSON.parse(JSON.stringify(rows[0]))));
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const params = UpdateAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const setData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startTime) setData.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime) setData.endTime = new Date(parsed.data.endTime);
  const [updated] = await db.update(appointmentsTable).set(setData).where(eq(appointmentsTable.id, params.data.id)).returning();

  const eventData = {
    id: updated.id,
    title: updated.title,
    type: updated.type,
    status: updated.status,
    leadId: updated.leadId,
    clientId: updated.clientId,
    propertyId: updated.propertyId,
    assignedAgentId: updated.assignedAgentId,
  };

  const previousData = {
    id: existing.id,
    title: existing.title,
    type: existing.type,
    status: existing.status,
    leadId: existing.leadId,
    clientId: existing.clientId,
    propertyId: existing.propertyId,
    assignedAgentId: existing.assignedAgentId,
  };

  // Trigger Automation Engine
  const eventName = (updated.status === "completed" && existing.status !== "completed") ? "VIEWING_COMPLETED" : "APPOINTMENT_UPDATED";
  await automationEngine.triggerEvent(eventName, {
    entityType: "appointment",
    entityId: updated.id,
    entityName: updated.title,
    data: eventData,
    previousData,
  });
  const row = await db.select(withAgent).from(appointmentsTable).leftJoin(agentsTable, eq(appointmentsTable.assignedAgentId, agentsTable.id)).where(eq(appointmentsTable.id, updated.id));
  res.json(UpdateAppointmentResponse.parse(JSON.parse(JSON.stringify(row[0]))));
});

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const params = DeleteAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [appt] = await db.delete(appointmentsTable).where(eq(appointmentsTable.id, params.data.id)).returning();
  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
