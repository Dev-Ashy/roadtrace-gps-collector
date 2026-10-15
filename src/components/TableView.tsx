import { useState } from "react";
import { ArrowDownAZ, ChevronDown, ChevronUp, Clock3, MapPin, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SurveyPoint } from "@/lib/gps";

const badgeStyles: Record<SurveyPoint["category"], string> = {
  Bridge: "tag-bridge",
  "School zone": "tag-school",
  "Pothole / slump": "tag-pothole",
  "Sharp curve": "tag-curve",
  "Speed bump": "tag-bump",
  "Checkpoint / other": "tag-checkpoint",
};

type TableViewProps = { points: SurveyPoint[]; onDelete: (pointId: string) => void };

export function TableView({ points, onDelete }: TableViewProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section aria-label="Recorded survey points" className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex min-h-[66px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md border border-border bg-background">
            <ArrowDownAZ aria-hidden="true" className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recorded points</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{points.length} survey {points.length === 1 ? "entry" : "entries"}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? "Hide list" : "Show list"}
          {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </Button>
      </div>

      {expanded && (points.length === 0 ? (
        <div className="flex min-h-28 items-center justify-center border-t border-border px-5 text-sm text-muted-foreground">
          <MapPin aria-hidden="true" className="mr-2 size-4" /> Logged survey points will appear here.
        </div>
      ) : (
        <Table className="min-w-[740px]">
          <TableHeader className="bg-background/70">
            <TableRow>
              <TableHead className="pl-5">FEATURE</TableHead>
              <TableHead>RECORDED (UTC)</TableHead>
              <TableHead>LAT / LONG</TableHead>
              <TableHead>± ACCURACY</TableHead>
              <TableHead>FIELD NOTE</TableHead>
              <TableHead className="pr-4 text-right">REMOVE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.toReversed().map((point) => (
              <TableRow key={point.point_id}>
                <TableCell className="pl-5">
                  <Badge variant="outline" className={`max-w-full break-words text-[11px] ${badgeStyles[point.category]}`}>
                    {point.category}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-3" />{new Date(point.timestamp_utc).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "short", timeStyle: "medium", hour12: false })}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">±{Math.round(point.accuracy_meters)} m</TableCell>
                <TableCell className="max-w-44 truncate text-xs text-muted-foreground">{point.notes || "—"}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(point.point_id)} aria-label={`Delete ${point.category} survey point`} title="Delete point" className="text-muted-foreground hover:text-destructive">
                    <Trash2 aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ))}
    </section>
  );
}