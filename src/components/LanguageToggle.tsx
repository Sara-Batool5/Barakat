import { Languages } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { t, toggle } = useLang();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.nav.switchLabel}
      className={`inline-flex items-center gap-1.5 rounded-[7px] border border-border bg-white px-3 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-foreground ${className}`}
    >
      <Languages size={15} aria-hidden="true" />
      <span>{t.nav.switchTo}</span>
    </button>
  );
}
