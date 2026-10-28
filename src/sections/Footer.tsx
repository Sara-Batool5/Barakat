import { Logo } from "../components/Logo";
import { useLang } from "../i18n/LanguageContext";

export function Footer() {
  const { t } = useLang();
  const product = [
    { href: "#how", label: t.nav.how },
    { href: "#safety", label: t.nav.safety },
    { href: "#agent", label: t.nav.agent },
    { href: "#faq", label: t.nav.faq },
  ];
  const head = "font-mono-label text-[10px] uppercase tracking-[0.1em] text-white/30";
  return (
    <footer className="bg-foreground px-5 pb-7 pt-12 md:px-10 lg:px-[60px]">
      <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr] md:gap-12">
        <div>
          <Logo light />
          <p className="mt-2.5 max-w-[260px] text-[12px] font-light leading-[1.7] text-white/45">{t.footer.tagline}</p>
        </div>
        <div>
          <p className={head}>{t.footer.productTitle}</p>
          <ul className="mt-3 flex flex-col gap-[9px]">
            {product.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-[12px] text-white/50 transition-colors hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={head}>{t.footer.rolesTitle}</p>
          <ul className="mt-3 flex flex-col gap-[9px]">
            {t.footer.roles.map((r) => (
              <li key={r} className="text-[12px] text-white/50">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-10 border-t border-white/10 pt-5">
        <p className="font-mono-label text-[10px] text-white/30">{t.footer.copy}</p>
      </div>
    </footer>
  );
}
