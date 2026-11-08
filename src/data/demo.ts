import { post } from "./dispatch";

/** Demo accounts can choose whom to play. These calls only work for the demo volunteer and demo fridge host. */
export const DEMO_VOLUNTEER_EMAIL = "volunteer.demo@barakat.test";
export const DEMO_HOST_EMAIL = "host.demo@barakat.test";

export type DemoVolunteer = { id: string; name: string; area: string; transport: string; status: string; hasOffer: boolean; onTrip: boolean; current: boolean };
export type DemoFridge = { id: string; code: string; name: string; area: string; stock: number; capacity: number; incoming: number; current: boolean };

export const listDemoVolunteers = () => post<{ volunteers: DemoVolunteer[] }>({ action: "demo_volunteers" });
export const chooseDemoVolunteer = (volunteerId: string) => post<Record<string, never>>({ action: "demo_set_volunteer", volunteerId });
export const listDemoFridges = () => post<{ fridges: DemoFridge[] }>({ action: "demo_fridges" });
export const chooseDemoFridge = (fridgeId: string) => post<Record<string, never>>({ action: "demo_set_fridge", fridgeId });
