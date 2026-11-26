// Shapes returned by northcrest-services. Keep in step with its app.ts files.

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  destinations?: string[];
}

export interface Flight {
  id: string;
  flightNumber: string;
  date: string;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  distanceKm: number;
  durationMin: number;
}

export interface Offer extends Flight {
  fare: number;
  currency: "GBP";
  seatsLeft: number;
}

export interface Booking {
  pnr: string;
  status: "CONFIRMED" | "CANCELLED";
  flight: Flight;
  passengers: { firstName: string; lastName: string }[];
  total: number;
  currency: "GBP";
  createdAt: string;
}

export type FlightState = "SCHEDULED" | "DELAYED" | "BOARDING" | "GATE_CLOSED" | "DEPARTED" | "LANDED" | "CANCELLED";

export interface FlightStatus {
  state: FlightState;
  delayMin: number;
  estimatedDeparture: string;
  estimatedArrival: string;
  gate: string | null;
  remark: string | null;
}

export interface FlightWithStatus extends Flight {
  status: FlightStatus;
}

export interface Board {
  airport: string;
  date: string;
  direction: "departures" | "arrivals";
  flights: FlightWithStatus[];
}
