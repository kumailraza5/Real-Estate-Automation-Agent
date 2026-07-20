import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { db, leadsTable, agentsTable, tasksTable, appointmentsTable, workflowsTable, workflowExecutionsTable } from "@workspace/db";
import {
  GetLeadConversionReportResponse,
  GetTeamPerformanceReportResponse,
  GetAutomationActivityReportResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reports/lead-conversion", async (req, res): Promise<void> => {
  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable);
  const [convertedResult] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(eq(leadsTable.status, "closed"));
  const total = Number(totalResult?.count ?? 0);
  const converted = Number(convertedResult?.count ?? 0);

  const bySource = await db.select({
    source: leadsTable.source,
    count: sql<number>`count(*)`,
    converted: sql<number>`SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)`,
  }).from(leadsTable).groupBy(leadsTable.source);

  const byMonth = await db.select({
    month: sql<string>`TO_CHAR(created_at, 'YYYY-MM')`,
    count: sql<number>`count(*)`,
    converted: sql<number>`SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)`,
  }).from(leadsTable).groupBy(sql`TO_CHAR(created_at, 'YYYY-MM')`).orderBy(sql`TO_CHAR(created_at, 'YYYY-MM')`);

  res.json(GetLeadConversionReportResponse.parse({
    totalLeads: total,
    converted,
    conversionRate: total > 0 ? (converted / total) * 100 : 0,
    bySource: bySource.map((r) => ({ source: r.source, count: Number(r.count), converted: Number(r.converted) })),
    byMonth: byMonth.map((r) => ({ month: r.month, count: Number(r.count), converted: Number(r.converted) })),
  }));
});

router.get("/reports/team-performance", async (req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable);
  const performance = await Promise.all(agents.map(async (agent) => {
    const [leadsAssigned] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(eq(leadsTable.assignedAgentId, agent.id));
    const [leadsClosed] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`assigned_agent_id = ${agent.id} AND status = 'closed'`);
    const [tasksCompleted] = await db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(sql`assigned_agent_id = ${agent.id} AND status = 'completed'`);
    const [appointmentsHeld] = await db.select({ count: sql<number>`count(*)` }).from(appointmentsTable).where(sql`assigned_agent_id = ${agent.id} AND status = 'completed'`);
    return {
      agentId: agent.id,
      agentName: agent.name,
      leadsAssigned: Number(leadsAssigned?.count ?? 0),
      leadsClosed: Number(leadsClosed?.count ?? 0),
      tasksCompleted: Number(tasksCompleted?.count ?? 0),
      appointmentsHeld: Number(appointmentsHeld?.count ?? 0),
    };
  }));
  res.json(GetTeamPerformanceReportResponse.parse(performance));
});

router.get("/reports/automation-activity", async (req, res): Promise<void> => {
  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(workflowExecutionsTable);
  const [successResult] = await db.select({ count: sql<number>`count(*)` }).from(workflowExecutionsTable).where(eq(workflowExecutionsTable.status, "success"));
  const total = Number(totalResult?.count ?? 0);
  const success = Number(successResult?.count ?? 0);

  const byWorkflow = await db.select({
    workflowId: workflowExecutionsTable.workflowId,
    workflowName: workflowsTable.name,
    executions: sql<number>`count(*)`,
    successes: sql<number>`SUM(CASE WHEN ${workflowExecutionsTable.status} = 'success' THEN 1 ELSE 0 END)`,
  })
    .from(workflowExecutionsTable)
    .leftJoin(workflowsTable, eq(workflowExecutionsTable.workflowId, workflowsTable.id))
    .groupBy(workflowExecutionsTable.workflowId, workflowsTable.name);

  const byTrigger = await db.select({
    trigger: workflowExecutionsTable.triggeredBy,
    count: sql<number>`count(*)`,
  }).from(workflowExecutionsTable).groupBy(workflowExecutionsTable.triggeredBy);

  res.json(GetAutomationActivityReportResponse.parse({
    totalExecutions: total,
    successRate: total > 0 ? (success / total) * 100 : 0,
    byWorkflow: byWorkflow.map((r) => ({
      workflowId: r.workflowId,
      workflowName: r.workflowName ?? "Unknown",
      executions: Number(r.executions),
      successes: Number(r.successes),
    })),
    byTrigger: byTrigger.map((r) => ({ trigger: r.trigger, count: Number(r.count) })),
  }));
});

export default router;
