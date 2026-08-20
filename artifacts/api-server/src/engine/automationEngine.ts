import { db, workflowsTable, workflowExecutionsTable, tasksTable, notificationsTable, activityLogsTable, leadsTable, agentsTable, appointmentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface EventPayload {
  entityType: "lead" | "appointment" | "property" | "task" | "client";
  entityId: number;
  entityName?: string;
  data: Record<string, any>;
  previousData?: Record<string, any>;
}

export interface ConditionRule {
  field: string;
  operator: ">" | ">=" | "<" | "<=" | "==" | "!=" | "contains";
  value: any;
}

export interface ActionDefinition {
  type: "ASSIGN_SENIOR_AGENT" | "ASSIGN_AGENT" | "CREATE_TASK" | "NOTIFY_MANAGER" | "UPDATE_CRM_STATUS" | "LOG_ACTIVITY";
  params?: Record<string, any>;
}

class AutomationEngine {
  /**
   * Main entry point when an event occurs in the system.
   */
  async triggerEvent(triggerEvent: string, payload: EventPayload): Promise<number> {
    logger.info({ triggerEvent, payload }, "[AutomationEngine] Processing event");
    let executedCount = 0;

    try {
      // 1. Fetch all active workflows matching this trigger event
      const activeWorkflows = await db
        .select()
        .from(workflowsTable)
        .where(eq(workflowsTable.isActive, true));

      const matchingWorkflows = activeWorkflows.filter(
        (wf) => wf.triggerEvent === triggerEvent || wf.triggerEvent === "ANY"
      );

      logger.info(
        { triggerEvent, count: matchingWorkflows.length },
        "[AutomationEngine] Matching active workflows found"
      );

      for (const wf of matchingWorkflows) {
        let shouldExecute = this.evaluateConditions(wf.conditions, payload.data);
        
        // Prevent duplicate execution if the condition was already true before this update
        if (shouldExecute && wf.conditions && wf.conditions.trim() !== "" && wf.conditions !== "null" && payload.previousData) {
          let hasActualConditions = false;
          try {
            if (wf.conditions.startsWith("[") || wf.conditions.startsWith("{")) {
              const parsed = JSON.parse(wf.conditions);
              hasActualConditions = Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0;
            } else {
              hasActualConditions = wf.conditions.trim().length > 0;
            }
          } catch {
            hasActualConditions = false;
          }

          if (hasActualConditions) {
            const wasTrueBefore = this.evaluateConditions(wf.conditions, payload.previousData);
            if (wasTrueBefore) {
              shouldExecute = false;
              logger.info({ workflowId: wf.id, entityId: payload.entityId }, "[AutomationEngine] Skipping workflow because condition was already true");
            }
          }
        }

        if (shouldExecute) {
          await this.executeWorkflow(wf, payload);
          executedCount++;
        }
      }
    } catch (err) {
      logger.error({ err, triggerEvent }, "[AutomationEngine] Error triggering event");
    }

    return executedCount;
  }

  /**
   * Evaluates workflow conditions against event payload data.
   */
  private evaluateConditions(conditionsRaw: string | null, data: Record<string, any>): boolean {
    if (!conditionsRaw || conditionsRaw.trim() === "" || conditionsRaw === "null") {
      return true; // No condition means always execute
    }

    try {
      // Check if conditions is JSON
      if (conditionsRaw.startsWith("[") || conditionsRaw.startsWith("{")) {
        const rules: ConditionRule[] = Array.isArray(JSON.parse(conditionsRaw))
          ? JSON.parse(conditionsRaw)
          : [JSON.parse(conditionsRaw)];

        return rules.every((rule) => this.evalRule(rule, data));
      }

      // Check simple textual expression like "budget > 500000" or "score >= 80"
      return this.evalTextExpression(conditionsRaw, data);
    } catch (err) {
      logger.warn({ conditionsRaw, err }, "[AutomationEngine] Condition parse failed, defaulting to true");
      return true;
    }
  }

  private evalRule(rule: ConditionRule, data: Record<string, any>): boolean {
    const val = data[rule.field];
    if (val === undefined) return false;

    switch (rule.operator) {
      case ">":
        return Number(val) > Number(rule.value);
      case ">=":
        return Number(val) >= Number(rule.value);
      case "<":
        return Number(val) < Number(rule.value);
      case "<=":
        return Number(val) <= Number(rule.value);
      case "==":
        return String(val).toLowerCase() === String(rule.value).toLowerCase();
      case "!=":
        return String(val).toLowerCase() !== String(rule.value).toLowerCase();
      case "contains":
        return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
      default:
        return true;
    }
  }

  private evalTextExpression(expr: string, data: Record<string, any>): boolean {
    const clean = expr.trim();
    
    // Pattern: Field > Value (e.g. "budget > 500000")
    const matchGt = clean.match(/^(\w+)\s*>\s*\$?([0-9,]+)/i);
    if (matchGt) {
      const field = matchGt[1];
      const targetVal = Number(matchGt[2].replace(/,/g, ""));
      return Number(data[field] || 0) > targetVal;
    }

    // Pattern: Field >= Value
    const matchGte = clean.match(/^(\w+)\s*>=\s*\$?([0-9,]+)/i);
    if (matchGte) {
      const field = matchGte[1];
      const targetVal = Number(matchGte[2].replace(/,/g, ""));
      return Number(data[field] || 0) >= targetVal;
    }

    // Pattern: Field == Value
    const matchEq = clean.match(/^(\w+)\s*==\s*['"]?([^'"]+)['"]?/i);
    if (matchEq) {
      const field = matchEq[1];
      const targetVal = matchEq[2];
      return String(data[field] || "").toLowerCase() === targetVal.toLowerCase();
    }

    return true;
  }

  /**
   * Executes actions for a workflow and records execution history.
   */
  private async executeWorkflow(wf: any, payload: EventPayload): Promise<void> {
    let actionsExecuted = 0;
    let errorMessage: string | null = null;
    let actionResults: any[] = [];

    try {
      let actionsList: ActionDefinition[] = [];

      if (wf.actions.startsWith("[")) {
        actionsList = JSON.parse(wf.actions);
      } else {
        // Fallback for simple string action descriptions (e.g. "Assign Senior Agent, Create Follow-up")
        actionsList = this.parseSimpleActionsString(wf.actions);
      }

      for (const action of actionsList) {
        try {
          const result = await this.runAction(action, payload, wf);
          actionsExecuted++;
          actionResults.push({
            action: action.type,
            status: result?.status || "success",
            ...(result?.note ? { note: result.note } : {})
          });
        } catch (err: any) {
          actionResults.push({ action: action.type, status: "failed", error: err.message });
          throw err;
        }
      }

      // Record successful execution
      await db.insert(workflowExecutionsTable).values({
        workflowId: wf.id,
        status: "success",
        triggeredBy: `${payload.entityType}:${payload.entityId}`,
        triggerEntityId: payload.entityId,
        triggerEntityType: payload.entityType,
        triggerEntityName: payload.entityName || null,
        actionsExecuted,
        actionResults: JSON.stringify(actionResults),
        errorMessage: null,
      });

      // Update workflow counters
      await db
        .update(workflowsTable)
        .set({
          executionCount: sql`${workflowsTable.executionCount} + 1`,
          lastExecutedAt: new Date(),
        })
        .where(eq(workflowsTable.id, wf.id));

      logger.info({ workflowId: wf.id, actionsExecuted }, "[AutomationEngine] Executed workflow successfully");
    } catch (err: any) {
      errorMessage = err.message || "Action execution failed";
      logger.error({ err, workflowId: wf.id }, "[AutomationEngine] Failed executing workflow");

      await db.insert(workflowExecutionsTable).values({
        workflowId: wf.id,
        status: "failed",
        triggeredBy: `${payload.entityType}:${payload.entityId}`,
        triggerEntityId: payload.entityId,
        triggerEntityType: payload.entityType,
        triggerEntityName: payload.entityName || null,
        actionsExecuted,
        actionResults: JSON.stringify(actionResults),
        errorMessage,
      });
    }
  }

  private parseSimpleActionsString(actionsStr: string): ActionDefinition[] {
    const list: ActionDefinition[] = [];
    const lower = actionsStr.toLowerCase();

    if (lower.includes("assign senior agent") || lower.includes("assign agent")) {
      list.push({ type: "ASSIGN_SENIOR_AGENT" });
    }
    if (lower.includes("create follow-up") || lower.includes("create task") || lower.includes("reminder")) {
      list.push({ type: "CREATE_TASK" });
    }
    if (lower.includes("notify manager") || lower.includes("notify agent") || lower.includes("notify")) {
      list.push({ type: "NOTIFY_MANAGER" });
    }
    if (lower.includes("update crm") || lower.includes("move lead")) {
      list.push({ type: "UPDATE_CRM_STATUS" });
    }

    if (list.length === 0) {
      list.push({ type: "LOG_ACTIVITY" });
    }
    return list;
  }

  private async runAction(action: ActionDefinition, payload: EventPayload, wf: any): Promise<{ status: "success" | "skipped"; note?: string } | void> {
    switch (action.type) {
      case "ASSIGN_SENIOR_AGENT":
      case "ASSIGN_AGENT": {
        if (payload.entityType !== "lead") break;

        // ── Fetch current lead to check for an existing manual assignment ──
        const [currentLead] = await db
          .select({ id: leadsTable.id, assignedAgentId: leadsTable.assignedAgentId })
          .from(leadsTable)
          .where(eq(leadsTable.id, payload.entityId));

        if (!currentLead) break;

        if (currentLead.assignedAgentId != null) {
          // ── Manual assignment already exists — do NOT overwrite ──
          const [manualAgent] = await db
            .select({ name: agentsTable.name })
            .from(agentsTable)
            .where(eq(agentsTable.id, currentLead.assignedAgentId));

          const note = `⊘ Skipped — Preserved manual assignment (${manualAgent?.name ?? 'Assigned Agent'})`;

          await db.insert(activityLogsTable).values({
            action: "assigned",
            entityType: "lead",
            entityId: payload.entityId,
            description: `Workflow "${wf.name}": Agent assignment SKIPPED — ${payload.entityName || 'Lead #' + payload.entityId} is already manually assigned to ${manualAgent?.name ?? 'an agent'}. Manual assignment preserved.`,
            performedBy: "Automation Agent",
          });

          logger.info(
            { workflowId: wf.id, leadId: payload.entityId, existingAgentId: currentLead.assignedAgentId },
            "[AutomationEngine] ASSIGN_SENIOR_AGENT skipped — manual assignment preserved"
          );
          return { status: "skipped", note };
        }

        // ── No agent set — auto-assign based on workload ──
        // Workload = (open leads + pending/in-progress tasks)
        const agentStats = await db.execute(sql`
          SELECT 
            a.id, 
            a.name, 
            a.role,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = a.id AND l.status NOT IN ('closed', 'sold')) as lead_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent_id = a.id AND t.status IN ('pending', 'in-progress')) as task_count
          FROM agents a
          WHERE a.status = 'active'
        `);

        let eligibleAgents = agentStats.rows.map((row: any) => ({
          id: Number(row.id),
          name: String(row.name),
          role: String(row.role),
          workload: Number(row.lead_count) + Number(row.task_count)
        }));

        if (action.type === "ASSIGN_SENIOR_AGENT") {
          eligibleAgents = eligibleAgents.filter(a => a.role === "senior_agent" || a.role === "manager");
        }
        
        if (eligibleAgents.length === 0) {
           return { status: "failed", note: `No eligible active ${action.type === 'ASSIGN_SENIOR_AGENT' ? 'senior agents' : 'agents'} found` };
        }

        // Sort by workload ascending, then by name alphabetically as tie-breaker
        eligibleAgents.sort((a, b) => {
          if (a.workload !== b.workload) {
            return a.workload - b.workload;
          }
          return a.name.localeCompare(b.name);
        });

        const assignedAgent = eligibleAgents[0];

        if (assignedAgent) {
          await db
            .update(leadsTable)
            .set({ assignedAgentId: assignedAgent.id })
            .where(eq(leadsTable.id, payload.entityId));

          const reason = `Lowest active workload (${assignedAgent.workload} items) among eligible ${action.type === 'ASSIGN_SENIOR_AGENT' ? 'senior agents' : 'agents'}`;

          await db.insert(activityLogsTable).values({
            action: "assigned",
            entityType: "lead",
            entityId: payload.entityId,
            description: `Workflow "${wf.name}" auto-assigned ${payload.entityName || 'Lead #' + payload.entityId} to ${assignedAgent.name}. Reason: ${reason}.`,
            performedBy: "Automation Agent",
          });

          return { 
            status: "success", 
            note: `Assigned to ${assignedAgent.name} (ID: ${assignedAgent.id}). Reason: ${reason}` 
          };
        }
        break;
      }

      case "CREATE_TASK": {
        const leadId = payload.entityType === "lead" ? payload.entityId : (payload.data?.leadId ?? undefined);
        const clientId = payload.entityType === "client" ? payload.entityId : (payload.data?.clientId ?? undefined);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const defaultTitle = action.params?.title || (payload.entityName ? `Follow up with ${payload.entityName}` : `Automated Follow-up for ${payload.entityType} #${payload.entityId}`);

        await db.insert(tasksTable).values({
          title: defaultTitle,
          description: action.params?.description || `Triggered by Workflow: ${wf.name}`,
          type: action.params?.type || "follow-up",
          status: "pending",
          priority: action.params?.priority || "high",
          dueDate: tomorrow.toISOString().split("T")[0],
          dueTime: "10:00 AM",
          leadId,
          clientId,
          sourceWorkflowId: wf.id,
          sourceWorkflowName: wf.name,
          isAutomated: true,
        });

        await db.insert(activityLogsTable).values({
          action: "task_created",
          entityType: payload.entityType,
          entityId: payload.entityId,
          description: `Automated Task scheduled by Workflow "${wf.name}"`,
          performedBy: "Automation Agent",
        });
        return { status: "success" };
      }

      case "NOTIFY_MANAGER": {
        await db.insert(notificationsTable).values({
          title: `Automation Alert: ${wf.name}`,
          message: `Workflow "${wf.name}" executed for ${payload.entityName || payload.entityType + ' #' + payload.entityId}. High priority action required.`,
          type: "warning",
          isRead: false,
          entityType: payload.entityType,
          entityId: payload.entityId,
        });
        return { status: "success" };
      }

      case "UPDATE_CRM_STATUS": {
        if (payload.entityType !== "lead") break;

        const newStatus = action.params?.status || "contacted";

        // Pipeline order — automation can only move a lead FORWARD, never backward
        const pipelineOrder = ["new", "contacted", "qualified", "proposal", "negotiation", "closed", "converted"];
        const newStatusIndex = pipelineOrder.indexOf(newStatus);

        // Fetch current lead status
        const [leadStatus] = await db
          .select({ status: leadsTable.status })
          .from(leadsTable)
          .where(eq(leadsTable.id, payload.entityId));

        if (!leadStatus) break;

        const currentStatusIndex = pipelineOrder.indexOf(leadStatus.status);

        // Only update if new status is a forward move (higher index)
        if (newStatusIndex > currentStatusIndex) {
          await db
            .update(leadsTable)
            .set({ status: newStatus })
            .where(eq(leadsTable.id, payload.entityId));

          await db.insert(activityLogsTable).values({
            action: "status_change",
            entityType: "lead",
            entityId: payload.entityId,
            description: `Workflow "${wf.name}" advanced ${payload.entityName || 'Lead #' + payload.entityId} status from "${leadStatus.status}" → "${newStatus}".`,
            performedBy: "Automation Agent",
          });
          return { status: "success", note: `Advanced status to ${newStatus}` };
        } else {
          // Skip — lead is already at or past this stage
          await db.insert(activityLogsTable).values({
            action: "status_change",
            entityType: "lead",
            entityId: payload.entityId,
            description: `Workflow "${wf.name}": Status update to "${newStatus}" SKIPPED — ${payload.entityName || 'Lead #' + payload.entityId} is already at "${leadStatus.status}" (manual progression preserved).`,
            performedBy: "Automation Agent",
          });
          return { status: "skipped", note: `Preserved current status (${leadStatus.status})` };
        }
      }

      case "LOG_ACTIVITY":
      default: {
        await db.insert(activityLogsTable).values({
          action: "workflow_run",
          entityType: payload.entityType,
          entityId: payload.entityId,
          description: `Workflow "${wf.name}" executed action: ${action.type}`,
          performedBy: "Automation Agent",
        });
        break;
      }
    }
  }
}

export const automationEngine = new AutomationEngine();
