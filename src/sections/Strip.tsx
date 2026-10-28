import { useLang } from "../i18n/LanguageContext";

export function Strip() {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-3 border-y border-border bg-surface px-5 py-[18px] md:flex-row md:items-center md:justify-between md:px-10 lg:px-[60px]">
      <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        {t.strip.left}
      </p>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-muted-foreground">
        <span className="font-mono-label text-[10px]">{t.strip.r1}</span>
        <span className="hidden h-5 w-px bg-border lg:block" aria-hidden="true" />
        <span className="font-mono-label text-[10px]">{t.strip.r2}</span>
      </div>
    </div>
  );
}
