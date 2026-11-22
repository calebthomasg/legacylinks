"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type MeasurementUnits = "imperial" | "metric";
export const METERS_PER_FOOT = 0.3048;
export const radiusPresets = [10, 20, 30, 50, 75, 100];
export const defaultRadius = 20 * METERS_PER_FOOT;
const preferenceKey = "trailhead_measurement_units";

export function useMeasurementUnits() {
  const client = useMemo(() => createClient(), []);
  const [units, setUnits] = useState<MeasurementUnits>("imperial");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const preference = session?.user.user_metadata[preferenceKey];
      let fallback = "imperial";
      try {
        fallback = localStorage.getItem("legacylink:trailhead:units") ?? fallback;
      } catch { /* Browser storage is optional. */ }
      setUnits((preference ?? fallback) === "metric" ? "metric" : "imperial");
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  async function changeUnits(next: MeasurementUnits) {
    if (saving || next === units) return;
    setSaving(true);
    setError("");
    try {
      const result = await client.auth.updateUser({ data: { [preferenceKey]: next } });
      if (result.error) throw result.error;
      setUnits(next);
    } catch {
      setError("Couldn’t save your units. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }
  return [units, changeUnits, saving, error] as const;
}

export function formatDistance(meters: number, units: MeasurementUnits) {
  if (units === "metric") {
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  }
  const feet = meters / METERS_PER_FOOT;
  if (feet < 300) return `${Math.round(feet)} ft`;
  if (feet < 2640) return `${Math.round(feet / 3)} yd`;
  return `${(feet / 5280).toFixed(1)} mi`;
}

export default function TrailheadMeasurementSettings() {
  const [units, change, saving, error] = useMeasurementUnits();
  return <section className="rounded-2xl border border-night-sky/10 bg-white p-4">
    <h3 className="font-bold text-night-sky">Measurement units</h3>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {(["imperial", "metric"] as const).map(value =>
        <button key={value} type="button" disabled={saving} aria-pressed={units === value}
          onClick={() => change(value)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${units === value ? "border-teal bg-teal/10" : "border-night-sky/15"}`}>
          {value === "imperial" ? "Feet & miles" : "Meters & km"}
        </button>)}
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
