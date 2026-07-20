import { Router, type IRouter } from "express";
import { db, leadsTable, propertiesTable, clientsTable, tasksTable, workflowsTable, activityLogsTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetDashboardPipelineResponse,
  GetDashboardRecentActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [leadsResult] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable);
  const [activeLeadsResult] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(
    sql`status NOT IN ('closed', 'lost')`
  );
  const [propertiesResult] = await db.select({ count: sql<number>`count(*)` }).from(propertiesTable);
  const [clientsResult] = await db.select({ count: sql<number>`count(*)` }).from(clientsTable);
  const today = new Date().toISOString().split("T")[0];
  const [tasksTodayResult] = await db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(eq(tasksTable.dueDate, today));
  const [automationsActiveResult] = await db.select({ count: sql<number>`count(*)` }).from(workflowsTable).where(eq(workflowsTable.isActive, true));
  const [dealsResult] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(eq(leadsTable.status, "closed"));
  const [revenueResult] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(budget AS numeric)), 0)`
  }).from(leadsTable).where(eq(leadsTable.status, "closed"));

  res.json(GetDashboardSummaryResponse.parse({
    totalLeads: Number(leadsResult?.count ?? 0),
    activeLeads: Number(activeLeadsResult?.count ?? 0),
    totalProperties: Number(propertiesResult?.count ?? 0),
    totalClients: Number(clientsResult?.count ?? 0),
    tasksToday: Number(tasksTodayResult?.count ?? 0),
    automationsActive: Number(automationsActiveResult?.count ?? 0),
    dealsClosedThisMonth: Number(dealsResult?.count ?? 0),
    revenueThisMonth: Number(revenueResult?.total ?? 0),
  }));
});

router.get("/dashboard/pipeline", async (req, res): Promise<void> => {
  const statuses = ["new", "contacted", "qualified", "proposal", "negotiation", "closed", "lost"];
  const rows = await db.select({
    status: leadsTable.status,
    count: sql<number>`count(*)`,
    value: sql<number>`COALESCE(SUM(CAST(budget AS numeric)), 0)`,
  }).from(leadsTable).groupBy(leadsTable.status);

  const stagesMap = new Map(rows.map((r) => [r.status, r]));
  const stages = statuses.map((status) => ({
    status,
    count: Number(stagesMap.get(status)?.count ?? 0),
    value: Number(stagesMap.get(status)?.value ?? 0),
  }));

  res.json(GetDashboardPipelineResponse.parse({ stages }));
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const logs = await db.select().from(activityLogsTable).orderBy(sql`created_at DESC`).limit(20);
  res.json(GetDashboardRecentActivityResponse.parse(JSON.parse(JSON.stringify(logs))));
});

export default router;
