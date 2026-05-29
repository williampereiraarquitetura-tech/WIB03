import { db } from "@workspace/db";
import { insertPersonSchema, peopleTable } from "@workspace/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

const router = Router();

router.get("/", async (req, res) => {
  const { role, search } = req.query;
  const uid = req.user.id;

  const rows = await db.select().from(peopleTable)
    .where(eq(peopleTable.userId, uid))
    .orderBy(desc(peopleTable.createdAt));

  const filtered = rows.filter((p) => {
    if (role && p.role !== role) return false;
    if (search) {
      const s = (search as string).toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !(p.organization ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  res.json(filtered.map((p) => ({
    id: p.id, name: p.name, email: p.email, phone: p.phone, role: p.role,
    organization: p.organization, createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const parsed = insertPersonSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos" }); return; }

  const [person] = await db.insert(peopleTable).values({ ...parsed.data, userId: req.user.id }).returning();

  res.status(201).json({
    id: person!.id, name: person!.name, email: person!.email, phone: person!.phone,
    role: person!.role, organization: person!.organization, createdAt: person!.createdAt.toISOString(),
  });
});

const updatePersonSchema = z.object({
  name: z.string().optional(), email: z.string().optional(), phone: z.string().optional(),
  role: z.string().optional(), organization: z.string().optional(),
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const parsed = updatePersonSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos" }); return; }

  const [person] = await db.update(peopleTable).set(parsed.data)
    .where(and(eq(peopleTable.id, id), eq(peopleTable.userId, req.user.id)))
    .returning();
  if (!person) { res.status(404).json({ error: "Pessoa não encontrada" }); return; }

  res.json({
    id: person.id, name: person.name, email: person.email, phone: person.phone,
    role: person.role, organization: person.organization, createdAt: person.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [person] = await db.delete(peopleTable)
    .where(and(eq(peopleTable.id, id), eq(peopleTable.userId, req.user.id)))
    .returning();
  if (!person) { res.status(404).json({ error: "Pessoa não encontrada" }); return; }
  res.status(204).end();
});

export default router;
