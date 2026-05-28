import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clubTable = pgTable("club", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation"),
  lsc: text("lsc"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  logoUrl: text("logo_url"),
});

export const insertClubSchema = createInsertSchema(clubTable).omit({ id: true });
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Club = typeof clubTable.$inferSelect;
