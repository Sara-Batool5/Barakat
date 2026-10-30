import { Link } from "react-router-dom";
import type { NavKey } from "../../auth/roles";
import { useLang } from "../../i18n/LanguageContext";

export default function ComingSoon({ page }: { page: Exclude<NavKey, "dashboard" | "newSurplus" | "myBatches"> }) {
  const { t } = useLang();
  const info = t.app.soon.pages[page];
  return (
    <div className="max-w-[560px]">
      <span className="inline-block rounded bg-primary-light px-2.5 py-1 font-mono-label text-[10px] uppercase text-primary">
        {t.app.soon.badge} {info.step}
      </span>
      <h1 className="mt-4 text-[28px] font-extrabold tracking-[-0.04em]">{t.app.nav[page]}</h1>
      <p className="mt-3 text-[14px] font-light leading-[1.8] text-muted-foreground">{info.text}</p>
      <Link
        to="/app"
        className="mt-6 inline-block rounded-lg border border-border px-5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground"
      >
        {t.app.soon.back}
      </Link>
    </div>
  );
}
