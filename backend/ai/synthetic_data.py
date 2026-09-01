import random
import datetime
import numpy as np
import pandas as pd

def generate_synthetic_historical_data(days: int = 180, seed: int = 42) -> pd.DataFrame:
    """
    Generates a deterministic synthetic 180-day operational dataset for ML model training.
    Explicitly labeled: SYNTHETIC HISTORICAL DATASET (180-Day Pattern, Seed 42).
    """
    random.seed(seed)
    np.random.seed(seed)

    sites = ["SITE-PIT-01", "SITE-QRY-02", "SITE-MTR-03", "SITE-DEP-04"]
    categories = [
        "Hydraulic Excavator",
        "Off-Highway Haul Truck",
        "Articulated Haul Truck",
        "Track Dozer",
        "Wheel Loader",
        "Motor Grader",
        "Soil Compactor"
    ]

    start_date = datetime.date.today() - datetime.timedelta(days=days)
    records = []

    for day_offset in range(days):
        current_date = start_date + datetime.timedelta(days=day_offset)
        is_weekend = current_date.weekday() >= 5
        # Seasonal/project cycle factor (sine wave overlay)
        season_factor = 1.0 + 0.3 * np.sin(2 * np.pi * day_offset / 60.0)

        for site_code in sites:
            for cat in categories:
                # Base demand depending on site and machinery type
                base_demand = 2.5 if "PIT" in site_code or "MTR" in site_code else 1.5
                if cat in ["Hydraulic Excavator", "Off-Highway Haul Truck"]:
                    base_demand *= 1.4

                weekend_mult = 0.4 if is_weekend else 1.0
                noise = np.random.normal(0, 0.5)

                demand_count = max(0, int(round((base_demand * season_factor * weekend_mult) + noise)))
                allocated_count = max(0, int(round(demand_count * np.random.uniform(0.7, 1.2))))

                # Average operational telemetry parameters for category on that day
                avg_eng = round(float(np.random.uniform(6.0, 14.0)), 1)
                avg_idle = round(float(np.random.uniform(1.0, 4.5)), 1)
                util = round((avg_eng / (avg_eng + avg_idle)) * 100.0, 1)

                records.append({
                    "date": current_date.isoformat(),
                    "day_of_week": current_date.weekday(),
                    "is_weekend": is_weekend,
                    "site_code": site_code,
                    "equipment_type": cat,
                    "predicted_demand_count": demand_count,
                    "allocated_count": allocated_count,
                    "avg_engine_hours": avg_eng,
                    "avg_idle_hours": avg_idle,
                    "avg_utilization": util,
                    "dataset_label": "SYNTHETIC HISTORICAL DATASET (180-Day Pattern, Seed 42)"
                })

    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    df = generate_synthetic_historical_data()
    print(f"Generated {len(df)} synthetic historical records. Sample:")
    print(df.head())
