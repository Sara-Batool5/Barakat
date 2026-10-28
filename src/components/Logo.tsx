import { Leaf } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

/** Placeholder mark. The final logo is designed at the end of the project and replaces this file. */
export function Logo({ light = false }: { light?: boolean }) {
  const { t } = useLang();
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-primary text-white">
        <Leaf size={15} aria-hidden="true" />
      </span>
      <span className={`text-[15px] font-bold tracking-[-0.02em] ${light ? "text-white" : "text-foreground"}`}>
        {t.brand.name}
      </span>
    </span>
  );
}
