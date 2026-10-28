import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { LanguageToggle } from "./LanguageToggle";
import { useLang } from "../i18n/LanguageContext";

const signInClass =
  "inline-flex items-center gap-2 rounded-[7px] bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark";

export function Navbar() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "#how", label: t.nav.how },
    { href: "#safety", label: t.nav.safety },
    { href: "#who", label: t.nav.who },
    { href: "#agent", label: t.nav.agent },
    { href: "#faq", label: t.nav.faq },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-white/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-5 py-4 md:px-10 lg:px-[60px]">
          <Link to="/" aria-label={t.brand.name}>
            <Logo />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13px] font-normal text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <Link to="/login" className={`${signInClass} sm:px-[22px]`}>
              <LogIn size={15} className="rtl-flip" aria-hidden="true" />
              <span>{t.nav.signIn}</span>
            </Link>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-[7px] text-foreground lg:hidden"
              aria-label={t.nav.menu}
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-white p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-[7px]"
                aria-label={t.nav.close}
                onClick={() => setOpen(false)}
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <nav className="mt-10 flex flex-col gap-1" aria-label="Mobile">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-border py-4 text-[22px] font-semibold tracking-[-0.02em] text-foreground"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 pb-4">
              <LanguageToggle className="justify-center" />
              <Link
                to="/login"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-[14px] font-semibold text-white"
              >
                <LogIn size={16} className="rtl-flip" aria-hidden="true" />
                {t.nav.signIn}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
