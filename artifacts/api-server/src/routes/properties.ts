import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, propertiesTable, agentsTable, appointmentsTable } from "@workspace/db";
import { automationEngine } from "../engine/automationEngine";
import {
  ListPropertiesQueryParams,
  ListPropertiesResponse,
  CreatePropertyBody,
  CreatePropertyResponse,
  GetPropertyParams,
  GetPropertyResponse,
  UpdatePropertyParams,
  UpdatePropertyBody,
  UpdatePropertyResponse,
  DeletePropertyParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const withAgent = {
  id: propertiesTable.id,
  title: propertiesTable.title,
  address: propertiesTable.address,
  city: propertiesTable.city,
  price: propertiesTable.price,
  type: propertiesTable.type,
  status: propertiesTable.status,
  bedrooms: propertiesTable.bedrooms,
  bathrooms: propertiesTable.bathrooms,
  area: propertiesTable.area,
  description: propertiesTable.description,
  imageUrl: propertiesTable.imageUrl,
  assignedAgentId: propertiesTable.assignedAgentId,
  assignedAgentName: agentsTable.name,
  createdAt: propertiesTable.createdAt,
};

const formatProperty = (p: any) =>
  p
    ? JSON.parse(
        JSON.stringify({
          ...p,
          price: p.price != null ? Number(p.price) : 0,
          area: p.area != null ? Number(p.area) : 0,
          bedrooms: p.bedrooms != null ? Number(p.bedrooms) : 0,
          bathrooms: p.bathrooms != null ? Number(p.bathrooms) : 0,
        })
      )
    : p;

router.get("/properties", async (req, res): Promise<void> => {
  const qp = ListPropertiesQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }
  let rows = await db
    .select(withAgent)
    .from(propertiesTable)
    .leftJoin(agentsTable, eq(propertiesTable.assignedAgentId, agentsTable.id))
    .orderBy(desc(propertiesTable.createdAt));
  if (qp.data.status) rows = rows.filter((p) => p.status === qp.data.status);
  if (qp.data.type) rows = rows.filter((p) => p.type === qp.data.type);
  res.json(ListPropertiesResponse.parse(rows.map(formatProperty)));
});

router.post("/properties", async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const insertData = {
    ...parsed.data,
    price: String(parsed.data.price),
    area: String(parsed.data.area),
  };
  const [prop] = await db.insert(propertiesTable).values(insertData).returning();

  // Trigger Automation Engine
  await automationEngine.triggerEvent("PROPERTY_LISTED", {
    entityType: "property",
    entityId: prop.id,
    entityName: prop.title,
    data: {
      id: prop.id,
      title: prop.title,
      type: prop.type,
      status: prop.status,
      price: Number(prop.price || 0),
      city: prop.city,
      assignedAgentId: prop.assignedAgentId,
    },
  });

  const row = await db.select(withAgent).from(propertiesTable).leftJoin(agentsTable, eq(propertiesTable.assignedAgentId, agentsTable.id)).where(eq(propertiesTable.id, prop.id));
  res.status(201).json(CreatePropertyResponse.parse(formatProperty(row[0])));
});

router.get("/properties/:id", async (req, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db.select(withAgent).from(propertiesTable).leftJoin(agentsTable, eq(propertiesTable.assignedAgentId, agentsTable.id)).where(eq(propertiesTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json(GetPropertyResponse.parse(formatProperty(rows[0])));
});

router.patch("/properties/:id", async (req, res): Promise<void> => {
  const params = UpdatePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Fetch existing record BEFORE updating so we can detect state transitions
  const [existing] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const updateData = {
    ...parsed.data,
    price: parsed.data.price != null ? String(parsed.data.price) : undefined,
    area: parsed.data.area != null ? String(parsed.data.area) : undefined,
  };
  const [updated] = await db.update(propertiesTable).set(updateData).where(eq(propertiesTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  // Determine event based on actual status transition:
  // PROPERTY_SOLD fires ONLY when transitioning FROM non-sold INTO sold.
  // All other edits (including edits on already-sold properties) fire PROPERTY_UPDATED.
  const transitionedToSold = existing.status !== "sold" && updated.status === "sold";
  const eventName = transitionedToSold ? "PROPERTY_SOLD" : "PROPERTY_UPDATED";

  const eventData = {
    id: updated.id,
    title: updated.title,
    type: updated.type,
    status: updated.status,
    price: Number(updated.price || 0),
    city: updated.city,
    assignedAgentId: updated.assignedAgentId,
  };

  const previousData = {
    id: existing.id,
    title: existing.title,
    type: existing.type,
    status: existing.status,
    price: Number(existing.price || 0),
    city: existing.city,
    assignedAgentId: existing.assignedAgentId,
  };

  // Trigger Automation Engine with previousData so state-transition guard works
  await automationEngine.triggerEvent(eventName, {
    entityType: "property",
    entityId: updated.id,
    entityName: updated.title,
    data: eventData,
    previousData,
  });

  const row = await db.select(withAgent).from(propertiesTable).leftJoin(agentsTable, eq(propertiesTable.assignedAgentId, agentsTable.id)).where(eq(propertiesTable.id, updated.id));
  res.json(UpdatePropertyResponse.parse(formatProperty(row[0])));
});

router.delete("/properties/:id", async (req, res): Promise<void> => {
  const params = DeletePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const propertyId = params.data.id;

  // Delete associated appointments to avoid foreign key constraints
  await db.delete(appointmentsTable).where(eq(appointmentsTable.propertyId, propertyId));

  const [prop] = await db.delete(propertiesTable).where(eq(propertiesTable.id, propertyId)).returning();
  if (!prop) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
