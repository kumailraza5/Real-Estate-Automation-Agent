import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appointmentsTable, agentsTable } from "@workspace/db";
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
  res.json(ListAppointmentsResponse.parse(rows));
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
  const row = await db.select(withAgent).from(appointmentsTable).leftJoin(agentsTable, eq(appointmentsTable.assignedAgentId, agentsTable.id)).where(eq(appointmentsTable.id, appt.id));
  res.status(201).json(CreateAppointmentResponse.parse(row[0]));
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
  res.json(GetAppointmentResponse.parse(rows[0]));
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
  const setData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startTime) setData.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime) setData.endTime = new Date(parsed.data.endTime);
  const [updated] = await db.update(appointmentsTable).set(setData).where(eq(appointmentsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  const row = await db.select(withAgent).from(appointmentsTable).leftJoin(agentsTable, eq(appointmentsTable.assignedAgentId, agentsTable.id)).where(eq(appointmentsTable.id, updated.id));
  res.json(UpdateAppointmentResponse.parse(row[0]));
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
