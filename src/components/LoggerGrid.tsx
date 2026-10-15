import {
  Activity,
  ArrowDown,
  AudioLines,
  Blocks,
  Construction,
  GraduationCap,
  Milestone,
  TrafficCone,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { SurveyCategory } from "@/lib/gps";

const categories: {
  id: SurveyCategory;
  label: string;
  shortLabel: string;
  icon: typeof Blocks;
  style: string;
}[] = [
  { id: "Bridge", label: "Bridge", shortLabel: "BRIDGE", icon: Blocks, style: "category-bridge" },
  { id: "School zone", label: "School zone", shortLabel: "SCHOOL", icon: GraduationCap, style: "category-school" },
  { id: "Pothole / slump", label: "Pothole / slump", shortLabel: "POTHOLE", icon: Construction, style: "category-pothole" },
  { id: "Sharp curve", label: "Sharp curve / bend", shortLabel: "CURVE", icon: Milestone, style: "category-curve" },
  { id: "Speed bump", label: "Speed bump / rumble strip", shortLabel: "BUMP", icon: Waves, style: "category-bump" },
  { id: "Checkpoint / other", label: "Checkpoint / other", shortLabel: "OTHER", icon: TrafficCone, style: "category-checkpoint" },
];

type LoggerGridProps = {
  notes: string;
  onNotesChange: (notes: string) => void;
  onLog: (category: SurveyCategory) => void;
  gpsReady: boolean;
  audioEnabled: boolean;
  onAudioEnabledChange: (enabled: boolean) => void;
  recordedCount: number;
};

export function LoggerGrid({
  notes,
  onNotesChange,
  onLog,
  gpsReady,
  audioEnabled,
  onAudioEnabledChange,
  recordedCount,
}: LoggerGridProps) {
  return (
    <aside aria-label="Survey controls" className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground">FIELD RECORDING</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">Quick log</h2>
        </div>
        <span className="rounded border border-border bg-background px-2 py-1 font-mono text-xs tabular-nums text-muted-foreground">
          {String(recordedCount).padStart(2, "0")} PT
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <label className="flex flex-col gap-1.5" htmlFor="survey-note">
          <span className="text-xs font-medium text-foreground">Feature name / notes</span>
          <Input
            id="survey-note"
            type="text"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            maxLength={160}
            placeholder="e.g. Kuje bridge, north side"
            className="h-10 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          {categories.map(({ id, label, shortLabel, icon: Icon, style }) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              disabled={!gpsReady}
              onClick={() => onLog(id)}
              aria-label={`Log ${label}`}
              className={`group category-button ${style} flex h-[88px] flex-col items-start justify-between whitespace-normal border-border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-current disabled:opacity-45`}
            >
              <Icon aria-hidden="true" className="size-5 text-current" />
              <span className="min-w-0">
                <span className="block break-words text-[13px] font-semibold leading-tight text-foreground">{shortLabel}</span>
                <span className="mt-1 block break-words text-[10px] leading-tight text-muted-foreground">{label}</span>
              </span>
              <ArrowDown aria-hidden="true" className="absolute right-2 top-2 size-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </Button>
          ))}
        </div>

        {!gpsReady && (
          <p className="text-xs leading-relaxed text-warning">Waiting for a live GPS fix before recording survey points.</p>
        )}

        <div className="mt-auto flex items-start gap-3 border-t border-border pt-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <AudioLines aria-hidden="true" className="size-4 text-primary" />
          </div>
          <div className="flex-1">
            <label htmlFor="audio-warnings" className="block cursor-pointer text-xs font-medium leading-relaxed text-foreground">
              Road hazard audio warnings
            </label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Voice alert within 200 m</p>
          </div>
          <Switch
            id="audio-warnings"
            checked={audioEnabled}
            onCheckedChange={onAudioEnabledChange}
            aria-label="Enable road hazard audio warnings"
          />
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {gpsReady ? <Activity aria-hidden="true" className="size-3.5 text-success" /> : <AudioLines aria-hidden="true" className="size-3.5 text-warning" />}
          <span>Notes carry into the next point. Tap a category to save a location.</span>
        </div>
      </div>
    </aside>
  );
}