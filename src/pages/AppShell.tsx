import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Camera, ClipboardList, FileText, LayoutDashboard, LogOut, MapPin, ShieldCheck, Snowflake, Truck, type LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { NAV, type NavKey } from "../auth/roles";
import { Logo } from "../components/Logo";
import { LanguageToggle } from "../components/LanguageToggle";
import { useLang } from "../i18n/LanguageContext";

const navIcons: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  newSurplus: Camera,
  myBatches: ClipboardList,
  jobs: Truck,
  review: ShieldCheck,
  map: MapPin,
  impact: FileText,
  myFridge: Snowflake,
};

export default function AppShell() {
  const { t } = useLang();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const roleName = t.login.roles[user.role].name;
  const items = NAV[user.role];

  const onSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
      isActive ? "bg-primary-light text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground"
    }`;

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-border bg-white p-5 lg:flex">
        <Link to="/" aria-label={t.brand.name}>
          <Logo />
        </Link>
        <nav className="mt-8 flex flex-col gap-1" aria-label="App">
          {items.map((item) => {
            const Icon = navIcons[item.key];
            return (
              <NavLink key={item.key} to={item.to} end={item.to === "/app"} className={linkClass}>
                <Icon size={16} aria-hidden="true" />
                {t.app.nav[item.key]}
              </NavLink>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <LogOut size={16} className="rtl-flip" aria-hidden="true" />
          {t.app.signOut}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-white">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 md:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <Link to="/" className="hidden text-[13px] text-muted-foreground hover:text-foreground lg:block">
              {t.app.home}
            </Link>
            <div className="flex items-center gap-2.5">
              <LanguageToggle />
              <span className="hidden items-center rounded-full bg-primary-light px-3 py-1.5 text-[12px] font-semibold text-primary sm:inline-flex">
                {roleName}
              </span>
              <button
                type="button"
                onClick={() => void onSignOut()}
                aria-label={t.app.signOut}
                className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:text-foreground lg:hidden"
              >
                <LogOut size={16} className="rtl-flip" aria-hidden="true" />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-5 pb-3 lg:hidden" aria-label="App">
            {items.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.to === "/app"}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium ${
                    isActive ? "bg-primary-light text-primary" : "text-muted-foreground"
                  }`
                }
              >
                {t.app.nav[item.key]}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-5 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
