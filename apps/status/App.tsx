import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, traced } from "../../shared/api";
import { localTime, todayInUk } from "../../shared/format";
import type { Airport, Board, FlightState, FlightWithStatus } from "../../shared/types";
import { Layout, Loading, Notice } from "../../shared/ui";

const REFRESH_MS = 60_000;

const LABELS: Record<FlightState, string> = {
  SCHEDULED: "On time",
  DELAYED: "Delayed",
  BOARDING: "Boarding",
  GATE_CLOSED: "Gate closed",
  DEPARTED: "Departed",
  LANDED: "Landed",
  CANCELLED: "Cancelled",
};

export function App() {
  const bookingUrl = import.meta.env.VITE_BOOKING_URL;
  const nav = [{ href: "/", label: "Departures and arrivals", current: true }];
  if (bookingUrl) nav.push({ href: bookingUrl, label: "Book flights", current: false });
  return (
    <Layout section="Flight status" nav={nav}>
      <FlightLookup />
      <Boards />
    </Layout>
  );
}

function Boards() {
  const params = new URLSearchParams(location.search);
  const [airports, setAirports] = useState<Airport[] | null>(null);
  const [airport, setAirport] = useState(params.get("airport")?.toUpperCase() ?? "MAN");
  const [direction, setDirection] = useState<Board["direction"]>(
    params.get("direction") === "arrivals" ? "arrivals" : "departures",
  );
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    api<{ airports: Airport[] }>("/api/status/airports")
      .then((r) => setAirports(r.airports.sort((a, b) => a.city.localeCompare(b.city))))
      .catch((e: ApiError) => setError(e.message));
  }, []);

  const load = useCallback(() => {
    const q = new URLSearchParams({ airport, direction, date: todayInUk() });
    return traced("load board", { "northcrest.airport": airport, "northcrest.board": direction }, () =>
      api<Board>(`/api/status/board?${q}`),
    )
      .then((b) => {
        setBoard(b);
        setError(null);
        setUpdated(new Date());
      })
      .catch((e: ApiError) => setError(e.message));
  }, [airport, direction]);

  useEffect(() => {
    setBoard(null);
    history.replaceState(null, "", `/?airport=${airport}&direction=${direction}`);
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, airport, direction]);

  const cityOf = (code: string) => airports?.find((a) => a.code === code)?.city ?? code;
  const here = cityOf(airport);

  return (
    <section aria-labelledby="board-title">
      <h1 id="board-title">
        {here} {direction}
      </h1>
      <div className="day-nav">
        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="airport">Airport</label>
          <select id="airport" value={airport} onChange={(e) => setAirport(e.target.value)}>
            {(airports ?? [{ code: airport, city: airport, name: airport, country: "" }]).map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="tabs" role="tablist" aria-label="Board">
          {(["departures", "arrivals"] as const).map((d) => (
            <button key={d} role="tab" aria-selected={direction === d} onClick={() => setDirection(d)}>
              {d === "departures" ? "Departures" : "Arrivals"}
            </button>
          ))}
        </div>
      </div>
      {error && <Notice>{error}</Notice>}
      {!board && !error && <Loading label="Loading the board…" />}
      {board && board.flights.length === 0 && <Notice kind="info">No Northcrest flights here today.</Notice>}
      {board && board.flights.length > 0 && (
        <div className="board-wrap">
          <table className="board">
            <caption className="muted" style={{ captionSide: "bottom", textAlign: "left", padding: "8px 0" }}>
              Local times at {here}.{updated && ` Updated ${updated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}; refreshes every minute.`}
            </caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Flight</th>
                <th scope="col">{direction === "departures" ? "To" : "From"}</th>
                <th scope="col">Status</th>
                <th scope="col">{direction === "departures" ? "Gate" : "Expected"}</th>
              </tr>
            </thead>
            <tbody>
              {board.flights.map((f) => (
                <BoardRow key={f.id} flight={f} direction={direction} airport={airport} cityOf={cityOf} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BoardRow({
  flight: f,
  direction,
  airport,
  cityOf,
}: {
  flight: FlightWithStatus;
  direction: Board["direction"];
  airport: string;
  cityOf: (code: string) => string;
}) {
  const s = f.status;
  const scheduled = direction === "departures" ? f.scheduledDeparture : f.scheduledArrival;
  const estimated = direction === "departures" ? s.estimatedDeparture : s.estimatedArrival;
  const done = s.state === "DEPARTED" || s.state === "LANDED";
  // A departures board says a flight has gone, whether or not it has landed.
  const shown: FlightState = direction === "departures" && s.state === "LANDED" ? "DEPARTED" : s.state;
  const late = s.delayMin > 0 && !done && s.state !== "CANCELLED";
  const other = direction === "departures" ? f.destination : f.origin;
  return (
    <tr className={done ? "past" : undefined} data-flight={f.flightNumber}>
      <td>{localTime(scheduled, airport)}</td>
      <td className="flight">{f.flightNumber}</td>
      <td>{cityOf(other)}</td>
      <td>
        <StatusPill state={shown} />
        {late && <span className="muted"> {localTime(estimated, airport)}</span>}
        {s.remark && <div className="muted">{s.remark}</div>}
      </td>
      <td>{direction === "departures" ? (s.gate ?? "–") : s.state === "CANCELLED" ? "–" : localTime(estimated, airport)}</td>
    </tr>
  );
}

function StatusPill({ state }: { state: FlightState }) {
  return <span className={`pill pill-${state}`}>{LABELS[state]}</span>;
}

function FlightLookup() {
  const [number, setNumber] = useState("");
  const [flight, setFlight] = useState<FlightWithStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = number.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^NC\d{3,4}$/.test(n)) {
      setError("Flight numbers look like NC104.");
      setFlight(null);
      return;
    }
    setError(null);
    try {
      const q = new URLSearchParams({ date: todayInUk() });
      setFlight(await traced("look up flight", {}, () => api<FlightWithStatus>(`/api/status/flights/${n}?${q}`)));
    } catch (err) {
      setFlight(null);
      setError(err instanceof ApiError && err.status === 404 ? `There's no ${n} today.` : "Something went wrong.");
    }
  }

  const s = flight?.status;
  return (
    <section className="card" aria-labelledby="lookup-title">
      <h2 id="lookup-title">Check a flight</h2>
      <form className="grid" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="flightNumber">Flight number</label>
          <input
            id="flightNumber"
            placeholder="NC104"
            value={number}
            maxLength={8}
            autoCapitalize="characters"
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
        <button type="submit">Check status</button>
      </form>
      {error && <Notice>{error}</Notice>}
      {flight && s && (
        <dl className="summary" style={{ marginTop: 16 }} aria-label={`Status of ${flight.flightNumber}`}>
          <dt>Flight</dt>
          <dd>
            {flight.flightNumber}, {flight.origin} to {flight.destination}
          </dd>
          <dt>Status</dt>
          <dd>
            <StatusPill state={s.state} />
            {s.remark && <span className="muted"> {s.remark}</span>}
          </dd>
          <dt>Departs</dt>
          <dd>
            {s.delayMin > 0 && s.state !== "CANCELLED" && (
              <s className="was">{localTime(flight.scheduledDeparture, flight.origin)}</s>
            )}
            {localTime(s.estimatedDeparture, flight.origin)} ({flight.origin})
            {s.gate && `, gate ${s.gate}`}
          </dd>
          <dt>Arrives</dt>
          <dd>
            {localTime(s.estimatedArrival, flight.destination)} ({flight.destination})
          </dd>
        </dl>
      )}
    </section>
  );
}
