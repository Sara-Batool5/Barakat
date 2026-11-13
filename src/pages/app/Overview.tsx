import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { DemoFridgePicker, DemoVolunteerPicker } from "../../components/DemoPickers";
import { IncomingDeliveries } from "../../components/IncomingDeliveries";
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

      {role === "volunteer" && <DemoVolunteerPicker />}
      {role === "fridge_host" && <DemoFridgePicker />}

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

      {role === "fridge_host" && <IncomingDeliveries />}

      {role === "coordinator" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border-[1.5px] border-primary bg-white p-5">
          <div>
            <p className="text-[15px] font-bold tracking-[-0.01em]">{t.app.overview.reviewCta.title}</p>
            <p className="mt-1 text-[13px] font-light text-muted-foreground">{t.app.overview.reviewCta.text}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/app/review" className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark">{t.app.overview.reviewCta.button}</Link>
            <Link to="/app/activity" className="rounded-lg border border-border px-5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground">{t.app.overview.reviewCta.button2}</Link>
          </div>
        </div>
      )}

      {role === "volunteer" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border-[1.5px] border-primary bg-white p-5">
          <div>
            <p className="text-[15px] font-bold tracking-[-0.01em]">{t.app.overview.jobsCta.title}</p>
            <p className="mt-1 text-[13px] font-light text-muted-foreground">{t.app.overview.jobsCta.text}</p>
          </div>
          <Link to="/app/jobs" className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark">
            {t.app.overview.jobsCta.button}
          </Link>
        </div>
      )}

      <Dashboard />

    </>
  );
}
