import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError, traced } from "../../shared/api";
import { addDays, dayOffset, duration, localDate, localTime, money, todayInUk } from "../../shared/format";
import type { Airport, Booking, Offer } from "../../shared/types";
import { go, Loading, Notice } from "../../shared/ui";
import { emailError, nameError } from "../../shared/validation";

interface Search {
  from: string;
  to: string;
  date: string;
  passengers: number;
}

type Step =
  | { name: "search" }
  | { name: "results"; search: Search }
  | { name: "passengers"; search: Search; offer: Offer }
  | { name: "confirmed"; booking: Booking };

export function Book() {
  const [airports, setAirports] = useState<Airport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ name: "search" });
  const [search, setSearch] = useState<Search>({ from: "MAN", to: "", date: todayInUk(), passengers: 1 });

  useEffect(() => {
    api<{ airports: Airport[] }>("/api/airports")
      .then((r) => setAirports(r.airports))
      .catch((e: ApiError) => setError(e.message));
  }, []);

  const byCode = useMemo(() => new Map((airports ?? []).map((a) => [a.code, a])), [airports]);
  const city = (code: string) => byCode.get(code)?.city ?? code;

  if (error) return <Notice>{error}</Notice>;
  if (!airports) return <Loading label="Loading destinations…" />;

  switch (step.name) {
    case "search":
      return (
        <SearchForm
          airports={airports}
          value={search}
          onChange={setSearch}
          onSubmit={(s) => setStep({ name: "results", search: s })}
        />
      );
    case "results":
      return (
        <Results
          search={step.search}
          city={city}
          onDate={(date) => setStep({ name: "results", search: { ...step.search, date } })}
          onBack={() => setStep({ name: "search" })}
          onSelect={(offer) => setStep({ name: "passengers", search: step.search, offer })}
        />
      );
    case "passengers":
      return (
        <Passengers
          offer={step.offer}
          count={step.search.passengers}
          city={city}
          onBack={() => setStep({ name: "results", search: step.search })}
          onBooked={(booking) => setStep({ name: "confirmed", booking })}
        />
      );
    case "confirmed":
      return <Confirmed booking={step.booking} city={city} onAgain={() => setStep({ name: "search" })} />;
  }
}

function SearchForm({
  airports,
  value,
  onChange,
  onSubmit,
}: {
  airports: Airport[];
  value: Search;
  onChange: (s: Search) => void;
  onSubmit: (s: Search) => void;
}) {
  const origin = airports.find((a) => a.code === value.from);
  const destinations = airports
    .filter((a) => origin?.destinations?.includes(a.code))
    .sort((a, b) => a.city.localeCompare(b.city));
  const today = todayInUk();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.to) onSubmit(value);
  }

  return (
    <section className="hero" aria-labelledby="search-title">
      <h1 id="search-title">Where to next?</h1>
      <p>Direct flights from Manchester and Edinburgh to 36 destinations across the UK and Europe.</p>
      <form className="grid" onSubmit={submit}>
        <div className="field">
          <label htmlFor="from">From</label>
          <select id="from" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value, to: "" })}>
            {airports
              .slice()
              .sort((a, b) => a.city.localeCompare(b.city))
              .map((a) => (
                <option key={a.code} value={a.code}>
                  {a.city} ({a.code})
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="to">To</label>
          <select id="to" required value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })}>
            <option value="">Choose a destination</option>
            {destinations.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="date">Departing</label>
          <input
            id="date"
            type="date"
            required
            min={today}
            max={addDays(today, 330)}
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="passengers">Passengers</label>
          <select
            id="passengers"
            value={value.passengers}
            onChange={(e) => onChange({ ...value, passengers: Number(e.target.value) })}
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "adult" : "adults"}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={!value.to}>
          Search flights
        </button>
      </form>
    </section>
  );
}

function Results({
  search,
  city,
  onDate,
  onBack,
  onSelect,
}: {
  search: Search;
  city: (code: string) => string;
  onDate: (date: string) => void;
  onBack: () => void;
  onSelect: (offer: Offer) => void;
}) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOffers(null);
    setError(null);
    const q = new URLSearchParams({ from: search.from, to: search.to, date: search.date });
    traced("search flights", { "northcrest.route": `${search.from}-${search.to}` }, () =>
      api<{ flights: Offer[] }>(`/api/flights?${q}`),
    )
      .then((r) => setOffers(r.flights))
      .catch((e: ApiError) => setError(e.message));
  }, [search.from, search.to, search.date]);

  const today = todayInUk();
  return (
    <section aria-labelledby="results-title">
      <h1 id="results-title">
        {city(search.from)} to {city(search.to)}
      </h1>
      <div className="day-nav">
        <button className="secondary" disabled={search.date <= today} onClick={() => onDate(addDays(search.date, -1))}>
          ← Previous day
        </button>
        <strong>{localDate(`${search.date}T12:00:00Z`, search.from)}</strong>
        <button className="secondary" onClick={() => onDate(addDays(search.date, 1))}>
          Next day →
        </button>
      </div>
      {error && <Notice>{error}</Notice>}
      {!offers && !error && <Loading label="Finding flights…" />}
      {offers?.length === 0 && (
        <Notice kind="info">No flights left to book on this day. Try the next day.</Notice>
      )}
      <ul className="offers" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Flights">
        {offers?.map((o) => {
          const soldOut = o.seatsLeft < search.passengers;
          const plus = dayOffset(o.scheduledDeparture, o.origin, o.scheduledArrival, o.destination);
          return (
            <li key={o.id} className="card offer" data-flight={o.flightNumber}>
              <div>
                <div className="leg">
                  <div>
                    <div className="time">{localTime(o.scheduledDeparture, o.origin)}</div>
                    <div className="code">{o.origin}</div>
                  </div>
                  <div className="line">
                    <span>{duration(o.durationMin)} · direct</span>
                  </div>
                  <div>
                    <div className="time">
                      {localTime(o.scheduledArrival, o.destination)}
                      {plus > 0 && <sup>+{plus}</sup>}
                    </div>
                    <div className="code">{o.destination}</div>
                  </div>
                </div>
                <div className="muted">
                  {o.flightNumber} · {o.seatsLeft <= 9 ? `${o.seatsLeft} seats left` : "Seats available"}
                </div>
              </div>
              <div className="price">
                <div className="amount">{money(o.fare)}</div>
                <div className="muted">per person</div>
                <button
                  onClick={() => onSelect(o)}
                  disabled={soldOut}
                  aria-label={`Select ${o.flightNumber} departing ${localTime(o.scheduledDeparture, o.origin)}`}
                >
                  {soldOut ? "Not enough seats" : "Select"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="actions">
        <button className="link" onClick={onBack}>
          Change search
        </button>
      </div>
    </section>
  );
}

interface PassengerInput {
  firstName: string;
  lastName: string;
  email: string;
}

function Passengers({
  offer,
  count,
  city,
  onBack,
  onBooked,
}: {
  offer: Offer;
  count: number;
  city: (code: string) => string;
  onBack: () => void;
  onBooked: (b: Booking) => void;
}) {
  const [people, setPeople] = useState<PassengerInput[]>(() =>
    Array.from({ length: count }, () => ({ firstName: "", lastName: "", email: "" })),
  );
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = people.map((p) => ({
    firstName: nameError(p.firstName),
    lastName: nameError(p.lastName),
    email: emailError(p.email),
  }));
  const valid = errors.every((e) => !e.firstName && !e.lastName && !e.email);

  function update(i: number, field: keyof PassengerInput, value: string) {
    setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, [field]: value } : p)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setSending(true);
    setError(null);
    try {
      const booking = await traced(
        "create booking",
        { "northcrest.flight_id": offer.id, "northcrest.passengers": people.length },
        () =>
          api<Booking>("/api/bookings", {
            method: "POST",
            json: {
              flightId: offer.id,
              passengers: people.map((p) => ({
                firstName: p.firstName.trim(),
                lastName: p.lastName.trim(),
                email: p.email.trim(),
              })),
            },
          }),
      );
      onBooked(booking);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="pax-title">
      <h1 id="pax-title">Who's flying?</h1>
      <div className="card">
        <strong>
          {offer.flightNumber} · {city(offer.origin)} to {city(offer.destination)}
        </strong>
        <div className="muted">
          {localDate(offer.scheduledDeparture, offer.origin)}, departs {localTime(offer.scheduledDeparture, offer.origin)}{" "}
          · {money(offer.fare)} per person · total {money(Math.round(offer.fare * count * 100) / 100)}
        </div>
      </div>
      <form onSubmit={submit} noValidate>
        {people.map((p, i) => (
          <fieldset key={i} className="card" style={{ border: "1px solid var(--line)" }}>
            <legend>
              <strong>Passenger {i + 1}</strong>
            </legend>
            <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {(["firstName", "lastName", "email"] as const).map((field) => {
                const id = `p${i}-${field}`;
                const err = touched ? errors[i][field] : null;
                return (
                  <div className="field" key={field}>
                    <label htmlFor={id}>
                      {field === "firstName" ? "First name" : field === "lastName" ? "Last name" : "Email"}
                      {count > 1 ? ` (passenger ${i + 1})` : ""}
                    </label>
                    <input
                      id={id}
                      type={field === "email" ? "email" : "text"}
                      autoComplete={i === 0 ? (field === "firstName" ? "given-name" : field === "lastName" ? "family-name" : "email") : "off"}
                      maxLength={field === "email" ? 254 : 50}
                      value={p[field]}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={err ? `${id}-err` : undefined}
                      onChange={(e) => update(i, field, e.target.value)}
                    />
                    {err && (
                      <span className="field-error" id={`${id}-err`}>
                        {err}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
        {error && <Notice>{error}</Notice>}
        <div className="actions">
          <button type="submit" disabled={sending}>
            {sending ? "Booking…" : `Book and pay ${money(Math.round(offer.fare * count * 100) / 100)}`}
          </button>
          <button type="button" className="secondary" onClick={onBack} disabled={sending}>
            Back to flights
          </button>
        </div>
        <p className="muted">This is a demo: no payment is taken and no real ticket is issued.</p>
      </form>
    </section>
  );
}

function Confirmed({ booking, city, onAgain }: { booking: Booking; city: (code: string) => string; onAgain: () => void }) {
  const f = booking.flight;
  return (
    <section aria-labelledby="done-title">
      <Notice kind="success">
        <strong id="done-title">You're booked.</strong> Keep your booking reference to manage your trip.
      </Notice>
      <div className="card">
        <div className="muted">Booking reference</div>
        <div className="pnr" data-testid="pnr">
          {booking.pnr}
        </div>
        <dl className="summary" style={{ marginTop: 16 }}>
          <dt>Flight</dt>
          <dd>
            {f.flightNumber}, {city(f.origin)} to {city(f.destination)}
          </dd>
          <dt>Departs</dt>
          <dd>
            {localDate(f.scheduledDeparture, f.origin)} at {localTime(f.scheduledDeparture, f.origin)} ({f.origin})
          </dd>
          <dt>Arrives</dt>
          <dd>
            {localTime(f.scheduledArrival, f.destination)} ({f.destination})
          </dd>
          <dt>Passengers</dt>
          <dd>{booking.passengers.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}</dd>
          <dt>Total</dt>
          <dd>{money(booking.total, booking.currency)}</dd>
        </dl>
      </div>
      <div className="actions">
        <button onClick={onAgain}>Book another flight</button>
        <a
          href={`/manage?pnr=${booking.pnr}`}
          onClick={(e) => {
            e.preventDefault();
            go(`/manage?pnr=${booking.pnr}`);
          }}
        >
          Manage this booking
        </a>
      </div>
    </section>
  );
}
