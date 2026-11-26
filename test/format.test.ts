import { describe, expect, it } from "vitest";
import { addDays, dayOffset, duration, localTime, money, todayInUk } from "../shared/format";
import { scrubUrl } from "../shared/rum";
import { emailError, nameError } from "../shared/validation";

describe("format", () => {
  it("shows times in the airport's local time", () => {
    // 2026-07-01 is British Summer Time; Athens is UTC+3.
    expect(localTime("2026-07-01T12:00:00Z", "MAN")).toBe("13:00");
    expect(localTime("2026-07-01T12:00:00Z", "ATH")).toBe("15:00");
    expect(localTime("2026-11-26T12:00:00Z", "MAN")).toBe("12:00");
  });

  it("flags arrivals on a later local day", () => {
    expect(dayOffset("2026-11-26T21:00:00Z", "MAN", "2026-11-26T23:30:00Z", "ATH")).toBe(1);
    expect(dayOffset("2026-11-26T09:00:00Z", "MAN", "2026-11-26T11:00:00Z", "AMS")).toBe(0);
  });

  it("formats durations, money and dates", () => {
    expect(duration(65)).toBe("1h 5m");
    expect(duration(120)).toBe("2h");
    expect(duration(45)).toBe("45m");
    expect(money(105.99)).toBe("£105.99");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(todayInUk(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
  });
});

describe("scrubUrl", () => {
  it("drops query strings and replaces booking references and flight numbers", () => {
    expect(scrubUrl("https://x.web.app/api/bookings/ABC234?lastName=Lovelace")).toBe(
      "https://x.web.app/api/bookings/:pnr",
    );
    expect(scrubUrl("https://x.web.app/api/bookings/ABC234/cancel")).toBe("https://x.web.app/api/bookings/:pnr/cancel");
    expect(scrubUrl("https://x.web.app/api/status/flights/NC104?date=2026-11-26")).toBe(
      "https://x.web.app/api/status/flights/:flight",
    );
    expect(scrubUrl("https://x.web.app/manage?pnr=ABC234")).toBe("https://x.web.app/manage");
  });
});

describe("validation", () => {
  it("matches the booking API's rules", () => {
    expect(nameError("Zoë")).toBeNull();
    expect(nameError("O'Brien-Smith")).toBeNull();
    expect(nameError("R2D2")).not.toBeNull();
    expect(nameError("  ")).toBe("Required");
    expect(emailError("ada@example.com")).toBeNull();
    expect(emailError("ada@example")).not.toBeNull();
  });
});
