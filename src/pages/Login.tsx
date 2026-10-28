import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Snowflake, Store, Truck, ShieldCheck, type LucideIcon } from "lucide-react";
import { useAuth, type Role } from "../auth/AuthContext";
import { Logo } from "../components/Logo";
import { LanguageToggle } from "../components/LanguageToggle";
import { useLang } from "../i18n/LanguageContext";

const roleIcons: Record<Role, LucideIcon> = {
  restaurant: Store,
  volunteer: Truck,
  coordinator: ShieldCheck,
};
const roles: Role[] = ["restaurant", "volunteer", "coordinator"];

export default function Login() {
  const { t } = useLang();
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("restaurant");

  if (user) return <Navigate to="/app" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    signIn(role);
    navigate("/app");
  };

  const input =
    "w-full rounded-lg border-[1.5px] border-border bg-white px-4 py-3 text-[14px] text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 md:px-10 lg:px-[60px]">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} className="rtl-flip" aria-hidden="true" />
            {t.login.back}
          </Link>
          <LanguageToggle />
        </div>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-12">
          <Logo />
          <h1 className="mt-8 text-[34px] font-extrabold leading-[1.1] tracking-[-0.04em]">{t.login.title}</h1>
          <p className="mt-3 text-[14px] font-light leading-[1.8] text-muted-foreground">{t.login.sub}</p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
            <fieldset>
              <legend className="mb-2.5 text-[12px] font-medium text-foreground">{t.login.roleLabel}</legend>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {roles.map((r) => {
                  const Icon = roleIcons[r];
                  const selected = role === r;
                  return (
                    <label
                      key={r}
                      className={`relative flex cursor-pointer flex-col gap-1.5 rounded-xl border-[1.5px] p-3.5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary ${
                        selected ? "border-primary bg-primary-light" : "border-border bg-white hover:border-primary-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={selected}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      <Icon size={18} className={selected ? "text-primary" : "text-muted-foreground"} aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-foreground">{t.login.roles[r].name}</span>
                      <span className="text-[11px] font-light leading-[1.45] text-muted-foreground">
                        {t.login.roles[r].desc}
                      </span>
                      {selected && (
                        <Check size={14} strokeWidth={3} className="absolute end-3 top-3 text-primary" aria-hidden="true" />
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-[12px] font-medium">
                {t.login.email}
              </label>
              <input id="email" type="email" autoComplete="email" className={input} dir="ltr" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[12px] font-medium">
                {t.login.password}
              </label>
              <input id="password" type="password" autoComplete="current-password" className={input} dir="ltr" />
            </div>
            <p className="-mt-2 text-[11px] font-light text-muted-foreground">{t.login.hint}</p>

            <button
              type="submit"
              className="rounded-lg bg-primary px-6 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {t.login.submit}
            </button>
          </form>
        </div>
      </div>

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-dark-green p-[60px] lg:flex">
        <Logo light />
        <div>
          <p className="text-[clamp(40px,4vw,56px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
            {t.login.side.l1}
            <span className="block text-primary">{t.login.side.l2}</span>
          </p>
          <ul className="mt-10 flex flex-col gap-4">
            {t.login.points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[14px] font-light text-white/70">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2 text-white/30">
          <Snowflake size={14} aria-hidden="true" />
          <span className="font-mono-label text-[10px]">{t.footer.copy}</span>
        </div>
      </aside>
    </div>
  );
}
