import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { athletesTable } from "./athletes";
import { teamsTable } from "./teams";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id").references(() => athletesTable.id).notNull(),
  teamId: integer("team_id").references(() => teamsTable.id),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: text("due_date"),
  paidDate: text("paid_date"),
  description: text("description").notNull(),
  invoiceType: text("invoice_type").notNull().default("Other"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
