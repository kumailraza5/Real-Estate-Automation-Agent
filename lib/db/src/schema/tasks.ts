import { pgTable, text, serial, timestamp, integer, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { leadsTable } from "./leads";
import { clientsTable } from "./clients";
import { workflowsTable } from "./workflows";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("follow-up"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  dueDate: date("due_date", { mode: "string" }),
  dueTime: text("due_time"),
  assignedAgentId: integer("assigned_agent_id").references(() => agentsTable.id),
  leadId: integer("lead_id").references(() => leadsTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  // Automation traceability
  sourceWorkflowId: integer("source_workflow_id").references(() => workflowsTable.id),
  sourceWorkflowName: text("source_workflow_name"),
  isAutomated: boolean("is_automated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
