import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  Crosshair,
  Gauge,
  MapPin,
  Navigation,
  Satellite,
  ShieldCheck,
  SignalHigh,
  Timer,
  Waves,
} from "lucide-react";

import { ExportButton } from "@/components/ExportButton";
import { LoggerGrid } from "@/components/LoggerGrid";
import { Map } from "@/components/Map";
import { TableView } from "@/components/TableView";
import { Button } from "@/components/ui/button";
import { distanceInMeters, type LivePosition, type SurveyCategory, type SurveyPoint } from "@/lib/gps";

const RECORDS_STORAGE_KEY = "corridor-survey-records-v1";
const VOICE_STORAGE_KEY = "corridor-survey-voice-v1";
const INITIAL_CENTER: LivePosition = {
  latitude: 8.8833,
  longitude: 7.1053,
  accuracy: 0,
  speedKmh: null,
  altitude: null,
  timestamp: "",
};

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => <div>Test</div>,
  head: () => ({
    meta: [
      { title: "RoadTrace — GPS Highway Survey Recorder" },
      {
        name: "description",
        content:
          "Record precise highway survey points, log road hazards in one tap, and export GPS field notes along the Abuja–Lokoja corridor.",
      },
      { property: "og:title", content: "RoadTrace — GPS Highway Survey Recorder" },
      {
        property: "og:description",
        content:
          "A live OpenStreetMap GPS data collector for highway corridors, road hazards, and precise survey exports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function readSavedPoints(): SurveyPoint[] {
  try {
    const stored = window.localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is SurveyPoint => {
      if (!value || typeof value !== "object") return false;
      const point = value as Partial<SurveyPoint>;
      return (
        typeof point.point_id === "string" &&
        typeof point.timestamp_utc === "string" &&
        typeof point.category === "string" &&
        typeof point.latitude === "number" &&
        typeof point.longitude === "number" &&
        typeof point.accuracy_meters === "number" &&
        typeof point.notes === "string"
      );
    });
  } catch {
    return [];
  }
}

function CollectorPage() {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [positionError, setPositionError] = useState("");
  const [gpsMessage, setGpsMessage] = useState("Requesting high-accuracy location");
  const [watchEnabled, setWatchEnabled] = useState(true);
  const [accuracyFilter, setAccuracyFilter] = useState("good");
  const [notes, setNotes] = useState("");
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [csvConfigured, setCsvConfigured] = useState(false);
  const positionRef = useRef<LivePosition | null>(null);
  const spokenPointTimesRef = useRef(new Map<string, number>());
  const recentPointIdsRef = useRef(new Set<string>());
  const lastCoordinatesRef = useRef<string | null>(null);

  const beginTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsMessage("GPS unavailable on this device");
      setPositionError("Allow location access or use a device with GPS.");
      setWatchEnabled(false);
      return;
    }

    setPositionError("");
    setGpsMessage("Requesting high-accuracy location");
    setWatchEnabled(true);
  }, []);

  useEffect(() => {
    const existingPoints = readSavedPoints();
    setPoints(existingPoints);
    try {
      setAudioEnabled(window.localStorage.getItem(VOICE_STORAGE_KEY) === "on");
      setCsvConfigured(window.localStorage.getItem("corridor-survey-csv-target-v1") === "on");
    } catch {
      // Continue with an in-memory survey buffer when storage is unavailable.
    }
    setPersistenceReady(true);
  }, []);

  useEffect(() => {
    if (!persistenceReady) return;
    try {
      window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(points));
    } catch {
      setCsvConfigured(false);
    }
  }, [persistenceReady, points]);

  useEffect(() => {
    if (!persistenceReady) return;
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, audioEnabled ? "on" : "off");
    } catch {
      // Spoken alerts continue to work for the current session.
    }
  }, [audioEnabled, persistenceReady]);

  useEffect(() => {
    if (!watchEnabled) return;

    let watchId: number | null = null;
    let cancelled = false;
    const watchOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (newPosition) => {
          if (cancelled) return;
          const nextPosition: LivePosition = {
            latitude: newPosition.coords.latitude,
            longitude: newPosition.coords.longitude,
            accuracy: newPosition.coords.accuracy,
            speedKmh: newPosition.coords.speed == null ? null : newPosition.coords.speed * 3.6,
            altitude: newPosition.coords.altitude,
            timestamp: new Date(newPosition.timestamp).toISOString(),
          };
          positionRef.current = nextPosition;
          setPosition(nextPosition);
          setPositionError("");
          setGpsMessage("Live Signal Lock");
          setAccuracyFilter(
            nextPosition.accuracy <= 10 ? "excellent" : nextPosition.accuracy <= 30 ? "good" : "weak",
          );

          const coordinateKey = `${nextPosition.latitude.toFixed(7)},${nextPosition.longitude.toFixed(7)}`;
          if (coordinateKey !== lastCoordinatesRef.current) {
            lastCoordinatesRef.current = coordinateKey;
            setGpsMessage("Live Signal Lock");
          }
        },
        (error) => {
          if (cancelled) return;
          if (error.code === error.PERMISSION_DENIED) {
            setGpsMessage("Location access denied");
            setPositionError("Allow location access in your browser settings, then try again.");
            setWatchEnabled(false);
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setGpsMessage("Waiting for GPS signal");
            setPositionError("Move into an open area or check your device location settings.");
          } else {
            setGpsMessage("GPS signal timed out");
            setPositionError("GPS has not fixed your location yet. Keep this page open or retry.");
          }
        },
        watchOptions,
      );
      setGpsMessage("Waiting for GPS signal");
    } catch {
      setGpsMessage("GPS unavailable on this device");
      setPositionError("Location access is unavailable in this browser.");
      setWatchEnabled(false);
    }

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchEnabled]);

  useEffect(() => {
    if (!audioEnabled || !position || !points.length || typeof window === "undefined") return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;

    const now = Date.now();
    for (const point of points) {
      const proximityKey = `${point.point_id}:${position.latitude.toFixed(5)}:${position.longitude.toFixed(5)}`;
      if (recentPointIdsRef.current.has(point.point_id)) continue;
      if (distanceInMeters(position, point) > 200) continue;

      const lastSpoken = spokenPointTimesRef.current.get(point.point_id) ?? 0;
      if (now - lastSpoken < 90_000) continue;
      spokenPointTimesRef.current.set(point.point_id, now);
      recentPointIdsRef.current.add(point.point_id);
      const utterance = new SpeechSynthesisUtterance(
        `Caution! ${point.category} ahead. Slow down.`,
      );
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
      void proximityKey;
    }

    for (const pointId of recentPointIdsRef.current) {
      const point = points.find((savedPoint) => savedPoint.point_id === pointId);
      if (!point || distanceInMeters(position, point) > 250) {
        recentPointIdsRef.current.delete(pointId);
      }
    }
  }, [audioEnabled, points, position]);

  const handleLog = useCallback(
    (category: SurveyCategory) => {
      const current = positionRef.current;
      if (!current) {
        setGpsMessage("Waiting for a fresh GPS fix");
        setPositionError("This feature needs your current GPS location to record an accurate survey point.");
        return;
      }

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const recordedPoint: SurveyPoint = {
        point_id: id,
        timestamp_utc: new Date().toISOString(),
        category,
        latitude: current.latitude,
        longitude: current.longitude,
        accuracy_meters: current.accuracy,
        speed_kmh: current.speedKmh,
        altitude_m: current.altitude,
        notes: notes.trim(),
      };

      if (distanceInMeters(current, recordedPoint) <= 200) {
        recentPointIdsRef.current.add(id);
      }
      setPoints((previous) => [...previous, recordedPoint]);
      setNotes("");
      setPositionError("");
    },
    [notes],
  );

  const deletePoint = useCallback((pointId: string) => {
    setPoints((previous) => previous.filter((point) => point.point_id !== pointId));
    recentPointIdsRef.current.delete(pointId);
    spokenPointTimesRef.current.delete(pointId);
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    setAudioEnabled(enabled);
    if (enabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      const testVoice = new SpeechSynthesisUtterance("Road hazard audio warnings enabled.");
      testVoice.rate = 0.92;
      window.speechSynthesis.speak(testVoice);
    }
  }, []);

  const csvStorageText = csvConfigured ? "CSV buffer active" : "Local storage active";
  const positionLabel = position ? "POSITION LOCKED" : "GPS STANDBY";

  return (
    <main className="collector-shell">
      <div className="collector-wrap">
        <header className="app-header">
          <a className="brand-lockup" href="/" aria-label="RoadTrace home">
            <span className="brand-mark"><Crosshair aria-hidden="true" /></span>
            <span className="brand-name">ROAD<span>TRACE</span></span>
          </a>

          <div className="header-route">
            <span className="header-route-dot" />
            <div>
              <p>HIGHWAY FIELD SURVEY</p>
              <span>Kuje <span className="route-arrow">—→</span> Abuja <span className="route-arrow">—→</span> Lokoja</span>
            </div>
          </div>

          <div className="header-session"><ShieldCheck aria-hidden="true" /><span>{csvStorageText}</span></div>
        </header>

        <section className="gps-status" aria-live="polite">
          <div className="gps-status-leading">
            <span className={`gps-status-indicator ${position ? "is-active" : "is-pending"}`}>
              <span />
            </span>
            <div>
              <div className="gps-status-headline">
                <span>{position ? "GPS ACTIVE" : "GPS WAITING / DENIED"}</span>
                <span className="gps-status-separator">—</span>
                <span className={position ? "gps-status-good" : "gps-status-waiting"}>{gpsMessage}</span>
              </div>
              <p className="gps-status-caption">
                {positionError ? positionError : position ? "High-accuracy location updates automatically" : "Requesting device permission for a live GPS position"}
              </p>
            </div>
          </div>
          {!position && (
            <Button type="button" variant="outline" size="sm" onClick={beginTracking} className="gps-retry-button">
              <Satellite aria-hidden="true" /> Retry GPS
            </Button>
          )}
        </section>

        <div className="metrics-strip" aria-label="Current GPS measurements">
          <Metric icon={Crosshair} label="LATITUDE" value={position ? position.latitude.toFixed(6) : "—.——————"} detail={position ? "DECIMAL DEGREES" : "AWAITING FIX"} />
          <Metric icon={Navigation} label="LONGITUDE" value={position ? position.longitude.toFixed(6) : "—.——————"} detail={position ? "DECIMAL DEGREES" : "AWAITING FIX"} />
          <Metric icon={MapPin} label="ALTITUDE" value={position?.altitude == null ? "—" : `${Math.round(position.altitude)} m`} detail={position ? "ABOVE SEA LEVEL" : "GPS REQUIRED"} />
          <Metric icon={Gauge} label="SPEED" value={position?.speedKmh == null ? "—" : `${position.speedKmh.toFixed(1)}`} unit={position?.speedKmh == null ? undefined : "km/h"} detail={position ? "GPS GROUND SPEED" : "GPS REQUIRED"} />
          <Metric icon={SignalHigh} label="ACCURACY" value={position ? `±${Math.round(position.accuracy)}` : "—"} unit={position ? "m" : undefined} detail={position ? "HORIZONTAL ESTIMATE" : "GPS REQUIRED"} />
        </div>

        <div className="workbench-layout">
          <div className="workbench-map">
            <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-map-surface p-4 h-[370px] sm:h-[450px] flex items-center justify-center text-muted-foreground">Map temporarily disabled for debugging</div>
          </div>
          <LoggerGrid
            notes={notes}
            onNotesChange={setNotes}
            onLog={handleLog}
            gpsReady={Boolean(position)}
            audioEnabled={audioEnabled}
            onAudioEnabledChange={toggleAudio}
            recordedCount={points.length}
          />
        </div>

        <section className="field-status-strip" aria-label="Current survey status">
          <div className="field-status-item"><span className={`field-status-dot ${position ? "is-active" : "is-pending"}`} /><span>{position ? "LIVE POSITION" : "AWAITING LOCATION"}</span></div>
          <div className="field-status-item"><MapPin aria-hidden="true" /><span>{points.length} POINTS LOGGED</span></div>
          <div className="field-status-item"><Timer aria-hidden="true" /><span>{position ? new Date(position.timestamp).toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false, timeZoneName: "short" }) : "UTC TIME READY"}</span></div>
          <div className="field-status-item accuracy-chip" data-quality={accuracyFilter}><span className="field-status-dot" /><span>FIX {accuracyFilter.toUpperCase()}</span></div>
          {position && <span className="field-status-coordinates">{position.latitude.toFixed(5)} / {position.longitude.toFixed(5)}</span>}
        </section>

        {positionError && !position && (
          <div className="gps-error-inline" role="status"><AlertTriangle aria-hidden="true" /><span>{positionError}</span></div>
        )}

        <section className="export-section" aria-label="Survey data export">
          <div className="export-context">
            <div className="export-icon"><ArrowDownToLine aria-hidden="true" /></div>
            <div>
              <h2>Field data</h2>
              <p><Waves aria-hidden="true" /> {points.length} {points.length === 1 ? "record" : "records"} <span>·</span> Automatically saved on this device</p>
            </div>
          </div>
          <ExportButton points={points} />
        </section>

        <TableView points={points} onDelete={deletePoint} />

        <footer className="app-footer">
          <span>ROADTRACE <span>FIELD RECORDER</span></span>
          <span><ShieldCheck aria-hidden="true" /> {positionLabel}</span>
          <span>OPENSTREETMAP <span>·</span> WGS84 <span>·</span> UTC</span>
        </footer>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  detail,
}: {
  icon: typeof Crosshair;
  label: string;
  value: string;
  unit?: string;
  detail: string;
}) {
  return (
    <div className="metric-cell">
      <div className="metric-label"><Icon aria-hidden="true" /><span>{label}</span></div>
      <p className="metric-value">{value}{unit && <span>{unit}</span>}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}