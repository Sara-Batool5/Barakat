import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { Dashboard } from "../Dashboard";
import { useLinkedRecord } from "./useLinkedRecord";

export default function Overview() {
  const { t } = useLang();
  const { user } = useAuth();
  if (!user) return null;
  return <OverviewBody />;
}

function OverviewBody() {
  const { t } = useLang();
  const { user } = useAuth();
  const linked = useLinkedRecord(user!);
  const role = user!.role;
  const roleName = t.login.roles[role].name;

  return (
    <>
      <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{t.app.welcome}</h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        {t.app.signedInAs} <span className="font-semibold text-primary">{roleName}</span>
        {user!.name ? <span> · {user!.name}</span> : null}
      </p>
      <p className="mt-4 max-w-[560px] text-[14px] font-light leading-[1.8] text-muted-foreground">
        {t.app.overview.roleBlurb[role]}
      </p>

      {linked && (
        <div className="mt-6 rounded-[14px] border-[1.5px] border-primary-muted bg-primary-light/60 p-5">
          <p className="font-mono-label text-[10px] uppercase tracking-[0.12em] text-primary">{linked.label}</p>
          {linked.title && <p className="mt-1.5 text-[18px] font-bold tracking-[-0.02em]">{linked.title}</p>}
          {linked.subtitle && <p className="mt-0.5 text-[13px] font-light text-muted-foreground">{linked.subtitle}</p>}
        </div>
      )}

      {role === "restaurant" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border-[1.5px] border-primary bg-white p-5">
          <div>
            <p className="text-[15px] font-bold tracking-[-0.01em]">{t.app.overview.submitCta.title}</p>
            <p className="mt-1 text-[13px] font-light text-muted-foreground">{t.app.overview.submitCta.text}</p>
          </div>
          <Link to="/app/new" className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark">
            {t.app.overview.submitCta.button}
          </Link>
        </div>
      )}

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
    </>
  );
}
