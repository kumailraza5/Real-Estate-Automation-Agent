import { eq, and, gt, lt, ne } from "drizzle-orm";
import { db, appointmentsTable, tasksTable, workflowsTable, workflowExecutionsTable } from "@workspace/db";
import { automationEngine } from "./automationEngine";
import { logger } from "../lib/logger";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isCheckingAppointments = false;
let isCheckingOverdueTasks = false;

export async function checkAppointments() {
  if (isCheckingAppointments) return;
  isCheckingAppointments = true;
  logger.info("[Scheduler] Checking for upcoming appointments...");
  try {
    const activeWorkflows = await db
      .select()
      .from(workflowsTable)
      .where(
        and(
          eq(workflowsTable.isActive, true),
          eq(workflowsTable.triggerEvent, "APPOINTMENT_REMINDER")
        )
      );

    if (activeWorkflows.length === 0) return;

    const now = new Date();
    // Look at appointments starting within the next 24 hours
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcoming = await db
      .select()
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.status, "scheduled"),
          gt(appointmentsTable.startTime, now),
          lt(appointmentsTable.startTime, tomorrow)
        )
      );

    for (const wf of activeWorkflows) {
      // Batch-fetch all already-processed appointment IDs for this workflow
      const alreadyProcessed = await db
        .select({ id: workflowExecutionsTable.triggerEntityId })
        .from(workflowExecutionsTable)
        .where(
          and(
            eq(workflowExecutionsTable.workflowId, wf.id),
            eq(workflowExecutionsTable.triggerEntityType, "appointment"),
            eq(workflowExecutionsTable.status, "success")
          )
        );
      const processedIds = new Set(alreadyProcessed.map((r) => r.id));

      for (const appt of upcoming) {
        if (processedIds.has(appt.id)) continue; // Already executed for this workflow

        const timeToStartMins = Math.floor((appt.startTime.getTime() - now.getTime()) / 60000);

        const payload = {
          entityType: "appointment" as const,
          entityId: appt.id,
          entityName: appt.title,
          data: {
            ...appt,
            time_to_start: timeToStartMins,
          },
        };

        // @ts-ignore - accessing private method for scheduler
        const shouldExecute = automationEngine.evaluateConditions(wf.conditions, payload.data);
        if (!shouldExecute) continue;

        logger.info({ workflowId: wf.id, appointmentId: appt.id }, "[Scheduler] Triggering APPOINTMENT_REMINDER");
        // @ts-ignore - accessing private method for scheduler
        await automationEngine.executeWorkflow(wf, payload);
      }
    }
  } catch (err) {
    logger.error({ err }, "[Scheduler] Error in checkAppointments");
  } finally {
    isCheckingAppointments = false;
  }
}

export async function checkOverdueTasks() {
  if (isCheckingOverdueTasks) return;
  isCheckingOverdueTasks = true;
  logger.info("[Scheduler] Checking for overdue tasks...");
  try {
    const activeWorkflows = await db
      .select()
      .from(workflowsTable)
      .where(
        and(
          eq(workflowsTable.isActive, true),
          eq(workflowsTable.triggerEvent, "TASK_OVERDUE")
        )
      );

    if (activeWorkflows.length === 0) return;

    // Fetch incomplete tasks
    const incompleteTasks = await db
      .select()
      .from(tasksTable)
      .where(ne(tasksTable.status, "completed"));

    const now = new Date();

    // Filter overdue tasks in-memory first (avoids N+1 DB queries per task)
    const overdueTasks = incompleteTasks.filter((task) => {
      if (!task.dueDate) return false;
      let dueDateTime: Date;
      try {
        const timeStr = task.dueTime ? convertTo24Hour(task.dueTime) : "23:59:59";
        dueDateTime = new Date(`${task.dueDate}T${timeStr}Z`);
        if (Number.isNaN(dueDateTime.getTime())) dueDateTime = new Date(task.dueDate);
      } catch {
        dueDateTime = new Date(task.dueDate);
      }
      return now > dueDateTime;
    });

    if (overdueTasks.length === 0) return;

    for (const wf of activeWorkflows) {
      // Batch-fetch all already-processed task IDs for this workflow (1 query per workflow, not per task)
      const alreadyProcessed = await db
        .select({ id: workflowExecutionsTable.triggerEntityId })
        .from(workflowExecutionsTable)
        .where(
          and(
            eq(workflowExecutionsTable.workflowId, wf.id),
            eq(workflowExecutionsTable.triggerEntityType, "task"),
            eq(workflowExecutionsTable.status, "success")
          )
        );
      const processedIds = new Set(alreadyProcessed.map((r) => r.id));

      for (const task of overdueTasks) {
        if (processedIds.has(task.id)) continue; // Already executed for this workflow

        const payload = {
          entityType: "task" as const,
          entityId: task.id,
          entityName: task.title,
          data: task,
        };

        // @ts-ignore
        const shouldExecute = automationEngine.evaluateConditions(wf.conditions, payload.data);
        if (!shouldExecute) continue;

        logger.info({ workflowId: wf.id, taskId: task.id }, "[Scheduler] Triggering TASK_OVERDUE");
        // @ts-ignore
        await automationEngine.executeWorkflow(wf, payload);
        processedIds.add(task.id); // Update in-memory set to prevent duplicates within same cycle
      }
    }
  } catch (err) {
    logger.error({ err }, "[Scheduler] Error in checkOverdueTasks");
  } finally {
    isCheckingOverdueTasks = false;
  }
}

// Helper for PM/AM time parsing
function convertTo24Hour(timeStr: string): string {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return "23:59:59";
  let [_, hoursStr, minutes, modifier] = match;
  let hours = parseInt(hoursStr, 10);
  
  if (modifier && modifier.toUpperCase() === "PM" && hours < 12) {
    hours += 12;
  }
  if (modifier && modifier.toUpperCase() === "AM" && hours === 12) {
    hours = 0;
  }
  
  const h = hours.toString().padStart(2, "0");
  return `${h}:${minutes}:00`;
}

export function startScheduler(intervalMs = 60000) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  
  logger.info({ intervalMs }, "[Scheduler] Starting background scheduler...");
  
  // Optional: run immediately on startup
  setTimeout(() => {
    checkAppointments();
    checkOverdueTasks();
  }, 5000); // 5 sec delay to ensure DB connects
  
  schedulerInterval = setInterval(async () => {
    await checkAppointments();
    await checkOverdueTasks();
  }, intervalMs);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("[Scheduler] Stopped background scheduler.");
  }
}
