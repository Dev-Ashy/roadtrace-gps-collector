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
  component: SimpleCollectorPage,
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
            <Map position={position} points={points} gpsReady={Boolean(position)} />
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

function SimpleCollectorPage() {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [notes, setNotes] = useState("");
  const [gpsMessage, setGpsMessage] = useState("Requesting high-accuracy location");
  const [autoCollect, setAutoCollect] = useState(false);
  const categories: SurveyCategory[] = ["Bridge", "School zone", "Pothole / slump", "Sharp curve", "Speed bump", "Checkpoint / other"];

  useEffect(() => {
    const existing = readSavedPoints();
    setPoints(existing);
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speedKmh: pos.coords.speed ? pos.coords.speed * 3.6 : null,
            altitude: pos.coords.altitude,
            timestamp: new Date().toISOString(),
          });
          setGpsMessage("Live Signal Lock");
        },
        () => setGpsMessage("Location access denied"),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(id);
    }
  }, []);

  // Persist points to localStorage
  useEffect(() => {
    try { window.localStorage.setItem("corridor-survey-records-v1", JSON.stringify(points)); } catch {}
  }, [points]);

  // Auto collect points while moving
  useEffect(() => {
    if (!autoCollect || !position) return;
    const interval = setInterval(() => {
      setPoints(prev => {
        const last = prev[prev.length - 1];
        if (last && position) {
          const dist = Math.sqrt(Math.pow(last.latitude - position.latitude, 2) + Math.pow(last.longitude - position.longitude, 2)) * 111000;
          if (dist < 15) return prev;
        }
        const id = `auto-${Date.now()}`;
        const point: SurveyPoint = {
          point_id: id,
          timestamp_utc: new Date().toISOString(),
          category: "Checkpoint / other",
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy_meters: position.accuracy,
          speed_kmh: position.speedKmh,
          altitude_m: position.altitude,
          notes: "Auto-collected",
        };
        return [...prev, point];
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [autoCollect, position]);

  const handleLog = (category: SurveyCategory) => {
    if (!position) { setGpsMessage("Waiting for GPS fix"); return; }
    const id = `pt-${Date.now()}`;
    const point: SurveyPoint = {
      point_id: id,
      timestamp_utc: new Date().toISOString(),
      category,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy_meters: position.accuracy,
      speed_kmh: position.speedKmh,
      altitude_m: position.altitude,
      notes: notes.trim(),
    };
    setPoints(p => [...p, point]);
    setNotes("");
  };

  const exportCSV = () => {
    const header = "point_id,timestamp_utc,category,latitude,longitude,accuracy_meters,speed_kmh,altitude_m,notes";
    const rows = points.map(p => `${p.point_id},${p.timestamp_utc},${p.category},${p.latitude},${p.longitude},${p.accuracy_meters},${p.speed_kmh ?? ""},${p.altitude_m ?? ""},${p.notes.replace(/,/g, " ")}`);
    const blob = new Blob([header + "\n" + rows.join("\n")], {type: "text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roadtrace-survey.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{padding: '2rem', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto'}}>
      <h1>RoadTrace GPS Data Collector</h1>
      <p style={{color: '#666'}}>Map temporarily disabled. Core logging UI active.</p>
      <div style={{marginTop: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
        <strong>GPS Status:</strong> {gpsMessage}<br/>
        <strong>Latitude:</strong> {position ? position.latitude.toFixed(6) : "—"}<br/>
        <strong>Longitude:</strong> {position ? position.longitude.toFixed(6) : "—"}<br/>
        <strong>Accuracy:</strong> {position ? `±${Math.round(position.accuracy)} m` : "—"}<br/>
        <strong>Speed:</strong> {position?.speedKmh ? `${position.speedKmh.toFixed(1)} km/h` : "—"}<br/>
        <strong>Altitude:</strong> {position?.altitude ? `${Math.round(position.altitude)} m` : "—"}<br/>
        <strong>Points logged:</strong> {points.length}<br/>
        <label style={{display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem'}}>
          <input type="checkbox" checked={autoCollect} onChange={e => setAutoCollect(e.target.checked)} />
          Auto-collect every 10s when moving ≥15m
        </label>
      </div>

      <div style={{marginTop: '2rem'}}>
        <h2>Log Hazard</h2>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" style={{width: '100%', minHeight: '60px', marginBottom: '1rem'}} />
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem'}}>
          {categories.map(cat => (
            <button key={cat} onClick={() => handleLog(cat)} style={{padding: '0.75rem', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer'}}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginTop: '2rem'}}>
        <h2>Export</h2>
        <button onClick={exportCSV} style={{padding: '0.75rem 1.5rem', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer'}}>Download CSV</button>
      </div>

      <div style={{marginTop: '2rem'}}>
        <h2>Survey Points</h2>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem'}}>
          <thead>
            <tr>
              <th style={{borderBottom: '1px solid #ddd', textAlign: 'left', padding: '0.5rem'}}>Time</th>
              <th style={{borderBottom: '1px solid #ddd', textAlign: 'left', padding: '0.5rem'}}>Category</th>
              <th style={{borderBottom: '1px solid #ddd', textAlign: 'left', padding: '0.5rem'}}>Lat</th>
              <th style={{borderBottom: '1px solid #ddd', textAlign: 'left', padding: '0.5rem'}}>Lon</th>
            </tr>
          </thead>
          <tbody>
            {points.slice().reverse().map(p => (
              <tr key={p.point_id}>
                <td style={{padding: '0.5rem', borderBottom: '1px solid #eee'}}>{new Date(p.timestamp_utc).toLocaleTimeString()}</td>
                <td style={{padding: '0.5rem', borderBottom: '1px solid #eee'}}>{p.category}</td>
                <td style={{padding: '0.5rem', borderBottom: '1px solid #eee'}}>{p.latitude.toFixed(6)}</td>
                <td style={{padding: '0.5rem', borderBottom: '1px solid #eee'}}>{p.longitude.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}