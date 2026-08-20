import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import {
  ListNotificationsQueryParams,
  ListNotificationsResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const qp = ListNotificationsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }
  // Newest-first ordering
  let rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt));
  if (qp.data.read !== undefined) {
    // zod.coerce.boolean() coerces any non-empty string to true.
    // Re-parse the raw query string to get the correct boolean value.
    const readRaw = req.query["read"];
    const readVal = readRaw === "true";
    rows = rows.filter((n) => n.isRead === readVal);
  }
  res.json(ListNotificationsResponse.parse(JSON.parse(JSON.stringify(rows))));
});

// IMPORTANT: /read-all must be registered BEFORE /:id/read to avoid
// Express matching "read-all" as the :id parameter.
router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  await db.update(notificationsTable).set({ isRead: true });
  res.json({ success: true });
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [notif] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, params.data.id)).returning();
  if (!notif) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(MarkNotificationReadResponse.parse(JSON.parse(JSON.stringify(notif))));
});

export default router;
