import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação necessário" });
    return;
  }

  const token = authHeader.slice(7);

  const { data: { user }, error } = await getSupabase().auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  // Find or auto-provision internal user record
  let [dbUser] = await db.select().from(usersTable).where(eq(usersTable.authUid, user.id));

  if (!dbUser) {
    const [created] = await db
      .insert(usersTable)
      .values({ authUid: user.id, email: user.email ?? null })
      .returning();
    dbUser = created!;
  }

  req.user = { id: dbUser.id, authUid: dbUser.authUid, email: dbUser.email };
  next();
}
