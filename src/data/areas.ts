/** Approximate area centres, used to place a new venue or volunteer on the map. */
export const AREAS: Record<string, { lat: number; lng: number }> = {
  "Al Quoz": { lat: 25.137, lng: 55.229 },
  "Al Karama": { lat: 25.2437, lng: 55.304 },
  Deira: { lat: 25.2697, lng: 55.3095 },
  "Bur Dubai": { lat: 25.2532, lng: 55.2972 },
  "Al Satwa": { lat: 25.2285, lng: 55.275 },
  Jumeirah: { lat: 25.2144, lng: 55.259 },
  "Business Bay": { lat: 25.1851, lng: 55.2625 },
  "Downtown Dubai": { lat: 25.1972, lng: 55.2744 },
  "Dubai Marina": { lat: 25.0805, lng: 55.1403 },
  JLT: { lat: 25.0657, lng: 55.1413 },
  JBR: { lat: 25.078, lng: 55.133 },
  "Al Barsha": { lat: 25.113, lng: 55.2 },
  "Al Nahda": { lat: 25.2914, lng: 55.3705 },
  "Al Qusais": { lat: 25.274, lng: 55.378 },
  Mirdif: { lat: 25.2181, lng: 55.4207 },
  "International City": { lat: 25.165, lng: 55.408 },
  "Dubai Silicon Oasis": { lat: 25.1255, lng: 55.3815 },
  "Jebel Ali": { lat: 25.01, lng: 55.06 },
  "Dubai Investments Park": { lat: 24.9807, lng: 55.1636 },
  "Motor City": { lat: 25.048, lng: 55.24 },
  "Al Garhoud": { lat: 25.245, lng: 55.35 },
  "Oud Metha": { lat: 25.237, lng: 55.31 },
  DIFC: { lat: 25.2138, lng: 55.2796 },
  "Dubai Hills": { lat: 25.1, lng: 55.25 },
  "Al Warqa": { lat: 25.202, lng: 55.42 },
  "Umm Suqeim": { lat: 25.156, lng: 55.209 },
};

export const AREA_NAMES = Object.keys(AREAS).sort();

export const VENUE_TYPES = ["restaurant", "hotel", "cloud_kitchen", "bakery", "cafe", "catering", "supermarket"] as const;

export const TRANSPORTS = ["car", "van", "scooter", "bike", "on_foot"] as const;
/** [max radius km, max portions per trip] */
export const TRANSPORT_LIMITS: Record<(typeof TRANSPORTS)[number], [number, number]> = {
  car: [15, 80],
  van: [20, 200],
  scooter: [10, 30],
  bike: [6, 20],
  on_foot: [2, 12],
};

export const LANGUAGES = ["English", "Arabic", "Urdu", "Hindi", "Tagalog", "Malayalam", "Bengali", "Russian", "French", "Persian"] as const;
