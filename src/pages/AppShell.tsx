import { Link, useNavigate } from "react-router-dom";
import { Camera, FileText, LayoutDashboard, LogOut, MapPin, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { useAuth, type Role } from "../auth/AuthContext";
import { Logo } from "../components/Logo";
import { LanguageToggle } from "../components/LanguageToggle";
import { useLang } from "../i18n/LanguageContext";
import type { Dict } from "../i18n/translations";
import { Dashboard } from "./Dashboard";

type NavKey = keyof Dict["app"]["nav"];
const navIcons: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  newSurplus: Camera,
  jobs: Truck,
  review: ShieldCheck,
  map: MapPin,
  impact: FileText,
};

/** Which sidebar items each role sees. */
const navByRole: Record<Role, NavKey[]> = {
  restaurant: ["dashboard", "newSurplus", "impact"],
  volunteer: ["dashboard", "jobs", "map"],
  coordinator: ["dashboard", "review", "map", "impact"],
};

export default function AppShell() {
  const { t } = useLang();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const roleName = t.login.roles[user.role].name;
  const items = navByRole[user.role];

  const onSignOut = () => {
    signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-border bg-white p-5 lg:flex">
        <Link to="/" aria-label={t.brand.name}>
          <Logo />
        </Link>
        <nav className="mt-8 flex flex-col gap-1" aria-label="App">
          {items.map((key, i) => {
            const Icon = navIcons[key];
            return (
              <span
                key={key}
                aria-current={i === 0 ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${
                  i === 0 ? "bg-primary-light text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {t.app.nav[key]}
              </span>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <LogOut size={16} className="rtl-flip" aria-hidden="true" />
          {t.app.signOut}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-white px-5 py-3.5 md:px-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link to="/" className="hidden text-[13px] text-muted-foreground hover:text-foreground lg:block">
            {t.app.home}
          </Link>
          <div className="flex items-center gap-2.5">
            <LanguageToggle />
            <span className="hidden items-center gap-2 rounded-full bg-primary-light px-3 py-1.5 text-[12px] font-semibold text-primary sm:inline-flex">
              {roleName}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              aria-label={t.app.signOut}
              className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <LogOut size={16} className="rtl-flip" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-5 py-8 md:px-8">
          <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{t.app.welcome}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t.app.signedInAs} <span className="font-semibold text-primary">{roleName}</span>
          </p>
          <p className="mt-4 max-w-[560px] text-[14px] font-light leading-[1.8] text-muted-foreground">{t.app.ready}</p>

          <Dashboard />

          <div className="mt-6 rounded-[14px] border-[1.5px] border-dashed border-primary-muted bg-white p-6">
            <h2 className="text-[14px] font-bold">{t.app.nextTitle}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {t.app.next.map((item) => (
                <li key={item} className="flex items-center gap-3 text-[13px] font-light text-muted-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
