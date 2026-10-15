import { describe, expect, it } from "vitest";

import { distanceInMeters, SURVEY_CSV_HEADER, toCsv, type SurveyPoint } from "@/lib/gps";

const examplePoint: SurveyPoint = {
  point_id: "field-001",
  timestamp_utc: "2026-10-15T18:00:00.000Z",
  category: "Bridge",
  latitude: 8.8833,
  longitude: 7.1053,
  accuracy_meters: 4,
  speed_kmh: 40,
  altitude_m: null,
  notes: "Kuje, south entrance",
};

describe("GPS field-data formatting and alerts", () => {
  it("exports the nine required survey columns in the specified order", () => {
    expect(SURVEY_CSV_HEADER).toBe(
      "point_id, timestamp_utc, category, latitude, longitude, accuracy_meters, speed_kmh, altitude_m, notes",
    );
    expect(toCsv([examplePoint]).split("\r\n")[1]?.split(",")).toHaveLength(9);
  });

  it("quotes optional notes without corrupting comma-separated fields", () => {
    expect(toCsv([examplePoint]).split("\r\n")[1]).toContain('"Kuje, south entrance"');
  });

  it("uses the 200-meter audio-warning proximity radius", () => {
    const current = { latitude: 8.8833, longitude: 7.1053 };
    const closePoint = { latitude: 8.884, longitude: 7.1053 };
    const distantPoint = { latitude: 8.886, longitude: 7.1053 };

    expect(distanceInMeters(current, closePoint)).toBeLessThan(200);
    expect(distanceInMeters(current, distantPoint)).toBeGreaterThan(200);
  });
});