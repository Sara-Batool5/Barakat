#!/usr/bin/env python3
"""
Generates the BARAKAT sample data as SQL seed files (supabase/) and a JSON fallback (src/data/seed/).
Everything is fictional. Names, venues and people are invented; locations are approximate area
centres with small jitter. Not needed to run the app; kept so the data can be regenerated.
"""
import hashlib
import json
import math
import os
import random
import re
import uuid
import datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL_DIR = os.path.join(ROOT, "supabase")
JSON_DIR = os.path.join(ROOT, "src", "data", "seed")
RULES = json.load(open(os.path.join(ROOT, "src", "config", "safetyRules.json"), encoding="utf-8"))
FACTORS = json.load(open(os.path.join(ROOT, "src", "config", "impactFactors.json"), encoding="utf-8"))
CATS = RULES["categories"]

NS = uuid.UUID("5d0b7a2e-7c1d-4e9a-9a53-0b4a7a4f0001")
ANCHOR = dt.datetime(2026, 10, 28, 14, 0, tzinfo=dt.timezone.utc)  # 18:00 in Dubai (UTC+4)
ANCHOR_LOCAL_MIN = 18 * 60
RULE_VERSION = RULES["version"]
FACTOR_VERSION = FACTORS["version"]
N_HISTORY = 168
DAYS = 45

random.seed(20261028)


ID_SRC = {}


def uid(kind, key):
    """Deterministic id = md5('kind:key') as a uuid. Postgres computes the same value with _i(kind, key)."""
    u = str(uuid.UUID(hashlib.md5(f"{kind}:{key}".encode()).hexdigest()))
    ID_SRC[u] = (kind, str(key))
    return u


def iso(m):
    return (ANCHOR + dt.timedelta(minutes=int(m))).strftime("%Y-%m-%dT%H:%M:%SZ")


def local_min(m):
    return (ANCHOR_LOCAL_MIN + int(m)) % 1440


def hav_km(a, b):
    r = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dphi = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def road_km(a, b):
    return round(hav_km(a, b) * 1.35, 1)


# ---------------------------------------------------------------- reference data
AREAS = {
    "Al Quoz": (25.1370, 55.2290), "Al Karama": (25.2437, 55.3040), "Deira": (25.2697, 55.3095),
    "Bur Dubai": (25.2532, 55.2972), "Al Satwa": (25.2285, 55.2750), "Jumeirah": (25.2144, 55.2590),
    "Business Bay": (25.1851, 55.2625), "Downtown Dubai": (25.1972, 55.2744), "Dubai Marina": (25.0805, 55.1403),
    "JLT": (25.0657, 55.1413), "JBR": (25.0780, 55.1330), "Al Barsha": (25.1130, 55.2000),
    "Al Nahda": (25.2914, 55.3705), "Al Qusais": (25.2740, 55.3780), "Mirdif": (25.2181, 55.4207),
    "International City": (25.1650, 55.4080), "Dubai Silicon Oasis": (25.1255, 55.3815),
    "Jebel Ali": (25.0100, 55.0600), "Dubai Investments Park": (24.9807, 55.1636), "Motor City": (25.0480, 55.2400),
    "Al Garhoud": (25.2450, 55.3500), "Oud Metha": (25.2370, 55.3100), "DIFC": (25.2138, 55.2796),
    "Dubai Hills": (25.1000, 55.2500), "Al Warqa": (25.2020, 55.4200), "Umm Suqeim": (25.1560, 55.2090),
}


def jitter(area, rng, spread=0.004):
    lat, lng = AREAS[area]
    return round(lat + rng.uniform(-spread, spread), 5), round(lng + rng.uniform(-spread, spread), 5)


RESTAURANTS = [
    ("Saffron & Salt Kitchen", "restaurant", "Levantine", "Al Karama"),
    ("Marigold Biryani House", "restaurant", "Indian", "Bur Dubai"),
    ("Palm Crescent Hotel", "hotel", "International buffet", "Jumeirah"),
    ("Desert Rose Bakery", "bakery", "Bakery", "Al Quoz"),
    ("Harbour Lights Seafood Grill", "restaurant", "Seafood", "Dubai Marina"),
    ("Zaytoun Mezze Bar", "restaurant", "Mezze", "Business Bay"),
    ("The Date Tree Cafe", "cafe", "Emirati", "Al Satwa"),
    ("Lotus Court Dim Sum", "restaurant", "Chinese", "Deira"),
    ("Nomad Cloud Kitchen One", "cloud_kitchen", "Mixed delivery", "Al Barsha"),
    ("Nomad Cloud Kitchen Two", "cloud_kitchen", "Mixed delivery", "Al Qusais"),
    ("Skyline Grand Hotel", "hotel", "International buffet", "Downtown Dubai"),
    ("Bosphorus Grill & Pide", "restaurant", "Turkish", "Al Nahda"),
    ("Manila Corner Eatery", "restaurant", "Filipino", "Al Satwa"),
    ("Sunrise Sandwich Co.", "cafe", "Sandwiches and salads", "DIFC"),
    ("Golden Crust Bakehouse", "bakery", "Bakery", "Mirdif"),
    ("Spice Route Catering", "catering", "Event catering", "Dubai Investments Park"),
    ("Oasis Fresh Market", "supermarket", "Packaged goods and produce", "Dubai Hills"),
    ("Tandoor Nights", "restaurant", "Pakistani", "International City"),
    ("Persian Garden Kebab", "restaurant", "Iranian", "Al Garhoud"),
    ("Blue Reef Hotel & Resort", "hotel", "International buffet", "JBR"),
    ("Habesha Table", "restaurant", "Ethiopian", "Oud Metha"),
    ("Verde Salad Lab", "cafe", "Healthy bowls", "Dubai Silicon Oasis"),
    ("Little Istanbul Patisserie", "bakery", "Pastries", "Al Warqa"),
    ("Harvest Lane Supermarket", "supermarket", "Packaged goods and produce", "Umm Suqeim"),
]
CONTACTS = ["Rashid", "Priya", "Marwa", "Joseph", "Sana", "Omar", "Lea", "Imran", "Huda", "Daniel", "Noura", "Arjun"]

HOST_LABEL = {
    "community_centre": "Community Centre", "residential_tower": "Residents' Lobby", "park_pavilion": "Park Pavilion",
    "mall_entrance": "Mall Entrance", "workers_accommodation": "Workers' Accommodation", "school": "School Gate",
    "cooperative": "Co-op Entrance", "place_of_worship": "Neighbourhood Prayer Hall",
}
HOST_CAP = {
    "community_centre": (70, 100), "residential_tower": (50, 80), "park_pavilion": (40, 60), "mall_entrance": (80, 110),
    "workers_accommodation": (100, 150), "school": (40, 60), "cooperative": (60, 90), "place_of_worship": (60, 90),
}
FRIDGE_SPEC = [
    ("Al Quoz", "workers_accommodation"), ("Al Quoz", "community_centre"),
    ("Al Karama", "cooperative"), ("Al Karama", "residential_tower"),
    ("Deira", "community_centre"), ("Deira", "mall_entrance"), ("Deira", "residential_tower"),
    ("Bur Dubai", "place_of_worship"), ("Bur Dubai", "cooperative"),
    ("Al Satwa", "community_centre"),
    ("Jumeirah", "park_pavilion"), ("Jumeirah", "school"),
    ("Business Bay", "residential_tower"), ("Downtown Dubai", "mall_entrance"),
    ("Dubai Marina", "residential_tower"), ("Dubai Marina", "park_pavilion"),
    ("JLT", "community_centre"),
    ("Al Barsha", "cooperative"), ("Al Barsha", "school"),
    ("Al Nahda", "community_centre"), ("Al Nahda", "residential_tower"),
    ("Al Qusais", "workers_accommodation"), ("Al Qusais", "place_of_worship"),
    ("Mirdif", "park_pavilion"), ("Mirdif", "cooperative"),
    ("International City", "community_centre"), ("International City", "workers_accommodation"),
    ("Dubai Silicon Oasis", "school"),
    ("Jebel Ali", "workers_accommodation"), ("Jebel Ali", "community_centre"),
    ("Dubai Investments Park", "workers_accommodation"), ("Motor City", "park_pavilion"),
    ("Al Garhoud", "cooperative"), ("Oud Metha", "community_centre"),
]
PAUSED = {11, 26}
OFFLINE = {19}
HOURS = [(None, None), (None, None), (None, None), (360, 1380), (420, 1320), (480, 1200)]

FIRST = ["Amina", "Omar", "Fatima", "Yusuf", "Layla", "Khalid", "Mariam", "Hassan", "Noor", "Saeed", "Rania", "Tariq",
         "Hind", "Imran", "Sana", "Bilal", "Ayesha", "Farhan", "Priya", "Arjun", "Meera", "Rohan", "Anita", "Vikram",
         "Joy", "Maricel", "Ramon", "Grace", "Daniel", "Elena", "Ivan", "Natalia", "Sami", "Dina", "Karim", "Salma",
         "Zainab", "Hamza", "Lina", "Nadia", "Faisal", "Reem", "Anil", "Shreya", "Mei", "Wei"]
LAST = ["Al Mansoori", "Khan", "Hussain", "Nair", "Fernandes", "Santos", "Reyes", "Ibrahim", "Haddad", "Rahman",
        "Siddiqui", "Menon", "D'Souza", "Petrov", "Ahmed", "Farouk", "Patel", "Sharma", "Cruz", "Bello", "Tan", "Lim",
        "Yilmaz", "Demir", "Mahmoud", "Qureshi", "Al Suwaidi", "Joseph", "Kamal", "Ortega"]
TRANSPORT = {"car": (32, 15, 80), "van": (28, 20, 200), "scooter": (26, 10, 30), "bike": (15, 6, 20), "on_foot": (5, 2, 12)}
LANGS = ["English", "Arabic", "Urdu", "Hindi", "Tagalog", "Malayalam", "Bengali", "Russian", "French", "Persian"]

# (name, category, kg per portion, min portions, max portions, allergens)
ITEMS = [
    ("Chicken biryani trays", "cooked_chilled", 0.45, 10, 40, []),
    ("Lamb ouzi rice trays", "cooked_chilled", 0.50, 8, 30, []),
    ("Vegetable korma with rice", "cooked_chilled", 0.42, 10, 35, ["milk", "nuts"]),
    ("Grilled chicken and rice boxes", "cooked_chilled", 0.45, 12, 40, []),
    ("Chickpea curry (chana masala)", "cooked_chilled", 0.40, 10, 35, []),
    ("Pasta primavera trays", "cooked_chilled", 0.40, 10, 40, ["gluten", "milk"]),
    ("Lentil dal and rice", "cooked_chilled", 0.40, 12, 45, []),
    ("Stuffed vine leaves", "cooked_chilled", 0.30, 15, 50, []),
    ("Baked fish with rice", "cooked_chilled", 0.45, 8, 25, ["fish"]),
    ("Moussaka trays", "cooked_chilled", 0.45, 8, 24, ["milk", "gluten"]),
    ("Falafel and hummus boxes", "cooked_chilled", 0.35, 12, 40, ["sesame", "gluten"]),
    ("Chicken kabsa trays", "cooked_chilled", 0.50, 10, 40, []),
    ("Falafel wraps", "sandwiches_salads", 0.25, 10, 40, ["gluten", "sesame"]),
    ("Chicken club sandwiches", "sandwiches_salads", 0.28, 8, 30, ["gluten", "eggs"]),
    ("Tuna salad boxes", "sandwiches_salads", 0.30, 8, 25, ["fish", "eggs"]),
    ("Greek salad boxes", "sandwiches_salads", 0.30, 10, 30, ["milk"]),
    ("Fruit cups", "sandwiches_salads", 0.20, 12, 50, []),
    ("Hummus and pita boxes", "sandwiches_salads", 0.25, 10, 35, ["sesame", "gluten"]),
    ("Halloumi and veggie wraps", "sandwiches_salads", 0.26, 8, 30, ["milk", "gluten"]),
    ("Assorted bread rolls", "bakery_ambient", 0.08, 20, 90, ["gluten"]),
    ("Croissants", "bakery_ambient", 0.07, 15, 60, ["gluten", "milk", "eggs"]),
    ("Date and nut loaves", "bakery_ambient", 0.12, 8, 30, ["gluten", "nuts", "eggs"]),
    ("Cheese manakish", "bakery_ambient", 0.15, 12, 40, ["gluten", "milk"]),
    ("Baked samosas", "bakery_ambient", 0.10, 20, 70, ["gluten"]),
    ("Baklava assortment", "bakery_ambient", 0.06, 20, 80, ["gluten", "nuts"]),
    ("Pide bread", "bakery_ambient", 0.20, 10, 40, ["gluten"]),
    ("Umm Ali pots", "dairy_desserts", 0.15, 10, 40, ["milk", "nuts", "gluten"]),
    ("Rice pudding cups", "dairy_desserts", 0.15, 12, 45, ["milk"]),
    ("Yoghurt cups", "dairy_desserts", 0.15, 15, 60, ["milk"]),
    ("Cheesecake slices", "dairy_desserts", 0.12, 8, 30, ["milk", "gluten", "eggs"]),
    ("Kunafa trays", "dairy_desserts", 0.20, 8, 30, ["milk", "gluten", "nuts"]),
    ("Sealed snack boxes", "packaged_sealed", 0.20, 15, 60, ["gluten", "nuts"]),
    ("Packaged granola bars", "packaged_sealed", 0.05, 30, 120, ["nuts", "gluten"]),
    ("Crackers and cheese packs", "packaged_sealed", 0.10, 20, 70, ["gluten", "milk"]),
    ("Sealed date boxes", "packaged_sealed", 0.20, 15, 50, []),
    ("Whole bananas and apples", "produce_whole", 0.20, 20, 80, []),
    ("Oranges and mandarins", "produce_whole", 0.20, 20, 80, []),
    ("Tomatoes and cucumbers (whole)", "produce_whole", 0.30, 10, 40, []),
    ("Sealed juice bottles", "beverages_sealed", 0.30, 24, 120, []),
    ("Sealed water bottles", "beverages_sealed", 0.50, 24, 150, []),
    ("Sealed iced tea cans", "beverages_sealed", 0.33, 24, 96, []),
    ("Raw chicken portions", "raw_meat_fish", 0.30, 6, 20, []),
    ("Raw salmon fillets", "raw_meat_fish", 0.25, 6, 18, ["fish"]),
    ("Returned buffet plates", "plate_leftovers", 0.35, 6, 25, []),
    ("Unlabelled container", "unlabelled_unknown", 0.30, 4, 12, []),
]
BY_CAT = {}
for it in ITEMS:
    BY_CAT.setdefault(it[1], []).append(it)

MENU = {
    "restaurant": [("cooked_chilled", 6), ("sandwiches_salads", 2), ("dairy_desserts", 1), ("bakery_ambient", 1)],
    "hotel": [("cooked_chilled", 5), ("dairy_desserts", 3), ("bakery_ambient", 3), ("sandwiches_salads", 2), ("beverages_sealed", 1)],
    "cloud_kitchen": [("cooked_chilled", 5), ("sandwiches_salads", 4)],
    "bakery": [("bakery_ambient", 8), ("dairy_desserts", 2), ("packaged_sealed", 1)],
    "cafe": [("sandwiches_salads", 4), ("bakery_ambient", 4), ("dairy_desserts", 2), ("beverages_sealed", 1)],
    "catering": [("cooked_chilled", 6), ("sandwiches_salads", 2), ("dairy_desserts", 2)],
    "supermarket": [("packaged_sealed", 4), ("produce_whole", 4), ("beverages_sealed", 3), ("bakery_ambient", 2)],
}
MULT = {"hotel": 1.6, "catering": 2.0, "cloud_kitchen": 0.9}
SLOTS = {  # local minutes of day windows
    "restaurant": [(930, 990), (1350, 1425)], "hotel": [(630, 690), (900, 960), (1380, 1430)],
    "bakery": [(1140, 1290)], "cafe": [(960, 1050), (1260, 1350)], "cloud_kitchen": [(1350, 1430)],
    "catering": [(1260, 1410)], "supermarket": [(1200, 1320)],
}
NOTES = ["Pickup from the back entrance.", "Ring the bell twice at the loading bay.", "Keep trays level during transport.",
         "Allergens are labelled on each lid.", "Security desk will hand over the trays.", "Please bring a cool bag."]
SEV = {"green": 0, "amber": 1, "red": 2}


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def qarr(a):
    return "'{" + ",".join(a) + "}'"


def qjson(d):
    return "'" + json.dumps(d, ensure_ascii=False, separators=(",", ":")).replace("'", "''") + "'"


def qts(m):
    return "null" if m is None else f"_t({int(m)})"


def qi(u):
    if u is None:
        return "null"
    kind, key = ID_SRC[u]
    return f"_i('{kind}','{key}')"


def human_list(names):
    if len(names) == 1:
        return names[0]
    return ", ".join(names[:-1]) + " and " + names[-1]


def hm(minutes):
    minutes = int(minutes)
    return f"{minutes // 60}h {minutes % 60:02d}m" if minutes >= 60 else f"{minutes} min"


# ---------------------------------------------------------------- entities
rng0 = random.Random(1)
restaurants = []
for i, (name, vt, cuisine, area) in enumerate(RESTAURANTS):
    lat, lng = jitter(area, rng0)
    restaurants.append({
        "id": uid("restaurant", i), "name": name, "venueType": vt, "cuisine": cuisine, "area": area,
        "lat": lat, "lng": lng, "contactName": CONTACTS[i % len(CONTACTS)], "esgPoints": 0,
    })

fridges = []
for i, (area, host) in enumerate(FRIDGE_SPEC):
    lat, lng = jitter(area, rng0)
    lo, hi = HOST_CAP[host]
    of, ot = HOURS[i % len(HOURS)]
    nm = f"{area} {HOST_LABEL[host]}"
    fridges.append({
        "id": uid("fridge", i), "code": f"FR-{i + 1:03d}", "name": nm, "area": area, "lat": lat, "lng": lng,
        "hostType": host, "placement": "indoor" if host in ("mall_entrance", "residential_tower", "school", "cooperative") else "outdoor_shaded",
        "capacity": rng0.randint(lo, hi), "stock": 0,
        "status": "offline" if i in OFFLINE else "paused" if i in PAUSED else "active",
        "open24h": of is None, "openFrom": None if of is None else f"{of // 60:02d}:{of % 60:02d}",
        "openTo": None if ot is None else f"{ot // 60:02d}:{ot % 60:02d}",
    })
F_BY_ID = {f["id"]: f for f in fridges}

volunteers = []
used = set()
for i in range(38):
    name_rng = random.Random(300 + i)
    while True:
        nm = f"{name_rng.choice(FIRST)} {name_rng.choice(LAST)}"
        if nm not in used:
            used.add(nm)
            break
    r = random.Random(100 + i)
    transport = r.choices(list(TRANSPORT), weights=[45, 10, 20, 15, 10])[0]
    speed, radius, cap = TRANSPORT[transport]
    area = r.choice(list(AREAS))
    lat, lng = jitter(area, r)
    langs = ["English"] + r.sample(LANGS[1:], r.choice([1, 1, 2]))
    volunteers.append({
        "id": uid("volunteer", i), "fullName": nm, "area": area, "lat": lat, "lng": lng, "transport": transport,
        "maxRadiusKm": radius, "maxPortions": cap, "languages": langs, "status": "available" if r.random() < 0.8 else "offline",
        "baseDeliveries": r.randint(4, 70), "joinedM": -r.randint(60, 540) * 1440 + r.randint(0, 1000),
    })
V_BY_ID = {v["id"]: v for v in volunteers}

# ---------------------------------------------------------------- batch engine
deliveries = {f["id"]: [] for f in fridges}
busy = {v["id"]: [] for v in volunteers}


def fill_at(fid, m):
    return sum(p * 0.5 ** ((m - tm) / 360.0) for tm, p in deliveries[fid] if tm <= m)


def fridge_open(f, m):
    if f["open24h"]:
        return True
    a = int(f["openFrom"][:2]) * 60 + int(f["openFrom"][3:])
    b = int(f["openTo"][:2]) * 60 + int(f["openTo"][3:])
    return a <= local_min(m) <= b


def vol_free(vid, a, b):
    return all(b < s or a > e for s, e in busy[vid])


def pick_items(rng, venue, force_cats=None, n=None):
    cats = [c for c, _ in MENU[venue]]
    weights = [w for _, w in MENU[venue]]
    chosen_cats = force_cats or []
    if not chosen_cats:
        n = min(n or rng.choice([1, 1, 2, 2, 3]), len(cats))
        while len(chosen_cats) < n:
            c = rng.choices(cats, weights=weights)[0]
            if c not in chosen_cats or len(cats) == 1:
                chosen_cats.append(c)
            if len(set(cats)) == 1:
                break
    items, seen = [], set()
    for c in chosen_cats:
        pool = [i for i in BY_CAT[c] if i[0] not in seen] or BY_CAT[c]
        name, cat, kgpp, lo, hi, alg = rng.choice(pool)
        seen.add(name)
        mult = MULT.get(venue, 1.0)
        portions = max(4, min(150, int(rng.randint(lo, hi) * mult)))
        items.append({"name": name, "category": cat, "portions": portions, "kg": round(portions * kgpp, 1),
                      "storage": CATS[cat]["storage"], "allergens": list(alg)})
    total = sum(i["portions"] for i in items)
    if total > 120:  # keep a batch within what the largest fridges and vans can handle
        f = 120 / total
        for i in items:
            per_kg = i["kg"] / i["portions"]
            i["portions"] = max(4, int(i["portions"] * f))
            i["kg"] = round(i["portions"] * per_kg, 1)
    return items


def build(idx, rest, t0, *, red=None, low_conf=False, force_cats=None, force_outcomes=None,
          force_escalate_delay=None, no_fail=False):
    rng = random.Random(5000 + idx)
    bid = uid("batch", idx)
    vt = rest["venueType"]
    items = pick_items(rng, vt, force_cats=force_cats)
    temp_violation = False
    if red == "raw_meat_fish":
        items = [dict(zip(("name", "category", "portions", "kg", "storage", "allergens"),
                          (it[0], it[1], rng.randint(it[3], it[4]), 0, "chilled", it[5])))
                 for it in [rng.choice(BY_CAT["raw_meat_fish"])]]
        items[0]["kg"] = round(items[0]["portions"] * 0.3, 1)
    elif red in ("plate_leftovers", "unlabelled_unknown"):
        it = rng.choice(BY_CAT[red])
        p = rng.randint(it[3], it[4])
        items = [{"name": it[0], "category": red, "portions": p, "kg": round(p * it[2], 1), "storage": "ambient", "allergens": []}]
    chilled = any(it["storage"] == "chilled" for it in items)
    if red == "temp" and chilled:
        temp_violation = True
    tier = max((CATS[it["category"]]["tier"] for it in items), key=lambda t: SEV[t])
    if temp_violation:
        tier = "red"
    confidence = round(rng.uniform(0.80, 0.97), 2)
    if red == "unlabelled_unknown":
        confidence = round(rng.uniform(0.40, 0.58), 2)
    if low_conf:
        confidence = round(rng.uniform(0.55, 0.72), 2)
    escalated = low_conf and tier != "red"
    portions = sum(i["portions"] for i in items)
    kg = round(sum(i["kg"] for i in items), 1)
    allergens = sorted({a for i in items for a in i["allergens"]})
    prep_lag = rng.randint(15, 75)
    needs_prep = any(CATS[i["category"]]["tier"] == "amber" or i["category"] == "bakery_ambient" for i in items)
    prepared_m = t0 - prep_lag if needs_prep else None
    temp = None
    if chilled:
        temp = round(rng.uniform(7.5, 11.0), 1) if temp_violation else round(rng.uniform(1.8, 4.9), 1)
    storage = "chilled" if chilled else "ambient"
    windows = []
    for i in items:
        h = CATS[i["category"]].get("max_safe_hours") or 0
        base = prepared_m if (prepared_m is not None and i["category"] in ("cooked_chilled", "sandwiches_salads", "dairy_desserts", "bakery_ambient")) else t0
        windows.append(base + h * 60)
    safe_until = min(windows) if tier != "red" else None

    ev = []
    jobs = []
    checks = []

    def add(m, etype, actor, tone, title, detail, payload=None, job=None):
        ev.append({"m": int(m), "type": etype, "actor": actor, "tone": tone, "title": title, "detail": detail,
                   "payload": payload or {}, "jobId": job})

    names = [i["name"] for i in items]
    add(t0, "photo_received", "restaurant", "neutral", "Photo received", f"{human_list(names)}, about {portions} portions")
    add(t0 + 1, "vision_read", "agent", "neutral" if confidence >= 0.75 else "amber", "Items identified",
        f"{len(items)} item{'s' if len(items) > 1 else ''} read with {int(confidence * 100)}% confidence",
        {"confidence": confidence, "categories": [i["category"] for i in items]})

    reasons = []
    reject_reason = None
    if tier == "red":
        for it in items:
            if CATS[it["category"]]["tier"] == "red":
                hs = next(h for h in RULES["hard_stops"] if h.get("category") == it["category"])
                reasons.append({"code": hs["code"], "text": hs["text"]})
        if temp_violation:
            hs = next(h for h in RULES["hard_stops"] if h["code"] == "temp_above_limit")
            reasons.append({"code": hs["code"], "text": f"Stored at {temp} C, above the {RULES['temperature_c']['chilled_max']} C chilled limit."})
        reject_reason = reasons[0]["text"]
        if red == "unlabelled_unknown":
            reasons.append({"code": "low_confidence", "text": f"Confidence {int(confidence * 100)}% is below the review threshold."})
    elif tier == "amber":
        reasons = [{"code": "prep_time_attested", "text": f"Prepared {prep_lag} min before listing."},
                   {"code": "temp_within_limit", "text": f"Stored at {temp} C, within the {RULES['temperature_c']['chilled_max']} C limit."},
                   {"code": "allergens_declared", "text": "Allergens declared: " + (", ".join(allergens) if allergens else "none")}]
    else:
        reasons = [{"code": "sealed_or_whole", "text": "Sealed, baked or whole items with no temperature condition."}]
    if escalated:
        reasons.append({"code": "low_confidence", "text": f"Confidence {int(confidence * 100)}% is below the auto-list threshold."})

    tone = {"green": "green", "amber": "amber", "red": "red"}[tier]
    add(t0 + 1, "safety_check", "agent", tone, f"Safety check: {tier}", reasons[0]["text"] if tier != "amber" else reasons[1]["text"],
        {"tier": tier, "rule_set": RULE_VERSION, "reasons": [r["code"] for r in reasons]})
    checks.append({"id": uid("check", f"{idx}-a"), "batchId": bid, "ruleSetVersion": RULE_VERSION, "tier": tier,
                   "passed": tier != "red" and not escalated, "confidence": confidence, "reasons": reasons,
                   "decidedBy": "agent", "m": t0 + 1})

    result = {"status": None, "fridge": None, "impact": None}
    t_next = t0 + 3

    def finish(status, extra=None):
        return {
            "id": bid, "idx": idx, "restaurantId": rest["id"], "status": status, "tier": tier, "submitted_m": t0, "prepared_m": prepared_m,
            "storedTempC": temp, "storage": storage, "allergens": allergens, "estPortions": portions, "estKg": kg,
            "confidence": confidence, "notes": rng.choice(NOTES) if rng.random() < 0.18 else None,
            "pickupFrom_m": None, "pickupUntil_m": None, "safeUntil_m": safe_until, "fridgeId": None,
            "rejectReason": reject_reason, "items": items, "safetyChecks": checks, "jobs": jobs, "events": ev, "impact": None,
            "stock": [],
        }

    if tier == "red":
        add(t0 + 2, "rejected", "agent", "red", "Batch declined", reject_reason, {"reason": reasons[0]["code"]})
        return finish("rejected")

    add(t0 + 2, "safe_window_set", "agent", "green", "Safe window set", f"Safe for {hm(safe_until - t0)} from listing",
        {"safe_until_minutes": safe_until - t0})

    if escalated:
        delay = force_escalate_delay or rng.randint(8, 28)
        add(t0 + 2, "escalated", "agent", "amber", "Sent to coordinator",
            f"Confidence {int(confidence * 100)}% is below the auto-list threshold", {"confidence": confidence})
        t_dec = t0 + 2 + delay
        if force_escalate_delay or rng.random() < 0.7:
            add(t_dec, "coordinator_decision", "coordinator", "green", "Coordinator approved", "Approved after visual review", {"approved": True})
            checks.append({"id": uid("check", f"{idx}-c"), "batchId": bid, "ruleSetVersion": RULE_VERSION, "tier": tier,
                           "passed": True, "confidence": confidence, "reasons": [{"code": "coordinator_override", "text": "Approved after visual review."}],
                           "decidedBy": "coordinator", "m": t_dec})
            t_next = t_dec + 1
        else:
            reject_reason = "Photo too unclear to confirm the contents."
            add(t_dec, "coordinator_decision", "coordinator", "red", "Coordinator declined", "Declined: " + reject_reason, {"approved": False})
            checks.append({"id": uid("check", f"{idx}-c"), "batchId": bid, "ruleSetVersion": RULE_VERSION, "tier": tier,
                           "passed": False, "confidence": confidence, "reasons": [{"code": "coordinator_decline", "text": reject_reason}],
                           "decidedBy": "coordinator", "m": t_dec})
            b = finish("rejected")
            b["rejectReason"] = reject_reason
            return b

    # fridge match
    cands = []
    for f in fridges:
        if f["status"] != "active" or not fridge_open(f, t_next + 40):
            continue
        d = road_km((rest["lat"], rest["lng"]), (f["lat"], f["lng"]))
        if d > RULES["dispatch"]["max_distance_km"]:
            continue
        fill = fill_at(f["id"], t_next)
        if portions > f["capacity"] - fill:
            continue
        cands.append((d + 4 * (fill / f["capacity"]) + rng.random() * 0.8, d, f))
    if not cands:
        add(t_next, "no_fridge", "agent", "red", "No fridge available", "No open fridge had room inside the safe window", {})
        add(t_next + 1, "expired", "agent", "red", "Batch expired", "Nothing could be matched in time", {})
        return finish("expired")
    cands.sort(key=lambda c: c[0])
    _, fdist, fr = cands[0]
    t_match = t_next
    add(t_match, "fridge_matched", "agent", "green", "Fridge matched",
        f"{fr['code']} {fr['name']}, {fdist:.1f} km away", {"distance_km": fdist})

    # volunteers
    vc = []
    for v in volunteers:
        if v["status"] == "offline":
            continue
        vd = road_km((v["lat"], v["lng"]), (rest["lat"], rest["lng"]))
        if vd <= v["maxRadiusKm"] and v["maxPortions"] >= portions:
            vc.append((vd + rng.random() * 2.0, vd, v))
    vc.sort(key=lambda c: c[0])
    outcomes = force_outcomes or [rng.choices(["accept", "decline", "timeout"], weights=[72, 14, 14])[0],
                                  rng.choices(["accept", "decline", "timeout"], weights=[85, 10, 5])[0],
                                  rng.choices(["accept", "decline"], weights=[90, 10])[0]]
    t_cursor = t_match + 1
    accepted = None
    attempt = 0
    for _, vd, v in vc:
        if attempt >= RULES["dispatch"]["max_offer_attempts"]:
            break
        if not vol_free(v["id"], t_cursor, t_cursor + 60) and not no_fail:
            continue
        outcome = outcomes[attempt] if attempt < len(outcomes) else "accept"
        speed = TRANSPORT[v["transport"]][0]
        eta = int(round(vd / speed * 60)) + 3
        jid = uid("job", f"{idx}-{attempt}")
        add(t_cursor, "volunteer_offered", "agent", "neutral", "Offer sent",
            f"Offered to {v['fullName']} ({v['transport'].replace('_', ' ')}), about {eta} min from pickup",
            {"attempt": attempt + 1, "eta_min": eta}, jid)
        job = {"id": jid, "batchId": bid, "volunteerId": v["id"], "fridgeId": fr["id"], "status": "offered", "attempt": attempt + 1,
               "offered_m": t_cursor, "responded_m": None, "pickedUp_m": None, "delivered_m": None,
               "distanceKm": fdist, "pickupEtaMin": eta}
        jobs.append(job)
        if outcome == "decline":
            d = rng.randint(1, 3)
            job["status"], job["responded_m"] = "declined", t_cursor + d
            add(t_cursor + d, "offer_declined", "volunteer", "amber", "Offer declined", f"{v['fullName']} declined", {}, jid)
            t_cursor += d + 1
        elif outcome == "timeout":
            job["status"] = "timed_out"
            tt = RULES["dispatch"]["offer_timeout_minutes"]
            add(t_cursor + tt, "offer_timed_out", "system", "amber", "Offer timed out", f"No reply from {v['fullName']} after {tt} min", {}, jid)
            t_cursor += tt + 1
        else:
            d = rng.randint(1, 4)
            job["status"], job["responded_m"] = "accepted", t_cursor + d
            accepted = (job, v, vd, eta)
            break
        attempt += 1

    if not accepted:
        add(t_cursor, "no_volunteer", "agent", "red", "No volunteer available", "No offer was accepted inside the safe window", {})
        add(t_cursor + 1, "expired", "agent", "red", "Batch expired", "The safe window closed before pickup", {})
        b = finish("expired")
        b["fridgeId"] = fr["id"]
        b["pickupFrom_m"], b["pickupUntil_m"] = t0 + 5, max(t0 + 65, safe_until - 45)
        return b

    job, v, vd, eta = accepted
    speed = TRANSPORT[v["transport"]][0]
    t_acc = job["responded_m"]
    t_pick = t_acc + eta
    t_del = t_pick + int(round(fdist / speed * 60)) + 4
    if not no_fail and t_del > safe_until - 5:
        add(t_acc, "volunteer_accepted", "volunteer", "green", "Volunteer assigned", f"{v['fullName']} accepted", {}, job["id"])
        add(t_acc + 2, "expired", "agent", "red", "Batch expired", "The safe window would close before delivery", {})
        job["status"] = "cancelled"
        b = finish("expired")
        b["fridgeId"] = fr["id"]
        return b

    busy[v["id"]].append((t_acc, t_del + 5))
    add(t_acc, "volunteer_accepted", "volunteer", "green", "Volunteer assigned", f"{v['fullName']} accepted; pickup in about {eta} min",
        {"eta_min": eta}, job["id"])
    add(t_pick, "picked_up", "volunteer", "green", "Picked up", f"{v['fullName']} collected {portions} portions", {"portions": portions}, job["id"])
    add(t_del, "delivered", "volunteer", "green", "Delivered to fridge", f"{fr['code']} stock +{portions}",
        {"portions": portions}, job["id"])
    meals = portions
    co2 = round(kg * FACTORS["co2e_kg_per_kg_food"], 1)
    pts = meals * FACTORS["esg_points_per_meal"]
    add(t_del + 1, "impact_logged", "system", "green", "Impact recorded", f"{meals} meals, {kg} kg, about {co2} kg CO2e",
        {"meals": meals, "kg": kg, "co2e_kg": co2, "esg_points": pts, "factor_version": FACTOR_VERSION})
    job.update({"status": "delivered", "pickedUp_m": t_pick, "delivered_m": t_del})
    deliveries[fr["id"]].append((t_del, portions))
    b = finish("closed")
    b.update({"fridgeId": fr["id"], "pickupFrom_m": t0 + 5, "pickupUntil_m": max(t0 + 65, safe_until - 45),
              "impact": {"id": uid("impact", idx), "batchId": bid, "restaurantId": rest["id"], "meals": meals, "kg": kg,
                         "co2eKg": co2, "esgPoints": pts, "factorVersion": FACTOR_VERSION, "m": t_del + 1}})
    return b


def shift(b, delta):
    for k in ("submitted_m", "prepared_m", "pickupFrom_m", "pickupUntil_m", "safeUntil_m"):
        if b[k] is not None:
            b[k] += delta
    for e in b["events"]:
        e["m"] += delta
    for c in b["safetyChecks"]:
        c["m"] += delta
    for j in b["jobs"]:
        for k in ("offered_m", "responded_m", "pickedUp_m", "delivered_m"):
            if j[k] is not None:
                j[k] += delta
    if b["impact"]:
        b["impact"]["m"] += delta


def truncate_to_target(b, target):
    """Keep the story only up to the target event, so the batch is genuinely 'live' in that state."""
    k = next(i for i, e in enumerate(b["events"]) if e["type"] == target)
    cutoff = b["events"][k]["m"]
    b["events"] = b["events"][: k + 1]
    jobs = []
    for j in b["jobs"]:
        if j["offered_m"] > cutoff:
            continue
        if j["responded_m"] is not None and j["responded_m"] > cutoff:
            j["responded_m"] = None
            j["status"] = "offered"
        if j["pickedUp_m"] is not None and j["pickedUp_m"] > cutoff:
            j["pickedUp_m"] = None
            if j["status"] in ("delivered", "picked_up"):
                j["status"] = "accepted"
        if j["delivered_m"] is not None and j["delivered_m"] > cutoff:
            j["delivered_m"] = None
            if j["status"] == "delivered":
                j["status"] = "picked_up"
        jobs.append(j)
    b["jobs"] = jobs
    b["safetyChecks"] = [c for c in b["safetyChecks"] if c["m"] <= cutoff]
    b["impact"] = None
    b["status"] = {"safe_window_set": "listed", "escalated": "escalated", "volunteer_offered": "matched",
                   "volunteer_accepted": "dispatched", "picked_up": "picked_up"}[target]
    if target in ("safe_window_set", "escalated"):
        b["fridgeId"] = None
    return b


def time_of_day(rng, vt):
    lo, hi = rng.choice(SLOTS[vt])
    return rng.randint(lo, hi)


# ---------------------------------------------------------------- build the history
plans = []
for idx in range(N_HISTORY):
    rest = restaurants[random.Random(idx).choices(range(len(restaurants)), weights=[2 if r["venueType"] in ("catering", "cloud_kitchen") else 3 for r in restaurants])[0]]
    rng = random.Random(9000 + idx)
    for _ in range(20):
        d = int(DAYS * rng.random() ** 1.15)
        m = -d * 1440 + (time_of_day(rng, rest["venueType"]) - ANCHOR_LOCAL_MIN)
        if m <= -150:
            break
    roll = rng.random()
    kw = {}
    if roll < 0.05 and rest["venueType"] in ("restaurant", "hotel", "catering", "supermarket"):
        kw["red"] = "raw_meat_fish"
    elif roll < 0.09 and rest["venueType"] in ("hotel", "catering", "restaurant"):
        kw["red"] = "plate_leftovers"
    elif roll < 0.115:
        kw["red"] = "unlabelled_unknown"
    elif roll < 0.15 and rest["venueType"] in ("restaurant", "hotel", "catering", "cloud_kitchen", "cafe"):
        kw["red"] = "temp"
    elif roll < 0.21:
        kw["low_conf"] = True
    plans.append((m, idx, rest, kw))
plans.sort(key=lambda p: p[0])
batches = [build(idx, rest, m, **kw) for m, idx, rest, kw in plans]

# ---------------------------------------------------------------- live (active) batches
ACTIVE = [
    (1000, "Oasis Fresh Market", dict(force_cats=["packaged_sealed", "beverages_sealed"], no_fail=True), "safe_window_set", -4),
    (1001, "Saffron & Salt Kitchen", dict(force_cats=["cooked_chilled", "dairy_desserts"], no_fail=True), "volunteer_offered", -3),
    (1002, "Marigold Biryani House", dict(force_cats=["cooked_chilled"], no_fail=True), "volunteer_accepted", -5),
    (1003, "Sunrise Sandwich Co.", dict(force_cats=["sandwiches_salads", "bakery_ambient"], no_fail=True), "picked_up", -6),
    (1004, "Zaytoun Mezze Bar", dict(force_cats=["cooked_chilled"], low_conf=True, force_escalate_delay=45, no_fail=True), "escalated", -12),
    (1005, "Palm Crescent Hotel", dict(force_cats=["cooked_chilled", "bakery_ambient"], force_outcomes=["decline", "accept"], no_fail=True), "volunteer_accepted", -8),
    (1006, "Golden Crust Bakehouse", dict(force_cats=["bakery_ambient", "dairy_desserts"], no_fail=True), "safe_window_set", -9),
]
for idx, rname, kw, target, at in ACTIVE:
    rest = next(r for r in restaurants if r["name"] == rname)
    b = build(idx, rest, -20, **kw)
    ev0 = next(e for e in b["events"] if e["type"] == target)
    shift(b, at - ev0["m"])
    batches.append(truncate_to_target(b, target))
    for j in b["jobs"]:
        if j["status"] in ("accepted", "picked_up", "offered"):
            busy[j["volunteerId"]].append((-30, 90))

# ---------------------------------------------------------------- fridge stock log
stock_log = []
sr = random.Random(77)
for b in batches:
    if b["status"] in ("closed",) and b["impact"]:
        fr = next(j for j in b["jobs"] if j["status"] == "delivered")
        f = F_BY_ID[fr["fridgeId"]]
        t_del = fr["delivered_m"]
        n = b["estPortions"]
        stock_log.append({"id": uid("stock", f"{b['idx']}-in"), "fridgeId": f["id"], "batchId": b["id"], "delta": n, "reason": "delivered", "m": t_del})
        takes = sr.randint(2, 4)
        share = int(n * sr.uniform(0.82, 0.96))
        cuts = sorted(sr.sample(range(1, max(share, takes + 1)), takes - 1)) if share > takes else []
        parts = [b2 - a for a, b2 in zip([0] + cuts, cuts + [share])]
        for k, p in enumerate(parts):
            tm = t_del + sr.randint(20, 900)
            if tm <= -5 and p > 0:
                stock_log.append({"id": uid("stock", f"{b['idx']}-t{k}"), "fridgeId": f["id"], "batchId": b["id"], "delta": -p, "reason": "taken", "m": tm})
        left = n - share
        tm = t_del + 1440
        if left > 0 and tm <= -5:
            stock_log.append({"id": uid("stock", f"{b['idx']}-x"), "fridgeId": f["id"], "batchId": b["id"], "delta": -left, "reason": "expired", "m": tm})
    elif b["status"] in ("picked_up",) or any(j["status"] == "delivered" for j in b["jobs"]):
        pass
# community drop-offs that did not come through the app
for fi, f in enumerate(fridges):
    if f["status"] != "active" or sr.random() > 0.8:
        continue
    n = min(int(f['capacity'] * 0.9), sr.randint(20, 62))
    tm = -sr.randint(40, 600)
    stock_log.append({"id": uid("stock", f"c{fi}"), "fridgeId": f["id"], "batchId": None, "delta": n, "reason": "delivered", "m": tm})
    took = int(n * sr.uniform(0.1, 0.45))
    if took:
        stock_log.append({"id": uid("stock", f"c{fi}t"), "fridgeId": f["id"], "batchId": None, "delta": -took, "reason": "taken", "m": tm + sr.randint(30, 240)})
stock_log = [s for s in stock_log if s["m"] <= -2]
stock_log.sort(key=lambda s: s["m"])
totals = {}
for s in stock_log:
    totals[s["fridgeId"]] = totals.get(s["fridgeId"], 0) + s["delta"]
for f in fridges:
    f["stock"] = 0 if f["status"] == "offline" else max(0, min(f["capacity"], totals.get(f["id"], 0)))

# ---------------------------------------------------------------- roll-ups
esg = {}
vol_deliveries = {}
for b in batches:
    if b["impact"]:
        esg[b["restaurantId"]] = esg.get(b["restaurantId"], 0) + b["impact"]["esgPoints"]
    for j in b["jobs"]:
        if j["status"] == "delivered":
            vol_deliveries[j["volunteerId"]] = vol_deliveries.get(j["volunteerId"], 0) + 1
for r in restaurants:
    r["esgPoints"] = esg.get(r["id"], 0)
active_vols = set()
for b in batches:
    for j in b["jobs"]:
        if j["status"] in ("accepted", "picked_up", "offered"):
            active_vols.add(j["volunteerId"])
for v in volunteers:
    v["totalDeliveries"] = v["baseDeliveries"] + vol_deliveries.get(v["id"], 0)
    if v["id"] in active_vols:
        v["status"] = "busy"
batches.sort(key=lambda b: b["submitted_m"])

# ---------------------------------------------------------------- write SQL
os.makedirs(SQL_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)
for fn in os.listdir(SQL_DIR):
    if fn.startswith("seed_part"):
        os.remove(os.path.join(SQL_DIR, fn))
HEADER = ("-- BARAKAT sample data (all fictional). Generated by tools/generate_seed.py.\n"
          "-- Needs 01_schema.sql first. Safe to re-run: fixed ids, conflicts are skipped.\n")
MAX_BYTES = 150_000
stmts = []


def add_insert(table, cols, rows, per=100):
    for i in range(0, len(rows), per):
        stmts.append(f"insert into public.{table} ({', '.join(cols)}) values\n" + ",\n".join(rows[i:i + per]) + "\non conflict do nothing;\n")


stmts.append("insert into public.app_config (key, value) values\n"
             f"('safety_rules', {qjson(RULES)}),\n('impact_factors', {qjson(FACTORS)})\n"
             "on conflict (key) do update set value = excluded.value, updated_at = now();\n")
add_insert("restaurants", ["id", "name", "venue_type", "cuisine", "area", "lat", "lng", "contact_name", "esg_points", "is_sample"],
           [f"({qi(r['id'])},{q(r['name'])},{q(r['venueType'])},{q(r['cuisine'])},{q(r['area'])},{r['lat']},{r['lng']},{q(r['contactName'])},{r['esgPoints']},true)" for r in restaurants])
add_insert("fridges", ["id", "code", "name", "area", "lat", "lng", "host_type", "placement", "capacity_portions", "current_stock", "status", "open_24h", "open_from", "open_to", "is_sample"],
           [f"({qi(f['id'])},{q(f['code'])},{q(f['name'])},{q(f['area'])},{f['lat']},{f['lng']},{q(f['hostType'])},{q(f['placement'])},{f['capacity']},{f['stock']},{q(f['status'])},{q(f['open24h'])},{q(f['openFrom'])},{q(f['openTo'])},true)" for f in fridges])
add_insert("volunteers", ["id", "full_name", "area", "lat", "lng", "transport", "max_radius_km", "max_portions", "languages", "status", "total_deliveries", "joined_at", "is_sample"],
           [f"({qi(v['id'])},{q(v['fullName'])},{q(v['area'])},{v['lat']},{v['lng']},{q(v['transport'])},{v['maxRadiusKm']},{v['maxPortions']},{qarr(v['languages'])},{q(v['status'])},{v['totalDeliveries']},{qts(v['joinedM'])},true)" for v in volunteers])
add_insert("batches", ["id", "restaurant_id", "status", "tier", "submitted_at", "prepared_at", "stored_temp_c", "storage", "allergens", "est_portions", "est_kg", "confidence", "notes", "pickup_from", "pickup_until", "safe_until", "fridge_id", "reject_reason", "is_sample"],
           [f"({qi(b['id'])},{qi(b['restaurantId'])},{q(b['status'])},{q(b['tier'])},{qts(b['submitted_m'])},{qts(b['prepared_m'])},{q(b['storedTempC'])},{q(b['storage'])},{qarr(b['allergens'])},{b['estPortions']},{b['estKg']},{b['confidence']},{q(b['notes'])},{qts(b['pickupFrom_m'])},{qts(b['pickupUntil_m'])},{qts(b['safeUntil_m'])},{qi(b['fridgeId'])},{q(b['rejectReason'])},true)" for b in batches])
item_rows, check_rows, job_rows, event_rows, impact_rows = [], [], [], [], []
for b in batches:
    for k, it in enumerate(b["items"]):
        item_rows.append(f"({qi(uid('item', f'{b['idx']}-{k}'))},{qi(b['id'])},{q(it['name'])},{q(it['category'])},{it['portions']},{it['kg']},{q(it['storage'])},{qarr(it['allergens'])},true)")
    for c in b["safetyChecks"]:
        check_rows.append(f"({qi(c['id'])},{qi(b['id'])},{q(c['ruleSetVersion'])},{q(c['tier'])},{q(c['passed'])},{c['confidence']},{qjson(c['reasons'])},{q(c['decidedBy'])},{qts(c['m'])},true)")
    for j in b["jobs"]:
        job_rows.append(f"({qi(j['id'])},{qi(b['id'])},{qi(j['volunteerId'])},{qi(j['fridgeId'])},{q(j['status'])},{j['attempt']},{qts(j['offered_m'])},{qts(j['responded_m'])},{qts(j['pickedUp_m'])},{qts(j['delivered_m'])},{j['distanceKm']},{j['pickupEtaMin']},true)")
    for k, e in enumerate(b["events"]):
        event_rows.append(f"({qi(uid('event', f'{b['idx']}-{k}'))},{qi(b['id'])},{qi(e['jobId'])},{q(e['type'])},{q(e['actor'])},{q(e['tone'])},{q(e['title'])},{q(e['detail'])},{qjson(e['payload'])},{qts(e['m'])},true)")
    if b["impact"]:
        i = b["impact"]
        impact_rows.append(f"({qi(i['id'])},{qi(b['id'])},{qi(i['restaurantId'])},{i['meals']},{i['kg']},{i['co2eKg']},{i['esgPoints']},{q(i['factorVersion'])},{qts(i['m'])},true)")
add_insert("batch_items", ["id", "batch_id", "name", "category", "portions", "kg", "storage", "allergens", "is_sample"], item_rows)
add_insert("safety_checks", ["id", "batch_id", "rule_set_version", "tier", "passed", "confidence", "reasons", "decided_by", "created_at", "is_sample"], check_rows)
add_insert("jobs", ["id", "batch_id", "volunteer_id", "fridge_id", "status", "attempt", "offered_at", "responded_at", "picked_up_at", "delivered_at", "distance_km", "pickup_eta_min", "is_sample"], job_rows)
add_insert("agent_events", ["id", "batch_id", "job_id", "event_type", "actor", "tone", "title", "detail", "payload", "created_at", "is_sample"], event_rows, per=150)
add_insert("fridge_stock_log", ["id", "fridge_id", "batch_id", "delta_portions", "reason", "created_at", "is_sample"],
           [f"({qi(s['id'])},{qi(s['fridgeId'])},{qi(s['batchId'])},{s['delta']},{q(s['reason'])},{qts(s['m'])},true)" for s in stock_log], per=200)
add_insert("impact_logs", ["id", "batch_id", "restaurant_id", "meals", "kg", "co2e_kg", "esg_points", "factor_version", "created_at", "is_sample"], impact_rows)

files, cur, size = [], [], 0
for st in stmts:
    if cur and size + len(st) > MAX_BYTES:
        files.append(cur)
        cur, size = [], 0
    cur.append(st)
    size += len(st)
if cur:
    files.append(cur)
written = []
for n, group in enumerate(files, 1):
    tables = []
    for st in group:
        t = re.match(r"insert into public\.(\w+)", st).group(1)
        if t not in tables:
            tables.append(t)
    name = f"seed_part{n}of{len(files)}.sql"
    body = HEADER + f"-- Part {n} of {len(files)}. Contains: {', '.join(tables)}\n\n" + "\n".join(group)
    with open(os.path.join(SQL_DIR, name), "w", encoding="utf-8") as fh:
        fh.write(body)
    written.append((name, ", ".join(tables), len(body)))

# ---------------------------------------------------------------- write JSON fallback
def out_batch(b):
    o = {k: v for k, v in b.items() if not k.endswith("_m") and k not in ("items", "safetyChecks", "jobs", "events", "impact", "stock")}
    for k in ("submitted", "prepared", "pickupFrom", "pickupUntil", "safeUntil"):
        v = b[k + "_m"]
        o[k + "At"] = None if v is None else iso(v)
    o["items"] = b["items"]
    o["safetyChecks"] = [{**{k: v for k, v in c.items() if k != "m"}, "createdAt": iso(c["m"])} for c in b["safetyChecks"]]
    o["jobs"] = [{**{k: v for k, v in j.items() if not k.endswith("_m")},
                  "offeredAt": iso(j["offered_m"]), "respondedAt": None if j["responded_m"] is None else iso(j["responded_m"]),
                  "pickedUpAt": None if j["pickedUp_m"] is None else iso(j["pickedUp_m"]),
                  "deliveredAt": None if j["delivered_m"] is None else iso(j["delivered_m"])} for j in b["jobs"]]
    o["events"] = [{"type": e["type"], "actor": e["actor"], "tone": e["tone"], "title": e["title"], "detail": e["detail"],
                    "payload": e["payload"], "jobId": e["jobId"], "createdAt": iso(e["m"])} for e in b["events"]]
    o["impact"] = None if not b["impact"] else {**{k: v for k, v in b["impact"].items() if k != "m"}, "createdAt": iso(b["impact"]["m"])}
    return o


bundle = {
    "anchor": iso(0), "ruleSetVersion": RULE_VERSION, "factorVersion": FACTOR_VERSION,
    "restaurants": restaurants, "fridges": fridges,
    "volunteers": [{k: v for k, v in x.items() if k not in ("baseDeliveries", "joinedM")} | {"joinedAt": iso(x["joinedM"])} for x in volunteers],
    "batches": [out_batch(b) for b in batches],
    "stockLog": [{**{k: v for k, v in s.items() if k != "m"}, "createdAt": iso(s["m"])} for s in stock_log],
}
with open(os.path.join(JSON_DIR, "seed.json"), "w", encoding="utf-8") as fh:
    json.dump(bundle, fh, ensure_ascii=False, separators=(",", ":"))

# ---------------------------------------------------------------- report
by_status = {}
for b in batches:
    by_status[b["status"]] = by_status.get(b["status"], 0) + 1
by_tier = {}
for b in batches:
    by_tier[b["tier"]] = by_tier.get(b["tier"], 0) + 1
print("restaurants", len(restaurants), "fridges", len(fridges), "volunteers", len(volunteers), "batches", len(batches))
print("items", len(item_rows), "checks", len(check_rows), "jobs", len(job_rows), "events", len(event_rows), "stock", len(stock_log), "impact", len(impact_rows))
print("status", by_status)
print("tier", by_tier)
print("meals", sum(b["impact"]["meals"] for b in batches if b["impact"]), "kg", round(sum(b["impact"]["kg"] for b in batches if b["impact"]), 1))
print("stock fill", sorted([(f["code"], f["stock"], f["capacity"], f["status"]) for f in fridges], key=lambda x: -x[1])[:8])
for n, t, sz in written:
    print(f"{n:24s} {sz:8d} bytes  {t}")
