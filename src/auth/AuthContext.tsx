import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { DEMO_PASSWORD, demoEmails, localRecords } from "./demoAccounts";

export type Role = "restaurant" | "volunteer" | "coordinator" | "fridge_host";
export const SELF_SERVICE_ROLES: Role[] = ["restaurant", "volunteer", "fridge_host"];

export type User = {
  id: string;
  email: string | null;
  role: Role;
  name: string;
  restaurantId: string | null;
  volunteerId: string | null;
  fridgeId: string | null;
  /** signed in, but the venue / volunteer / fridge record is not set up yet */
  needsOnboarding: boolean;
  mode: "supabase" | "local";
};

export type Result = { ok: true; needsConfirmation?: boolean } | { ok: false; code: string };

type AuthValue = {
  user: User | null;
  loading: boolean;
  mode: "supabase" | "local";
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (input: { email: string; password: string; fullName: string; role: Role }) => Promise<Result>;
  signInDemo: (role: Role) => Promise<Result>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
const LOCAL_KEY = "barakat-user";
const MODE: "supabase" | "local" = supabase ? "supabase" : "local";

const ROLES: Role[] = ["restaurant", "volunteer", "coordinator", "fridge_host"];
const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as string[]).includes(v);

/** Turns a Supabase error message into a short code the UI can translate. */
function errorCode(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "invalid";
  if (m.includes("already registered") || m.includes("already been registered")) return "exists";
  if (m.includes("at least") && m.includes("password")) return "weak";
  if (m.includes("not confirmed")) return "unconfirmed";
  if (m.includes("rate limit") || m.includes("too many")) return "rate";
  return "generic";
}

function readLocalUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: unknown };
    if (!isRole(parsed.role)) return null;
    return makeLocalUser(parsed.role);
  } catch {
    return null;
  }
}

function makeLocalUser(role: Role): User {
  return {
    id: `local-${role}`,
    email: null,
    role,
    name: localRecords[role].name,
    restaurantId: null,
    volunteerId: null,
    fridgeId: null,
    needsOnboarding: false,
    mode: "local",
  };
}

async function loadProfile(authUser: { id: string; email?: string | null }): Promise<User> {
  const sb = supabase!;
  const columns = "role,full_name,restaurant_id,fridge_id,volunteer_id";
  let { data } = await sb.from("profiles").select(columns).eq("id", authUser.id).maybeSingle();

  if (!data) {
    // Safety net when the sign-up trigger did not create a profile.
    await sb.from("profiles").insert({ id: authUser.id, role: "volunteer", full_name: (authUser.email ?? "").split("@")[0] });
    ({ data } = await sb.from("profiles").select(columns).eq("id", authUser.id).maybeSingle());
  }

  const role: Role = isRole(data?.role) ? data.role : "volunteer";
  const restaurantId = data?.restaurant_id ?? null;
  const volunteerId = data?.volunteer_id ?? null;
  const fridgeId = data?.fridge_id ?? null;
  const needsOnboarding =
    (role === "restaurant" && !restaurantId) || (role === "volunteer" && !volunteerId) || (role === "fridge_host" && !fridgeId);

  return {
    id: authUser.id,
    email: authUser.email ?? null,
    role,
    name: data?.full_name ?? (authUser.email ?? "").split("@")[0],
    restaurantId,
    volunteerId,
    fridgeId,
    needsOnboarding,
    mode: "supabase",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (MODE === "local" ? readLocalUser() : null));
  const [loading, setLoading] = useState(MODE === "supabase");
  const latest = useRef(0);

  const applySession = useCallback(async (session: { user: { id: string; email?: string | null } } | null) => {
    const ticket = ++latest.current;
    if (!session) {
      if (ticket === latest.current) setUser(null);
      return;
    }
    try {
      const next = await loadProfile(session.user);
      if (ticket === latest.current) setUser(next);
    } catch (err) {
      console.error("BARAKAT: could not load the profile", err);
      if (ticket === latest.current) setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      await applySession(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      // Run outside the callback: calling Supabase from inside it can deadlock.
      window.setTimeout(() => {
        if (alive) void applySession(session);
      }, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (!supabase) return { ok: false, code: "generic" };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, code: errorCode(error.message) };
      await applySession(data.session);
      return { ok: true };
    },
    [applySession]
  );

  const signUp = useCallback(
    async (input: { email: string; password: string; fullName: string; role: Role }): Promise<Result> => {
      if (!supabase) return { ok: false, code: "generic" };
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { full_name: input.fullName, role: input.role, locale: document.documentElement.lang === "ar" ? "ar" : "en" },
        },
      });
      if (error) return { ok: false, code: errorCode(error.message) };
      // With email confirmation on, an existing address comes back as a user with no identities.
      if (data.user && data.user.identities && data.user.identities.length === 0) return { ok: false, code: "exists" };
      if (!data.session) return { ok: true, needsConfirmation: true };
      await applySession(data.session);
      return { ok: true };
    },
    [applySession]
  );

  const signInDemo = useCallback(
    async (role: Role): Promise<Result> => {
      if (!supabase) {
        const next = makeLocalUser(role);
        setUser(next);
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify({ role }));
        } catch {
          /* ignore */
        }
        return { ok: true };
      }
      const result = await signIn(demoEmails[role], DEMO_PASSWORD);
      if (!result.ok && result.code === "invalid") return { ok: false, code: "demoMissing" };
      return result;
    },
    [signIn]
  );

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      try {
        localStorage.removeItem(LOCAL_KEY);
      } catch {
        /* ignore */
      }
    }
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  const value = useMemo(
    () => ({ user, loading, mode: MODE, signIn, signUp, signInDemo, signOut, refreshProfile }),
    [user, loading, signIn, signUp, signInDemo, signOut, refreshProfile]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
