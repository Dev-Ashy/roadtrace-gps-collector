export const SURVEY_CSV_HEADER =
  "point_id,timestamp_utc,category,latitude,longitude,accuracy_meters,speed_kmh,altitude_m,notes";

export type SurveyCategory =
  | "Bridge"
  | "School zone"
  | "Pothole / slump"
  | "Sharp curve"
  | "Speed bump"
  | "Checkpoint / other";

export type SurveyPoint = {
  point_id: string;
  timestamp_utc: string;
  category: SurveyCategory;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  speed_kmh: number | null;
  altitude_m: number | null;
  notes: string;
};

export type LivePosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speedKmh: number | null;
  altitude: number | null;
  timestamp: string;
};

export function toCsv(points: SurveyPoint[]) {
  const escape = (value: unknown) => {
    const text = value === null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };

  const rows = points.map((point) =>
    [
      point.point_id,
      point.timestamp_utc,
      point.category,
      point.latitude,
      point.longitude,
      point.accuracy_meters,
      point.speed_kmh,
      point.altitude_m,
      point.notes,
    ]
      .map(escape)
      .join(","),
  );

  return [SURVEY_CSV_HEADER, ...rows].join("\r\n");
}

export function distanceInMeters(
  from: Pick<LivePosition, "latitude" | "longitude">,
  to: Pick<SurveyPoint, "latitude" | "longitude">,
) {
  const earthRadiusMeters = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const latitudeOne = radians(from.latitude);
  const latitudeTwo = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}