// Times are stored in UTC and shown in each airport's local time, as an
// airline would print them on a ticket or a departures board.

const TIME_ZONES: Record<string, string> = {
  MAN: "Europe/London", EDI: "Europe/London", GLA: "Europe/London", ABZ: "Europe/London",
  BFS: "Europe/London", JER: "Europe/Jersey", NQY: "Europe/London", DUB: "Europe/Dublin",
  AMS: "Europe/Amsterdam", CDG: "Europe/Paris", NCE: "Europe/Paris", FRA: "Europe/Berlin",
  MUC: "Europe/Berlin", BRU: "Europe/Brussels", ZRH: "Europe/Zurich", GVA: "Europe/Zurich",
  VIE: "Europe/Vienna", PRG: "Europe/Prague", BUD: "Europe/Budapest", WAW: "Europe/Warsaw",
  CPH: "Europe/Copenhagen", OSL: "Europe/Oslo", ARN: "Europe/Stockholm", HEL: "Europe/Helsinki",
  KEF: "Atlantic/Reykjavik", MAD: "Europe/Madrid", BCN: "Europe/Madrid", PMI: "Europe/Madrid",
  IBZ: "Europe/Madrid", AGP: "Europe/Madrid", ALC: "Europe/Madrid", TFS: "Atlantic/Canary",
  LPA: "Atlantic/Canary", LIS: "Europe/Lisbon", FAO: "Europe/Lisbon", FCO: "Europe/Rome",
  MXP: "Europe/Rome", ATH: "Europe/Athens",
};

export function timeZone(airport: string): string {
  return TIME_ZONES[airport] ?? "UTC";
}

/** 14:05, in the airport's local time. */
export function localTime(iso: string, airport: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timeZone(airport) }).format(
    new Date(iso),
  );
}

/** Thu 26 Nov, in the airport's local time. */
export function localDate(iso: string, airport: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timeZone(airport),
  }).format(new Date(iso));
}

/** +1 when the arrival falls on a later local day than the departure. */
export function dayOffset(departureIso: string, origin: string, arrivalIso: string, destination: string): number {
  const day = (iso: string, airport: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timeZone(airport) }).format(new Date(iso));
  const ms = Date.parse(day(arrivalIso, destination)) - Date.parse(day(departureIso, origin));
  return Math.round(ms / 86_400_000);
}

export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function money(amount: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

/** Today's date (YYYY-MM-DD) in the UK, where Northcrest's bases are. */
export function todayInUk(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
