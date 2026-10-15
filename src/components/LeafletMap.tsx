import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

import { distanceInMeters, type LivePosition, type SurveyPoint } from "@/lib/gps";

type LeafletMapProps = {
  position: LivePosition | null;
  points: SurveyPoint[];
  followDevice: boolean;
};

const MAP_CENTER: [number, number] = [8.8833, 7.1053];

function categoryPinClass(category: SurveyPoint["category"]) {
  if (category === "Pothole / slump") return "gps-pin--pothole";
  if (category === "Sharp curve") return "gps-pin--curve";
  if (category === "School zone") return "gps-pin--school";
  if (category === "Speed bump") return "gps-pin--bump";
  if (category === "Checkpoint / other") return "gps-pin--checkpoint";
  return "gps-pin--bridge";
}

function FollowDevice({ position, followDevice }: Pick<LeafletMapProps, "position" | "followDevice">) {
  const map = useMap();

  useEffect(() => {
    if (position && followDevice) {
      map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.6,
      });
    }
  }, [followDevice, map, position]);

  return null;
}

export default function LeafletMap({ position, points, followDevice }: LeafletMapProps) {
  const positionIcon = useMemo(
    () =>
      L.divIcon({
        className: "gps-device-marker",
        html: '<span class="gps-device-marker__pulse"></span><span class="gps-device-marker__dot"></span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    [],
  );

  const featureIcons = useMemo(
    () =>
      points.map((point) =>
        L.divIcon({
          className: "gps-feature-marker",
          html: `<span class="gps-pin ${categoryPinClass(point.category)}"></span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      ),
    [points],
  );

  return (
    <MapContainer
      center={position ? [position.latitude, position.longitude] : MAP_CENTER}
      zoom={position ? 15 : 12}
      scrollWheelZoom
      zoomControl
      className="gps-leaflet-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FollowDevice position={position} followDevice={followDevice} />
      {position && (
        <Marker position={[position.latitude, position.longitude]} icon={positionIcon} zIndexOffset={1000}>
          <Popup>
            <strong>Current location</strong>
            <br />
            {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            <br />
            Accuracy ±{Math.round(position.accuracy)} m
          </Popup>
        </Marker>
      )}
      {points.map((point, index) => {
        const isNearDevice = position && distanceInMeters(position, point) <= 200;

        return (
          <Marker
            key={point.point_id}
            position={[point.latitude, point.longitude]}
            icon={featureIcons[index]}
          >
            <Popup>
              <strong>{point.category}</strong>
              {point.notes && <div>{point.notes}</div>}
              <div>
                {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
              </div>
              <div>Accuracy ±{Math.round(point.accuracy_meters)} m</div>
              {isNearDevice && <div>Within 200 m</div>}
            </Popup>
          </Marker>
        );
      })}
      {!position &&
        points.length === 0 &&
        [
          { point: [8.8848, 7.1026] as [number, number], color: "var(--category-bridge)" },
          { point: [8.889, 7.112] as [number, number], color: "var(--category-curve)" },
          { point: [8.879, 7.109] as [number, number], color: "var(--category-school)" },
        ].map(({ point, color }) => (
          <CircleMarker
            key={`${point[0]}-${point[1]}`}
            center={point}
            radius={4}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.86, weight: 1 }}
          />
        ))}
    </MapContainer>
  );
}