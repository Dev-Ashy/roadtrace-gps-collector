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
  const [autoCopy, setAutoCopy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [route, setRoute] = useState<"Kuje to IPPIS" | "Kuje to Lokoja">("Kuje to Lokoja");
  const userName = "Bello Abdurrazak";
  const categories: SurveyCategory[] = ["Bridge", "School zone", "Slump", "Sharp curve", "Steep slope"];

  useEffect(() => {
    // Personal greeting audio on load
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(`Salam alaikum, Mr. ${userName}. Ready to copy coordinates of bridge and survey points. Please select your route.`);
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    }
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

  // Auto copy coordinates every 10s using real GPS data
  useEffect(() => {
    if (!autoCopy || !position) return;
    const interval = setInterval(() => {
      try {
        const coord = `${position.latitude.toFixed(6)},${position.longitude.toFixed(6)}`;
        navigator.clipboard.writeText(coord);
        setToast(`Coordinates copied: ${coord}`);
        setTimeout(()=>setToast(null), 2000);
        // Optional speech of coordinates
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(`Coordinate ${position.latitude.toFixed(6)} ${position.longitude.toFixed(6)}`);
          utter.volume = 0.8;
          window.speechSynthesis.speak(utter);
        }
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [autoCopy, position]);

  const handleLog = (category: SurveyCategory) => {
    if (!position) { setGpsMessage("Waiting for GPS fix"); setToast("GPS not ready"); setTimeout(() => setToast(null), 2000); return; }
    const id = `pt-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
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
    setToast(`Just recorded ${category.toLowerCase()}`);
    setTimeout(() => setToast(null), 2500);
  };

  const handleLogAll = () => {
    if (!position) { setToast("GPS not ready"); setTimeout(() => setToast(null), 2000); return; }
    categories.forEach((cat, i) => {
      setTimeout(() => {
        const id = `pt-${Date.now()}-${i}`;
        const point: SurveyPoint = {
          point_id: id,
          timestamp_utc: new Date().toISOString(),
          category: cat,
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy_meters: position.accuracy,
          speed_kmh: position.speedKmh,
          altitude_m: position.altitude,
          notes: notes.trim(),
        };
        setPoints(p => [...p, point]);
      }, i * 50);
    });
    setNotes("");
    setToast("Recorded all 5 categories");
    setTimeout(() => setToast(null), 2500);
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
    <main style={{padding: '1.5rem 1rem', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', maxWidth: '1040px', margin: '0 auto', color: '#fff', minHeight: '100vh', background: 'radial-gradient(1200px 600px at 80% -10%, rgba(99,102,241,0.35), transparent), radial-gradient(800px 400px at -10% 20%, rgba(14,165,233,0.3), transparent), #0b1020'}}>
      {toast && (
        <div style={{position: 'fixed', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#fff', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 1000, fontWeight: 600}}>
          {toast}
        </div>
      )}
      <header style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
          <div style={{width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, boxShadow: '0 8px 20px rgba(99,102,241,0.45)'}}>RT</div>
          <div>
            <h1 style={{fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em'}}>RoadTrace</h1>
            <div style={{fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', marginTop: '-2px'}}>Salam alaikum, Mr. {userName}</div>
          </div>
        </div>
        <div style={{background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)', padding: '0.5rem 0.9rem', borderRadius: '999px', fontSize: '0.85rem'}}>Liquid Glass UI</div>
      </header>

      <div style={{background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '0.9rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem'}}>
        <div style={{fontSize: '0.95rem', opacity: 0.9}}>Kindly select your route</div>
        <div style={{display: 'flex', gap: '0.5rem'}}>
          {["Kuje to IPPIS","Kuje to Lokoja"].map(r => (
            <button key={r} onClick={() => {setRoute(r as any); setToast(`Route set to ${r}`); setTimeout(()=>setToast(null),2000);}} style={{padding: '0.5rem 1rem', borderRadius: '999px', border: route===r ? '1px solid #fff' : '1px solid rgba(255,255,255,0.25)', background: route===r ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', fontWeight: 600}}>{r}</button>
          ))}
        </div>
      </div>

      <section style={{padding: '1.25rem', borderRadius: '20px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)'}}>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: '1rem'}}>
          {[
            ["GPS Status", gpsMessage, position ? '#a7f3d0' : '#fecaca'],
            ["Latitude", position ? position.latitude.toFixed(6) : "—", '#e0e7ff'],
            ["Longitude", position ? position.longitude.toFixed(6) : "—", '#e0e7ff'],
            ["Accuracy", position ? `±${Math.round(position.accuracy)} m` : "—", '#fef3c7'],
            ["Speed", position?.speedKmh ? `${position.speedKmh.toFixed(1)} km/h` : "—", '#dbeafe'],
            ["Altitude", position?.altitude ? `${Math.round(position.altitude)} m` : "—", '#dcfce7'],
          ].map(([label,val,color])=>(
            <div key={label as string} style={{background: 'rgba(255,255,255,0.06)', padding: '0.9rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)'}}>
              <div style={{fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>{label}</div>
              <div style={{fontWeight: 700, marginTop: '0.25rem', color: '#fff'}}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem'}}>
          <div style={{fontSize: '0.95rem', background: 'rgba(255,255,255,0.08)', padding: '0.5rem 0.9rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.18)', color: '#fff'}}>Points logged: <strong>{points.length}</strong></div>
          <label style={{display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', background: 'rgba(255,255,255,0.08)', padding: '0.5rem 0.9rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.18)', color: '#fff'}}>
            <input type="checkbox" checked={autoCopy} onChange={e => setAutoCopy(e.target.checked)} />
            Auto-copy coords every 10s
          </label>
        </div>
        {position && (
          <div style={{marginTop: '0.9rem', display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
            <button onClick={()=>{navigator.clipboard.writeText(`${position.latitude.toFixed(6)},${position.longitude.toFixed(6)}`); setToast('Coordinates copied'); setTimeout(()=>setToast(null),2000);}} style={{padding: '0.55rem 0.9rem', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontWeight: 600}}>Copy coordinates</button>
            <span style={{fontSize: '0.85rem', opacity: 0.8}}>Route: {route}</span>
          </div>
        )}
      </section>

      <section style={{marginTop: '1.5rem', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.18)', padding: '1.25rem', borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)'}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem'}}>
          <h2 style={{fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff'}}>
            <span style={{display: 'inline-flex', width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.18)', color: '#fff', alignItems: 'center', justifyContent: 'center'}}>⚠</span>
            Log Hazard
          </h2>
          <button onClick={handleLogAll} style={{padding: '0.55rem 0.9rem', borderRadius: '999px', background: 'rgba(16,185,129,0.25)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', fontWeight: 700, cursor: 'pointer'}}>Select All</button>
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" style={{width: '100%', minHeight: '72px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', marginBottom: '1rem', fontFamily: 'inherit', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none'}} />
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem'}}>
          {categories.map((cat, i) => {
            const colors = ['rgba(14,165,233,0.35)','rgba(139,92,246,0.35)','rgba(245,158,11,0.35)','rgba(16,185,129,0.35)','rgba(239,68,68,0.35)'];
            return (
            <button key={cat} onClick={() => handleLog(cat)} style={{padding: '0.9rem', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '14px', background: colors[i % colors.length], cursor: 'pointer', fontWeight: 600, color: '#fff', transition: 'transform 0.05s'}} onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')} onMouseUp={e => (e.currentTarget.style.transform = '')}>
              {cat}
            </button>
          )})}
        </div>
      </section>

      <section style={{marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem'}}>
        <button onClick={exportCSV} style={{padding: '0.9rem 1.5rem', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', cursor: 'pointer', fontWeight: 700, boxShadow: '0 6px 18px rgba(99,102,241,0.35)'}}>Download CSV</button>
        <span style={{color: '#fff', fontSize: '0.95rem', background: 'rgba(255,255,255,0.08)', padding: '0.5rem 0.9rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.18)'}}>Export {points.length} records</span>
      </section>

      <section style={{marginTop: '1.5rem', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.18)', padding: '1.25rem', borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)'}}>
        <h2 style={{fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff'}}>
          <span style={{display: 'inline-flex', width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.18)', color: '#fff', alignItems: 'center', justifyContent: 'center'}}>📊</span>
          Survey Points
        </h2>
        <div style={{overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.18)'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem'}}>
            <thead>
              <tr style={{background: 'rgba(255,255,255,0.12)', color: '#fff'}}>
                <th style={{textAlign: 'left', padding: '0.85rem'}}>Time</th>
                <th style={{textAlign: 'left', padding: '0.85rem'}}>Category</th>
                <th style={{textAlign: 'left', padding: '0.85rem'}}>Lat</th>
                <th style={{textAlign: 'left', padding: '0.85rem'}}>Lon</th>
              </tr>
            </thead>
            <tbody>
              {points.slice().reverse().map(p => (
                <tr key={p.point_id} style={{borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#fff'}}>
                  <td style={{padding: '0.85rem'}}>{new Date(p.timestamp_utc).toLocaleTimeString()}</td>
                  <td style={{padding: '0.85rem', fontWeight: 600}}>{p.category}</td>
                  <td style={{padding: '0.85rem', fontFamily: 'ui-monospace, monospace'}}>{p.latitude.toFixed(6)}</td>
                  <td style={{padding: '0.85rem', fontFamily: 'ui-monospace, monospace'}}>{p.longitude.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
