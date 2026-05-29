declare global {
  namespace Express {
    interface Request {
      user: {
        id: number;      // internal DB id (users.id)
        authUid: string; // Supabase auth.uid
        email: string | null;
      };
    }
  }
}

export {};
