"use client";

import { useState } from "react";
import { METERS_PER_FOOT, radiusPresets, useMeasurementUnits } from "@/components/trailhead/TrailheadMeasurementSettings";

export function validRadius(meters: number) {
  return Number.isFinite(meters) && meters >= 3.048 && meters <= 1609.344;
}

export default function SearchRadiusField({ meters, onChange }: { meters: number; onChange: (value: number) => void }) {
  const [units] = useMeasurementUnits();
  const preset = radiusPresets.find(feet => Math.abs(feet * METERS_PER_FOOT - meters) < 1e-9);
  const [custom, setCustom] = useState(false);
  const imperial = units === "imperial";
  const scale = imperial ? METERS_PER_FOOT : 1;
  const fieldClass = "mt-2 w-full rounded-xl border border-night-sky/15 bg-white px-3 py-3 text-sm";

  return <fieldset className="mt-4 space-y-3">
    <legend className="text-sm font-bold text-night-sky">Search area</legend>
    <label className="block text-sm">Search radius
      <select className={fieldClass} value={custom || !preset ? "custom" : preset} onChange={e => {
        const isCustom = e.target.value === "custom";
        setCustom(isCustom);
        if (!isCustom) onChange(Number(e.target.value) * METERS_PER_FOOT);
      }}>
        {radiusPresets.map(feet => <option key={feet} value={feet}>
          {imperial ? feet + " ft" : Number((feet * METERS_PER_FOOT).toFixed(4)) + " m"}{feet === 20 ? " — recommended" : ""}
        </option>)}
        <option value="custom">Custom radius</option>
      </select>
    </label>
    {(custom || !preset) && <label className="block text-sm">Custom radius in {imperial ? "feet" : "meters"}
      <input key={units} type="number" className={fieldClass} step="any" required
        min={imperial ? 10 : 3.048} max={imperial ? 5280 : 1609.344}
        defaultValue={Number.isFinite(meters) ? Number((meters / scale).toFixed(6)) : ""}
        onChange={e => onChange(e.target.valueAsNumber * scale)} />
    </label>}
  </fieldset>;
}
