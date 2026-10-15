import pandas as pd
import sys
from pathlib import Path

def main():
    input_path = Path("hazards.csv")
    output_path = Path("cleaned_hazards.csv")

    if not input_path.exists():
        print(f"Error: {input_path} not found in current directory.", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(input_path)

    # Ensure required columns exist
    required_cols = ["point_id", "timestamp_utc", "category", "latitude", "longitude", "accuracy_meters", "speed_kmh", "altitude_m", "notes"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        print(f"Warning: missing columns {missing}. Proceeding with available columns.")

    # Category counts
    if "category" in df.columns:
        counts = df["category"].value_counts()
        print("Category counts:")
        print(counts.to_string())
    else:
        print("No category column found.")

    # Average GPS accuracy
    if "accuracy_meters" in df.columns:
        avg_accuracy = pd.to_numeric(df["accuracy_meters"], errors="coerce").mean()
        print(f"\nAverage GPS accuracy: {avg_accuracy:.2f} meters")
    else:
        print("\nAccuracy column not found.")
        avg_accuracy = None

    # Filter out inaccurate points >30m
    if "accuracy_meters" in df.columns:
        original_count = len(df)
        df_clean = df[pd.to_numeric(df["accuracy_meters"], errors="coerce") <= 30].copy()
        filtered_count = len(df_clean)
        print(f"\nPoints before filtering: {original_count}")
        print(f"Points after filtering (accuracy <= 30m): {filtered_count}")
        print(f"Removed {original_count - filtered_count} inaccurate points.")
    else:
        df_clean = df.copy()

    # Save cleaned CSV
    df_clean.to_csv(output_path, index=False)
    print(f"\nCleaned data saved to {output_path.resolve()}")

if __name__ == "__main__":
    main()
