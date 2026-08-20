import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workflowsTable = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  triggerEvent: text("trigger_event").notNull(),
  conditions: text("conditions"), // JSON string
  actions: text("actions").notNull(), // JSON string
  isActive: boolean("is_active").notNull().default(true),
  executionCount: integer("execution_count").notNull().default(0),
  lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const workflowExecutionsTable = pgTable("workflow_executions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflowsTable.id).notNull(),
  status: text("status").notNull().default("success"), // success | failed | partial
  triggeredBy: text("triggered_by").notNull(),
  triggerEntityId: integer("trigger_entity_id"),
  triggerEntityType: text("trigger_entity_type"), // lead | property | client | appointment | task
  triggerEntityName: text("trigger_entity_name"), // e.g. "Bruce Wayne"
  actionsExecuted: integer("actions_executed").notNull().default(0),
  actionResults: text("action_results"), // JSON array of per-action outcomes
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkflowSchema = createInsertSchema(workflowsTable).omit({ id: true, createdAt: true, updatedAt: true, executionCount: true, lastExecutedAt: true });
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflowsTable.$inferSelect;
export type WorkflowExecution = typeof workflowExecutionsTable.$inferSelect;
