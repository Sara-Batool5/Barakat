import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import rules from "../../config/safetyRules.json";
import { BatchError, createBatch } from "../../data/batches";
import { useLang } from "../../i18n/LanguageContext";
import { fill, fmtDubaiTime, fmtMinutes } from "../../lib/format";
import { compressImage } from "../../lib/image";
import { categoryStorage, categoryTier, screenBatch, type Tier } from "../../lib/safety";

type Row = { key: number; name: string; category: string; portions: string; allergens: string[] };
const ALLERGENS = ["gluten", "milk", "eggs", "nuts", "peanuts", "sesame", "soy", "fish", "shellfish"];
const CATEGORY_KEYS = Object.keys(rules.categories) as (keyof typeof rules.categories)[];
const TIER_GROUPS: Tier[] = ["green", "amber", "red"];
const tierIndex: Record<Tier, number> = { green: 0, amber: 1, red: 2 };
const tierStyle: Record<Tier, string> = {
  green: "bg-primary-light text-primary",
  amber: "bg-amber-light text-amber",
  red: "bg-danger-light text-danger",
};

const inputClass =
  "w-full rounded-lg border-[1.5px] border-border bg-white px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const labelClass = "mb-1.5 block text-[12px] font-medium text-foreground";

export default function NewSurplus() {
  const { t, lang } = useLang();
  const S = t.surplus;
  const { user } = useAuth();
  const counter = useRef(1);
  const newRow = (): Row => ({ key: counter.current++, name: "", category: "", portions: "", allergens: [] });

  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [items, setItems] = useState<Row[]>(() => [newRow()]);
  const [prepared, setPrepared] = useState("");
  const [temp, setTemp] = useState("");
  const [pickup, setPickup] = useState("120");
  const [notes, setNotes] = useState("");
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const hasChilled = items.some((i) => i.category && categoryStorage(i.category) === "chilled" && categoryTier(i.category) !== "red");
  const screening = useMemo(
    () =>
      screenBatch({
        items: items.filter((i) => i.category).map((i) => ({ category: i.category })),
        preparedMinutesAgo: prepared === "" ? null : Number(prepared),
        storedTempC: temp.trim() === "" ? null : Number(temp),
      }),
    [items, prepared, temp]
  );

  if (!user) return null;

  const categoryLabel = (key: string) => (rules.categories as Record<string, { label: { en: string; ar: string } }>)[key].label[lang];
  const updateRow = (key: number, patch: Partial<Row>) => setItems((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const toggleAllergen = (key: number, a: string) =>
    setItems((cur) => cur.map((r) => (r.key === key ? { ...r, allergens: r.allergens.includes(a) ? r.allergens.filter((x) => x !== a) : [...r.allergens, a] } : r)));

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    try {
      const blob = await compressImage(file);
      setPhoto(blob);
      setPhotoUrl(URL.createObjectURL(blob));
    } catch (err) {
      setPhotoError(err instanceof Error && err.message === "too-big" ? S.photoBig : S.photoBad);
    }
  };
  const removePhoto = () => {
    setPhoto(null);
    setPhotoUrl(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const problems: string[] = [];
    if (!photo) problems.push(S.photoRequired);
    const cleaned = items.map((i) => ({ name: i.name.trim(), category: i.category, portions: Math.round(Number(i.portions)), allergens: i.allergens }));
    if (cleaned.some((i) => !i.name || !i.category || !(i.portions >= 1 && i.portions <= 500))) problems.push(S.errors.required);
    for (const m of screening.missing) problems.push(S.missing[m]);
    if (screening.tier === "red") problems.push(S.blocked);
    if (!attested) problems.push(S.attestRequired);
    const unique = Array.from(new Set(problems));
    setErrors(unique);
    if (unique.length > 0) return;

    setBusy(true);
    try {
      await createBatch(user, {
        photo,
        items: cleaned,
        preparedMinutesAgo: prepared === "" ? null : Number(prepared),
        storage: hasChilled ? "chilled" : "ambient",
        storedTempC: hasChilled ? Number(temp) : null,
        pickupMinutes: Number(pickup),
        notes: notes.trim(),
      });
      setDone(true);
    } catch (err) {
      console.error(err);
      const code = err instanceof BatchError ? err.code : "save";
      setErrors([S.errors[code] ?? S.errors.save]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setPhotoUrl(null);
    setItems([newRow()]);
    setPrepared("");
    setTemp("");
    setPickup("120");
    setNotes("");
    setAttested(false);
    setErrors([]);
    setDone(false);
  };

  if (done) {
    return (
      <div className="max-w-[560px] rounded-[14px] border-[1.5px] border-primary-muted bg-white p-8">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-light text-primary">
          <Check size={22} strokeWidth={3} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.04em]">{S.successTitle}</h1>
        <p className="mt-2 text-[14px] font-light leading-[1.8] text-muted-foreground">{S.successText}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark">
            {S.another}
          </button>
          <Link to="/app/batches" className="rounded-lg border border-border px-5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground">
            {S.viewBatches}
          </Link>
        </div>
      </div>
    );
  }

  const tierName = t.safety.cards[tierIndex[screening.tier]].name;
  const hasItems = items.some((i) => i.category);
  const section = "rounded-[14px] border-[1.5px] border-border bg-white p-5 md:p-6";
  const h2 = "text-[15px] font-bold tracking-[-0.01em]";

  return (
    <>
      <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{S.title}</h1>
      <p className="mt-2 max-w-[600px] text-[14px] font-light leading-[1.8] text-muted-foreground">{S.sub}</p>
      {user.mode === "local" && <p className="mt-3 inline-block rounded-full bg-amber-light px-3 py-1 text-[11px] font-semibold text-amber">{S.localNote}</p>}

      <form onSubmit={onSubmit} noValidate className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          {/* 1. Photo */}
          <section className={section}>
            <h2 className={h2}>{S.photoTitle}</h2>
            <p className="mt-1 text-[12px] font-light text-muted-foreground">{S.photoHelp}</p>
            {photoUrl ? (
              <div className="relative mt-4 overflow-hidden rounded-xl border border-border">
                <img src={photoUrl} alt="" className="max-h-[320px] w-full object-cover" />
                <button type="button" onClick={removePhoto} className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-foreground shadow">
                  <X size={13} aria-hidden="true" />
                  {S.removePhoto}
                </button>
              </div>
            ) : (
              <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-primary-muted bg-surface px-4 py-9 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary hover:border-primary">
                <Camera size={26} className="text-primary" aria-hidden="true" />
                <span className="text-[13px] font-semibold text-foreground">{S.takePhoto}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onPhoto(e.target.files?.[0])} />
              </label>
            )}
            {photoError && <p role="alert" className="mt-3 text-[12px] text-danger">{photoError}</p>}
          </section>

          {/* 2. Items */}
          <section className={section}>
            <h2 className={h2}>{S.itemsTitle}</h2>
            <div className="mt-4 flex flex-col gap-5">
              {items.map((row, idx) => (
                <fieldset key={row.key} className="rounded-xl border border-border bg-surface/60 p-4">
                  <legend className="px-1 text-[11px] font-semibold text-muted-foreground">{idx + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_110px]">
                    <div>
                      <label htmlFor={`name-${row.key}`} className={labelClass}>{S.itemName}</label>
                      <input id={`name-${row.key}`} className={inputClass} value={row.name} maxLength={120} placeholder={S.itemNamePh} onChange={(e) => updateRow(row.key, { name: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor={`cat-${row.key}`} className={labelClass}>{S.category}</label>
                      <select id={`cat-${row.key}`} className={inputClass} value={row.category} onChange={(e) => updateRow(row.key, { category: e.target.value })}>
                        <option value="">{S.chooseOne}</option>
                        {TIER_GROUPS.map((tier) => (
                          <optgroup key={tier} label={t.safety.cards[tierIndex[tier]].name}>
                            {CATEGORY_KEYS.filter((k) => categoryTier(k) === tier).map((k) => (
                              <option key={k} value={k}>{categoryLabel(k)}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`por-${row.key}`} className={labelClass}>{S.portions}</label>
                      <input id={`por-${row.key}`} type="number" min={1} max={500} inputMode="numeric" dir="ltr" className={inputClass} value={row.portions} onChange={(e) => updateRow(row.key, { portions: e.target.value })} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className={labelClass}>{S.allergens}</p>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGENS.map((a) => {
                        const on = row.allergens.includes(a);
                        return (
                          <label key={a} className={`cursor-pointer rounded-full border px-3 py-1 text-[12px] font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary ${on ? "border-primary bg-primary-light text-primary" : "border-border bg-white text-muted-foreground"}`}>
                            <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleAllergen(row.key, a)} />
                            {S.allergenLabels[a]}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems((cur) => cur.filter((r) => r.key !== row.key))} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-danger">
                      <Trash2 size={13} aria-hidden="true" />
                      {S.removeItem}
                    </button>
                  )}
                </fieldset>
              ))}
            </div>
            {items.length < 8 ? (
              <button type="button" onClick={() => setItems((cur) => [...cur, newRow()])} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[12px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary">
                <Plus size={14} aria-hidden="true" />
                {S.addItem}
              </button>
            ) : (
              <p className="mt-4 text-[12px] text-muted-foreground">{S.maxItems}</p>
            )}
          </section>

          {/* 3. Handling */}
          <section className={section}>
            <h2 className={h2}>{S.handlingTitle}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="prepared" className={labelClass}>{S.prepared}</label>
                <select id="prepared" className={inputClass} value={prepared} onChange={(e) => setPrepared(e.target.value)}>
                  <option value="">{S.notApplicable}</option>
                  {Object.keys(S.preparedOptions).map((m) => (
                    <option key={m} value={m}>{S.preparedOptions[m]}</option>
                  ))}
                </select>
              </div>
              {hasChilled && (
                <div>
                  <label htmlFor="temp" className={labelClass}>{S.temp}</label>
                  <input id="temp" type="number" step="0.1" inputMode="decimal" dir="ltr" className={inputClass} value={temp} onChange={(e) => setTemp(e.target.value)} />
                  <p className="mt-1 text-[11px] font-light text-muted-foreground">{fill(S.tempHelp, { max: rules.temperature_c.chilled_max })}</p>
                </div>
              )}
            </div>
          </section>

          {/* 4. Pickup */}
          <section className={section}>
            <h2 className={h2}>{S.pickupTitle}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pickup" className={labelClass}>{S.pickup}</label>
                <select id="pickup" className={inputClass} value={pickup} onChange={(e) => setPickup(e.target.value)}>
                  {Object.keys(S.pickupOptions).map((m) => (
                    <option key={m} value={m}>{S.pickupOptions[m]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="notes" className={labelClass}>{S.notes}</label>
              <textarea id="notes" rows={3} maxLength={500} className={inputClass} value={notes} placeholder={S.notesPh} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </section>
        </div>

        {/* Preview and submit */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[14px] border-[1.5px] border-border bg-white p-5">
            <h2 className={h2}>{S.previewTitle}</h2>
            {hasItems ? (
              <>
                <span className={`mt-3 inline-block rounded-full px-3 py-1 text-[12px] font-bold ${tierStyle[screening.tier]}`}>{tierName}</span>
                {screening.safeMinutes !== null && screening.safeUntil && (
                  <p className="mt-3 text-[13px] text-foreground">
                    {S.safeFor} <span className="font-bold text-primary"><bdi>{fmtMinutes(screening.safeMinutes, lang)}</bdi></span>{" "}
                    {screening.tier !== "red" && (<>{S.until} <bdi className="font-semibold">{fmtDubaiTime(screening.safeUntil)}</bdi></>)}
                  </p>
                )}
              </>
            ) : null}
            <ul className="mt-3 flex flex-col gap-2">
              {screening.reasons.map((r, i) => (
                <li key={`${r.code}-${i}`} className="text-[12px] font-light leading-[1.6] text-muted-foreground">
                  {fill(S.reasons[r.code] ?? r.code, r.params)}
                </li>
              ))}
              {hasItems && screening.missing.filter((m) => m !== "items").map((m) => (
                <li key={m} className="text-[12px] font-medium leading-[1.6] text-amber">{S.missing[m]}</li>
              ))}
            </ul>
            <p className="mt-4 border-t border-border pt-3 text-[11px] font-light leading-[1.6] text-muted-foreground">{S.previewNote}</p>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-4 text-[12px] font-light leading-[1.6] text-foreground">
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(140_55%_38%)]" />
            <span>{S.attest}</span>
          </label>

          {errors.length > 0 && (
            <ul role="alert" className="mt-4 flex flex-col gap-1.5 rounded-lg bg-danger-light px-4 py-3 text-[12px] text-danger">
              {errors.map((er) => (
                <li key={er}>{er}</li>
              ))}
            </ul>
          )}

          <button type="submit" disabled={busy} className="mt-4 w-full rounded-lg bg-primary px-6 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
            {busy ? S.submitting : S.submit}
          </button>
        </aside>
      </form>
    </>
  );
}
