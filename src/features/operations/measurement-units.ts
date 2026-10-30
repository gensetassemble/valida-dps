// BIPM SI symbols are case-sensitive. Legacy units stay separate; no conversion
// or rewriting of existing measurements is performed.
export const SI_UNITS = ["m", "mm", "cm", "µm", "nm", "m²", "m³", "m/s", "m/s²", "kg", "g", "mg", "µg", "s", "ms", "A", "mA", "µA", "K", "mol", "cd", "rad", "sr", "Hz", "kHz", "MHz", "N", "kN", "N·m", "Pa", "kPa", "MPa", "J", "W", "kW", "V", "mV", "kV", "Ω", "kΩ", "MΩ", "GΩ", "S", "F", "H", "T", "Wb", "C", "°C", "lm", "lx", "Bq", "Gy", "Sv", "kat", "kg/m³", "g/cm³", "mg/m³"];
export const ACCEPTED_UNITS = ["L", "mL", "µL", "L/min", "mL/min", "m³/h", "min", "h", "t", "°"];
const LEGACY_UNITS = ["%", "%RH", "% RH", "ppm", "pH", "dB", "bar", "mbar", "psi", "rpm", "°F", "ml", "kg/l", "kg/L", "g/mL", "L/m", "NL/m", "kgf", "KGF", "Ω", "⁰C"];
export const ALL_UNIT_SYMBOLS = [...SI_UNITS, ...ACCEPTED_UNITS, ...LEGACY_UNITS];
export function historicalUnitSymbols(values: string[]) {
  const found = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(/(?:\d|\))\s*([%µμΩΩ⁰°A-Za-z][A-Za-zµμΩΩ⁰°%²³·/]{0,20})(?=$|[\s,;'])/g))
      found.add(match[1].replace(/\/$/, ""));
  }
  return [...found].filter((unit) => unit.length <= 24 && !SI_UNITS.includes(unit) && !ACCEPTED_UNITS.includes(unit)).sort();
}
export function splitMeasurement(value: string, extraUnits: string[] = []) {
  const units = [...new Set([...ALL_UNIT_SYMBOLS, ...extraUnits])].sort((a, b) => b.length - a.length);
  for (const unit of units) {
    if (!value.trimEnd().endsWith(unit)) continue;
    const range = value.trimEnd().slice(0, -unit.length).trimEnd();
    // Multi-parameter descriptions remain intact instead of guessing which unit
    // belongs to each parameter.
    if (/\d/.test(range) && !/[A-Za-zµμΩΩ°⁰%]/.test(range)) return { range, unit };
  }
  const other = value.match(/^([\d\s.,+\-−–~()/]+?)\s*([%µμΩΩ⁰°A-Za-z][A-Za-z0-9µμΩΩ⁰°%²³·/]{0,23})$/);
  if (other && /\d/.test(other[1])) return { range: other[1].trim(), unit: other[2] };
  return { range: value, unit: "" };
}
export function joinMeasurement(range: string, unit: string) {
  return range.trim() ? [range.trim(), unit.trim()].filter(Boolean).join(" ") : "";
}
