import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Role = "restaurant" | "volunteer" | "coordinator";
export type User = { role: Role; name: string };

type AuthValue = {
  user: User | null;
  signIn: (role: Role, name?: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);
const STORAGE_KEY = "barakat-user";

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (parsed && (parsed.role === "restaurant" || parsed.role === "volunteer" || parsed.role === "coordinator")) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Step 1 uses a demo sign-in stored in the browser.
 * Step 3 replaces this with real Supabase authentication; the shape stays the same.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser);

  const signIn = useCallback((role: Role, name = "Demo user") => {
    const next: User = { role, name };
    setUser(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
