import { db } from "@workspace/db";
import { insertPersonSchema, peopleTable } from "@workspace/db/schema";
import { ilike, desc } from "drizzle-orm";
import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const { role, search } = req.query;
  const rows = await db.select().from(peopleTable).orderBy(desc(peopleTable.createdAt));

  const filtered = rows.filter((p) => {
    if (role && p.role !== role) return false;
    if (search) {
      const s = (search as string).toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !(p.organization ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  res.json(
    filtered.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      role: p.role,
      organization: p.organization,
      createdAt: p.createdAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res) => {
  const parsed = insertPersonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const [person] = await db.insert(peopleTable).values(parsed.data).returning();

  res.status(201).json({
    id: person!.id,
    name: person!.name,
    email: person!.email,
    phone: person!.phone,
    role: person!.role,
    organization: person!.organization,
    createdAt: person!.createdAt.toISOString(),
  });
});

export default router;
