import { integer, pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects.js";
import { peopleTable } from "./people.js";

export const projectPeopleTable = pgTable("project_people", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  personId: integer("person_id")
    .notNull()
    .references(() => peopleTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectPersonSchema = createInsertSchema(projectPeopleTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProjectPerson = z.infer<typeof insertProjectPersonSchema>;
export type ProjectPerson = typeof projectPeopleTable.$inferSelect;
