import { useState, type FormEvent } from "react";
import { api, ApiError, traced } from "../../shared/api";
import { localDate, localTime, money } from "../../shared/format";
import type { Booking } from "../../shared/types";
import { Notice } from "../../shared/ui";
import { PNR } from "../../shared/validation";

export function Manage() {
  const [pnr, setPnr] = useState(() => new URLSearchParams(location.search).get("pnr")?.toUpperCase() ?? "");
  const [lastName, setLastName] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function find(e: FormEvent) {
    e.preventDefault();
    if (!PNR.test(pnr) || !lastName.trim()) {
      setError("Enter your 6-character booking reference and the last name of a passenger.");
      return;
    }
    setBusy(true);
    setError(null);
    setBooking(null);
    try {
      const q = new URLSearchParams({ lastName: lastName.trim() });
      setBooking(await traced("find booking", {}, () => api<Booking>(`/api/bookings/${pnr.toUpperCase()}?${q}`)));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "We couldn't find a booking with that reference and last name."
          : err instanceof Error
            ? err.message
            : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      setBooking(
        await traced("cancel booking", { "northcrest.flight_id": booking.flight.id }, () =>
          api<Booking>(`/api/bookings/${booking.pnr}/cancel`, { method: "POST", json: { lastName: lastName.trim() } }),
        ),
      );
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const f = booking?.flight;
  const departed = f ? Date.parse(f.scheduledDeparture) <= Date.now() : false;

  return (
    <section aria-labelledby="manage-title">
      <h1 id="manage-title">Manage your booking</h1>
      <form className="card grid" onSubmit={find} noValidate>
        <div className="field">
          <label htmlFor="pnr">Booking reference</label>
          <input
            id="pnr"
            value={pnr}
            maxLength={6}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
          />
        </div>
        <div className="field">
          <label htmlFor="lastName">Last name</label>
          <input id="lastName" value={lastName} maxLength={50} autoComplete="family-name" onChange={(e) => setLastName(e.target.value)} />
        </div>
        <button type="submit" disabled={busy}>
          Find booking
        </button>
      </form>
      {error && <Notice>{error}</Notice>}
      {booking && f && (
        <div className="card" aria-label="Booking details">
          <div className="muted">Booking reference</div>
          <div className="pnr">{booking.pnr}</div>
          {booking.status === "CANCELLED" && <Notice kind="info">This booking is cancelled.</Notice>}
          <dl className="summary" style={{ marginTop: 12 }}>
            <dt>Status</dt>
            <dd data-testid="booking-status">{booking.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}</dd>
            <dt>Flight</dt>
            <dd>
              {f.flightNumber}, {f.origin} to {f.destination}
            </dd>
            <dt>Departs</dt>
            <dd>
              {localDate(f.scheduledDeparture, f.origin)} at {localTime(f.scheduledDeparture, f.origin)}
            </dd>
            <dt>Passengers</dt>
            <dd>{booking.passengers.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}</dd>
            <dt>Total</dt>
            <dd>{money(booking.total, booking.currency)}</dd>
          </dl>
          {booking.status === "CONFIRMED" && !departed && (
            <div className="actions">
              {confirming ? (
                <>
                  <span>Cancel this booking for all passengers?</span>
                  <button className="danger" onClick={cancel} disabled={busy}>
                    Yes, cancel booking
                  </button>
                  <button className="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                    Keep booking
                  </button>
                </>
              ) : (
                <button className="secondary" onClick={() => setConfirming(true)}>
                  Cancel booking
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
