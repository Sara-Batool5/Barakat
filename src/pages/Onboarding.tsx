import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Logo";
import { LanguageToggle } from "../components/LanguageToggle";
import { AREAS, AREA_NAMES, LANGUAGES, TRANSPORTS, TRANSPORT_LIMITS, VENUE_TYPES } from "../data/areas";
import { useLang } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabase";

const inputClass =
  "w-full rounded-lg border-[1.5px] border-border bg-white px-4 py-3 text-[14px] text-foreground focus:border-primary focus:outline-none";
const labelClass = "mb-1.5 block text-[12px] font-medium text-foreground";

type FridgeOption = { id: string; code: string; name: string };

export default function Onboarding() {
  const { t, lang } = useLang();
  const O = t.onboarding;
  const { user, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueType, setVenueType] = useState("");
  const [area, setArea] = useState("");
  const [transport, setTransport] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [fridgeId, setFridgeId] = useState("");
  const [fridges, setFridges] = useState<FridgeOption[]>([]);

  useEffect(() => {
    if (user?.role !== "fridge_host" || !supabase) return;
    supabase
      .from("fridges")
      .select("id,code,name")
      .order("code")
      .then(({ data }) => setFridges((data ?? []) as FridgeOption[]));
  }, [user?.role]);

  if (!user) return <Navigate to="/login" replace />;
  if (!user.needsOnboarding) return <Navigate to="/app" replace />;

  const areaLabel = (a: string) => (lang === "ar" ? O.areas[a] ?? a : a);
  const toggleLanguage = (l: string) =>
    setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setBusy(true);
    try {
      if (user.role === "restaurant") {
        if (!venueName.trim() || !venueType || !area) throw new Error("required");
        const { lat, lng } = AREAS[area];
        const { data, error: insertError } = await supabase
          .from("restaurants")
          .insert({ name: venueName.trim(), venue_type: venueType, area, lat, lng, owner_user_id: user.id, contact_name: user.name })
          .select("id")
          .single();
        if (insertError) throw insertError;
        const { error: linkError } = await supabase.from("profiles").update({ restaurant_id: data.id }).eq("id", user.id);
        if (linkError) throw linkError;
      } else if (user.role === "volunteer") {
        if (!area || !transport || languages.length === 0) throw new Error("required");
        const { lat, lng } = AREAS[area];
        const [radius, cap] = TRANSPORT_LIMITS[transport as (typeof TRANSPORTS)[number]];
        const { data, error: insertError } = await supabase
          .from("volunteers")
          .insert({
            user_id: user.id, full_name: user.name, area, lat, lng, transport,
            max_radius_km: radius, max_portions: cap, languages, status: "available",
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        const { error: linkError } = await supabase.from("profiles").update({ volunteer_id: data.id }).eq("id", user.id);
        if (linkError) throw linkError;
      } else if (user.role === "fridge_host") {
        if (!fridgeId) throw new Error("required");
        const { error: linkError } = await supabase.from("profiles").update({ fridge_id: fridgeId }).eq("id", user.id);
        if (linkError) throw linkError;
      }
      await refreshProfile();
      navigate("/app", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error && err.message === "required" ? O.required : O.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface px-5 py-6 md:px-10">
      <div className="mx-auto flex max-w-[520px] items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <button type="button" onClick={() => void signOut()} className="text-[12px] text-muted-foreground hover:text-foreground">
            {t.app.signOut}
          </button>
        </div>
      </div>

      <main className="mx-auto mt-10 max-w-[520px] rounded-[14px] border-[1.5px] border-border bg-white p-7">
        <h1 className="text-[26px] font-extrabold tracking-[-0.04em]">{O.title}</h1>
        <p className="mt-2 text-[14px] font-light leading-[1.8] text-muted-foreground">{O.sub[user.role]}</p>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-danger-light px-4 py-3 text-[13px] text-danger">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          {user.role === "restaurant" && (
            <>
              <div>
                <label htmlFor="venueName" className={labelClass}>{O.venueName}</label>
                <input id="venueName" className={inputClass} value={venueName} onChange={(e) => setVenueName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="venueType" className={labelClass}>{O.venueType}</label>
                <select id="venueType" className={inputClass} value={venueType} onChange={(e) => setVenueType(e.target.value)}>
                  <option value="">{O.choose}</option>
                  {VENUE_TYPES.map((v) => (
                    <option key={v} value={v}>{O.venueTypes[v]}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(user.role === "restaurant" || user.role === "volunteer") && (
            <div>
              <label htmlFor="area" className={labelClass}>{O.area}</label>
              <select id="area" className={inputClass} value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">{O.choose}</option>
                {AREA_NAMES.map((a) => (
                  <option key={a} value={a}>{areaLabel(a)}</option>
                ))}
              </select>
            </div>
          )}

          {user.role === "volunteer" && (
            <>
              <div>
                <label htmlFor="transport" className={labelClass}>{O.transport}</label>
                <select id="transport" className={inputClass} value={transport} onChange={(e) => setTransport(e.target.value)}>
                  <option value="">{O.choose}</option>
                  {TRANSPORTS.map((v) => (
                    <option key={v} value={v}>{O.transports[v]}</option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend className={labelClass}>{O.languages}</legend>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => {
                    const on = languages.includes(l);
                    return (
                      <label
                        key={l}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary ${
                          on ? "border-primary bg-primary-light text-primary" : "border-border text-muted-foreground"
                        }`}
                      >
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleLanguage(l)} />
                        {O.languagesMap[l]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          {user.role === "fridge_host" && (
            <div>
              <label htmlFor="fridge" className={labelClass}>{O.fridge}</label>
              <select id="fridge" className={inputClass} value={fridgeId} onChange={(e) => setFridgeId(e.target.value)}>
                <option value="">{O.choose}</option>
                {fridges.map((f) => (
                  <option key={f.id} value={f.id}>{f.code} {f.name}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" disabled={busy} className="mt-2 rounded-lg bg-primary px-6 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
            {busy ? O.saving : O.submit}
          </button>
        </form>
      </main>
    </div>
  );
}
