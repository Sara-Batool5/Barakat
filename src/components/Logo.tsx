import { useLang } from "../i18n/LanguageContext";

/** The BARAKAT emblem (public/logo.png, transparent background) plus the wordmark. */
export function Logo({ light = false, size = 36 }: { light?: boolean; size?: number }) {
  const { t } = useLang();
  return (
    <span className="inline-flex items-center gap-2.5">
      {light ? (
        // On dark backgrounds the emblem sits on a white disc so its dark outline stays readable.
        <span className="grid place-items-center rounded-full bg-white p-1" style={{ width: size + 8, height: size + 8 }}>
          <img src="/logo.png" alt="" width={size} height={size} className="block" />
        </span>
      ) : (
        <img src="/logo.png" alt="" width={size} height={size} className="block" />
      )}
      <span className={`text-[15px] font-bold tracking-[-0.02em] ${light ? "text-white" : "text-foreground"}`}>
        {t.brand.name}
      </span>
    </span>
  );
}
