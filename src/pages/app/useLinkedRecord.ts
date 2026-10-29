import { useEffect, useState } from "react";
import type { User } from "../../auth/AuthContext";
import { localRecords } from "../../auth/demoAccounts";
import { useLang } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

export type Linked = { label: string; title: string; subtitle: string };

/** The venue, volunteer profile or fridge connected to the signed-in account. */
export function useLinkedRecord(user: User): Linked | null | undefined {
  const { t } = useLang();
  const O = t.app.overview;
  const [linked, setLinked] = useState<Linked | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const done = (v: Linked | null) => alive && setLinked(v);

    if (user.role === "coordinator") {
      done({ label: O.network, title: O.networkTitle, subtitle: t.app.dash.sampleNote });
      return () => { alive = false; };
    }
    if (user.mode === "local" || !supabase) {
      const rec = localRecords[user.role];
      const label = user.role === "restaurant" ? O.yourVenue : user.role === "volunteer" ? O.yourProfile : O.yourFridge;
      done({ label, title: rec.title, subtitle: rec.subtitle });
      return () => { alive = false; };
    }

    setLinked(undefined);
    if (user.role === "restaurant" && user.restaurantId) {
      supabase
        .from("restaurants")
        .select("name,area,cuisine,esg_points")
        .eq("id", user.restaurantId)
        .maybeSingle()
        .then(({ data }) =>
          done(data ? { label: O.yourVenue, title: data.name, subtitle: `${data.area} · ${data.cuisine ?? ""} · ${data.esg_points} ${O.esg}` } : null)
        );
    } else if (user.role === "volunteer" && user.volunteerId) {
      supabase
        .from("volunteers")
        .select("full_name,area,transport,total_deliveries")
        .eq("id", user.volunteerId)
        .maybeSingle()
        .then(({ data }) =>
          done(
            data
              ? {
                  label: O.yourProfile,
                  title: data.full_name,
                  subtitle: `${data.area} · ${t.onboarding.transports[data.transport] ?? data.transport} · ${data.total_deliveries} ${O.deliveries}`,
                }
              : null
          )
        );
    } else if (user.role === "fridge_host" && user.fridgeId) {
      supabase
        .from("fridges")
        .select("code,name,area,current_stock,capacity_portions")
        .eq("id", user.fridgeId)
        .maybeSingle()
        .then(({ data }) =>
          done(
            data
              ? {
                  label: O.yourFridge,
                  title: `${data.code} ${data.name}`,
                  subtitle: `${data.area} · ${data.current_stock}/${data.capacity_portions} ${O.portions}`,
                }
              : null
          )
        );
    } else {
      done(null);
    }
    return () => { alive = false; };
  }, [user.id, user.role, user.mode, user.restaurantId, user.volunteerId, user.fridgeId, t]);

  return linked;
}
