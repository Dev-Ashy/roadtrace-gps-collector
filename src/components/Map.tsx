import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LocateFixed, Map as MapIcon, MapPin } from "lucide-react";

import type { LivePosition, SurveyPoint } from "@/lib/gps";

type MapProps = {
  position: LivePosition | null;
  points: SurveyPoint[];
  gpsReady: boolean;
};

function MapPlaceholder() {
  return <div className="flex h-full min-h-80 items-center justify-center bg-map-surface text-sm text-muted-foreground">Preparing corridor map…</div>;
}

export function Map({ position, points, gpsReady }: MapProps) {
  const [showMap, setShowMap] = useState(false);
  const [followDevice, setFollowDevice] = useState(true);

  useEffect(() => {
    setShowMap(true);
  }, []);

  return (
    <section aria-label="Corridor survey map" className="min-w-0 overflow-hidden rounded-lg border border-border bg-map-surface">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-3">
          <MapIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold text-foreground">Corridor map</span>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
            <span className={`size-1.5 rounded-full ${gpsReady ? "bg-success" : "bg-warning"}`} /> OpenStreetMap
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setFollowDevice((value) => !value)}
          aria-label={followDevice ? "Stop following GPS position" : "Follow GPS position"}
          title={followDevice ? "Stop following GPS position" : "Follow GPS position"}
          className={followDevice ? "text-primary" : "text-muted-foreground"}
        >
          {followDevice ? <LocateFixed aria-hidden="true" /> : <MapPin aria-hidden="true" />}
          <span className="hidden sm:inline">{followDevice ? "Following GPS" : "Follow GPS"}</span>
        </Button>
      </div>

      <div className="relative h-[370px] sm:h-[450px]">
        <MapPlaceholder />

        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-border bg-surface/95 px-3 py-2 text-[11px] text-foreground shadow-sm">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-category-bridge" /> Bridge</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-category-school" /> School</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-category-pothole" /> Road hazard</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-category-checkpoint" /> Other</span>
        </div>
      </div>
    </section>
  );
}