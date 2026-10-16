# RoadTrace GPS Highway Survey Recorder

**RoadTrace** is a production-ready, map-free GPS data collector for highway field surveys along the Kuje → Abuja → Lokoja corridor. Record precise survey points, log road hazards in one tap, and export GPS field notes as CSV for analysis.

Live demo: https://pixel-perfect-main-nine.vercel.app

## Features

- Live high-accuracy GPS tracking via `navigator.geolocation.watchPosition`
- Manual hazard logging: Bridge, School zone, Pothole / slump, Sharp curve, Speed bump, Checkpoint / other
- Optional notes per point
- Auto-collect mode: records a point every 10s when moving ≥15m
- Real-time metrics: latitude, longitude, accuracy, speed, altitude, points logged
- Toast feedback on record: “Just recorded bridge” etc.
- CSV export with header `point_id,timestamp_utc,category,latitude,longitude,accuracy_meters,speed_kmh,altitude_m,notes`
- LocalStorage persistence
- Professional, responsive UI with auto-collect toggle and survey table
- Python data pipeline `process_data.py` for hazard analysis with pandas

## Tech Stack

- TanStack Start + Vite + React 18
- TypeScript
- Lucide React icons
- Vercel deployment
- Python 3 + pandas for data processing

## Installation

Prerequisites: Node.js 18+, npm

```sh
git clone https://github.com/Dev-Ashy/roadtrace-gps-collector.git
cd roadtrace-gps-collector
npm install
npm run dev
```

Open http://localhost:5173

### Build for production

```sh
npm run build
npm run preview
```

### Deploy to Vercel

```sh
vercel --prod
```

## Usage

1. Allow location access when prompted.
2. Wait for “Live Signal Lock”.
3. Optionally enable **Auto-collect every 10s when moving ≥15m**.
4. Add optional notes and tap a hazard category to log a point.
5. View points in the Survey Points table.
6. Click **Download CSV** to export all records.

Data is saved to `localStorage` under `corridor-survey-records-v1`. Auto-collected points use category `Checkpoint / other` with notes `Auto-collected`.

## Data Pipeline

```sh
python process_data.py
```

Analyzes exported CSV for hazard counts, distance, and category summaries.

## Project Structure

```
src/
  routes/index.tsx      # Main collector UI
  components/           # UI components
  lib/gps.ts            # Types and GPS utilities
process_data.py         # Python analysis script
```

## License

MIT

## Author

Dev-Ashy
