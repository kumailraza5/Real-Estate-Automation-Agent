import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, propertiesTable, agentsTable } from "@workspace/db";
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
    .orderBy(propertiesTable.createdAt);
  if (qp.data.status) rows = rows.filter((p) => p.status === qp.data.status);
  if (qp.data.type) rows = rows.filter((p) => p.type === qp.data.type);
  res.json(ListPropertiesResponse.parse(rows));
});

router.post("/properties", async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prop] = await db.insert(propertiesTable).values(parsed.data).returning();
  const row = await db.select(withAgent).from(propertiesTable).leftJoin(agentsTable, eq(propertiesTable.assignedAgentId, agentsTable.id)).where(eq(propertiesTable.id, prop.id));
  res.status(201).json(CreatePropertyResponse.parse(row[0]));
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
  res.json(GetPropertyResponse.parse(rows[0]));
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
  const [updated] = await db.update(propertiesTable).set(parsed.data).where(eq(propertiesTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const row = await db.select(withAgent).from(propertiesTable).leftJoin(agentsTable, eq(propertiesTable.assignedAgentId, agentsTable.id)).where(eq(propertiesTable.id, updated.id));
  res.json(UpdatePropertyResponse.parse(row[0]));
});

router.delete("/properties/:id", async (req, res): Promise<void> => {
  const params = DeletePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [prop] = await db.delete(propertiesTable).where(eq(propertiesTable.id, params.data.id)).returning();
  if (!prop) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
