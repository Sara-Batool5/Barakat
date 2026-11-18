import { post } from "./dispatch";

export type HealthCheck = { id: string; ok: boolean; detail?: string };

/** Asks the server whether keys, database, photo storage and the scheduler are set up (coordinators only). */
export const runHealthCheck = () => post<{ checks: HealthCheck[] }>({}, "/api/health");
