import { useState } from "react";
import { Check, Download, FileJson2, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toCsv, type SurveyPoint } from "@/lib/gps";

type ExportButtonProps = { points: SurveyPoint[] };

function saveDownload(contents: string, fileName: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);
}

export function ExportButton({ points }: ExportButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const exportFile = (format: "csv" | "json") => {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      saveDownload(`\uFEFF${toCsv(points)}`, `corridor-survey-${timestamp}.csv`, "text/csv;charset=utf-8");
    } else {
      saveDownload(JSON.stringify(points, null, 2), `corridor-survey-${timestamp}.json`, "application/json;charset=utf-8");
    }
  };

  const setCsvStorage = async () => {
    type FilePickerSaveOptions = {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    };
    type BrowserFileHandle = {
      createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
    };
    const browserWindow = window as Window & {
      showSaveFilePicker?: (options?: FilePickerSaveOptions) => Promise<BrowserFileHandle>;
    };

    if (!browserWindow.showSaveFilePicker) {
      exportFile("csv");
      return;
    }

    try {
      setSaving(true);
      const handle = await browserWindow.showSaveFilePicker({
        suggestedName: `corridor-survey-${new Date().toISOString().slice(0, 10)}.csv`,
        types: [{ description: "Survey CSV", accept: { "text/csv": [".csv"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(`\uFEFF${toCsv(points)}`);
      await writable.close();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      exportFile("csv");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={setCsvStorage} disabled={saving} title="Choose where to save survey data as CSV" className="h-9 border-border bg-surface px-3">
        {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : saved ? <Check aria-hidden="true" /> : <Download aria-hidden="true" />}
        <span className="hidden sm:inline">{saving ? "Saving…" : saved ? "CSV ready" : "Set CSV storage"}</span>
        <span className="sm:hidden">{saved ? "CSV ready" : "Set CSV"}</span>
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => exportFile("csv")} disabled={points.length === 0} title="Download survey records as a CSV file" className="h-9 px-3">
        <Download aria-hidden="true" />
        <span className="hidden sm:inline">Export CSV file</span>
        <span className="sm:hidden">CSV</span>
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => exportFile("json")} disabled={points.length === 0} title="Download survey records for further processing" className="h-9 px-2 text-muted-foreground">
        <FileJson2 aria-hidden="true" />
        <span className="hidden sm:inline">Export JSON file</span>
        <span className="sm:hidden">JSON</span>
      </Button>
    </div>
  );
}