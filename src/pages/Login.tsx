import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Check, ShieldCheck, Snowflake, Store, Truck, type LucideIcon } from "lucide-react";
import { SELF_SERVICE_ROLES, useAuth, type Result, type Role } from "../auth/AuthContext";
import { Logo } from "../components/Logo";
import { LanguageToggle } from "../components/LanguageToggle";
import { useLang } from "../i18n/LanguageContext";

const roleIcons: Record<Role, LucideIcon> = {
  restaurant: Store,
  volunteer: Truck,
  fridge_host: Snowflake,
  coordinator: ShieldCheck,
};
const demoRoles: Role[] = ["restaurant", "volunteer", "fridge_host", "coordinator"];

const inputClass =
  "w-full rounded-lg border-[1.5px] border-border bg-white px-4 py-3 text-[14px] text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";

export default function Login() {
  const { t } = useLang();
  const L = t.login;
  const { user, mode, signIn, signUp, signInDemo } = useAuth();
  const [tab, setTab] = useState<"signIn" | "signUp">("signIn");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("restaurant");

  if (user) return <Navigate to={user.needsOnboarding ? "/onboarding" : "/app"} replace />;

  const run = async (fn: () => Promise<Result>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) setError(L.errors[result.code] ?? L.errors.generic);
    else if (result.needsConfirmation) setInfo(L.confirmEmail);
    return result;
  };

  const onSignIn = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError(L.errors.required);
    void run(() => signIn(email.trim(), password));
  };

  const onSignUp = (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) return setError(L.errors.required);
    if (password.length < 8) return setError(L.errors.weak);
    void run(() => signUp({ email: email.trim(), password, fullName: fullName.trim(), role }));
  };

  const label = "mb-1.5 block text-[12px] font-medium text-foreground";

  const demoButtons = (
    <div>
      <p className="text-[13px] font-semibold text-foreground">{L.demoTitle}</p>
      <p className="mb-3 text-[12px] font-light text-muted-foreground">{L.demoHint}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {demoRoles.map((r) => {
          const Icon = roleIcons[r];
          return (
            <button
              key={r}
              type="button"
              disabled={busy}
              onClick={() => void run(() => signInDemo(r))}
              className="flex flex-col items-start gap-1.5 rounded-xl border-[1.5px] border-border bg-white p-3.5 text-start transition-colors hover:border-primary disabled:opacity-60"
            >
              <Icon size={18} className="text-primary" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-foreground">{L.roles[r].name}</span>
              <span className="text-[11px] font-light leading-[1.45] text-muted-foreground">{L.roles[r].desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 md:px-10 lg:px-[60px]">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} className="rtl-flip" aria-hidden="true" />
            {L.back}
          </Link>
          <LanguageToggle />
        </div>

        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-10">
          <Logo />
          <h1 className="mt-8 text-[34px] font-extrabold leading-[1.1] tracking-[-0.04em]">{L.title}</h1>
          <p className="mt-3 text-[14px] font-light leading-[1.8] text-muted-foreground">
            {mode === "supabase" ? L.sub : L.subLocal}
          </p>

          {(error || info) && (
            <p
              role={error ? "alert" : "status"}
              className={`mt-5 rounded-lg px-4 py-3 text-[13px] ${
                error ? "bg-danger-light text-danger" : "bg-primary-light text-primary"
              }`}
            >
              {error ?? info}
            </p>
          )}

          {mode === "supabase" ? (
            <>
              <div role="tablist" className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-surface-raised p-1">
                {(["signIn", "signUp"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => {
                      setTab(k);
                      setError(null);
                      setInfo(null);
                    }}
                    className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
                      tab === k ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {L.tabs[k]}
                  </button>
                ))}
              </div>

              {tab === "signIn" ? (
                <form onSubmit={onSignIn} className="mt-5 flex flex-col gap-4" noValidate>
                  <div>
                    <label htmlFor="email" className={label}>{L.email}</label>
                    <input id="email" type="email" autoComplete="email" dir="ltr" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="password" className={label}>{L.password}</label>
                    <input id="password" type="password" autoComplete="current-password" dir="ltr" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <button type="submit" disabled={busy} className="rounded-lg bg-primary px-6 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
                    {busy ? L.working : L.signInButton}
                  </button>
                </form>
              ) : (
                <form onSubmit={onSignUp} className="mt-5 flex flex-col gap-4" noValidate>
                  <div>
                    <label htmlFor="fullName" className={label}>{L.fullName}</label>
                    <input id="fullName" type="text" autoComplete="name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="email" className={label}>{L.email}</label>
                    <input id="email" type="email" autoComplete="email" dir="ltr" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="password" className={label}>{L.password}</label>
                    <input id="password" type="password" autoComplete="new-password" dir="ltr" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <p className="mt-1 text-[11px] font-light text-muted-foreground">{L.passwordHint}</p>
                  </div>
                  <fieldset>
                    <legend className={label}>{L.roleLabel}</legend>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {SELF_SERVICE_ROLES.map((r) => {
                        const Icon = roleIcons[r];
                        const selected = role === r;
                        return (
                          <label
                            key={r}
                            className={`relative flex cursor-pointer flex-col gap-1.5 rounded-xl border-[1.5px] p-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary ${
                              selected ? "border-primary bg-primary-light" : "border-border bg-white hover:border-primary-muted"
                            }`}
                          >
                            <input type="radio" name="role" value={r} checked={selected} onChange={() => setRole(r)} className="sr-only" />
                            <Icon size={17} className={selected ? "text-primary" : "text-muted-foreground"} aria-hidden="true" />
                            <span className="text-[12px] font-semibold text-foreground">{L.roles[r].name}</span>
                            <span className="text-[11px] font-light leading-[1.4] text-muted-foreground">{L.roles[r].desc}</span>
                            {selected && <Check size={13} strokeWidth={3} className="absolute end-2.5 top-2.5 text-primary" aria-hidden="true" />}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <button type="submit" disabled={busy} className="rounded-lg bg-primary px-6 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
                    {busy ? L.working : L.signUpButton}
                  </button>
                </form>
              )}

              <div className="my-7 border-t border-border" />
              {demoButtons}
            </>
          ) : (
            <div className="mt-7">{demoButtons}</div>
          )}
        </div>
      </div>

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-dark-green p-[60px] lg:flex">
        <Logo light />
        <div>
          <p className="text-[clamp(40px,4vw,56px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
            {L.side.l1}
            <span className="block text-primary">{L.side.l2}</span>
          </p>
          <ul className="mt-10 flex flex-col gap-4">
            {L.points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[14px] font-light text-white/70">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="font-mono-label text-[10px] text-white/30">{t.footer.copy}</p>
      </aside>
    </div>
  );
}
