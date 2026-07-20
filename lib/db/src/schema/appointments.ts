import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { leadsTable } from "./leads";
import { clientsTable } from "./clients";
import { propertiesTable } from "./properties";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("meeting"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"),
  location: text("location"),
  assignedAgentId: integer("assigned_agent_id").references(() => agentsTable.id),
  leadId: integer("lead_id").references(() => leadsTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
