// Owner subunits are distinct from the free-form physical location of an asset.
export const equipmentUnits = [
  "Denpasar", "UP Lombok", "UP Benete", "Celukan Bawang", "Gilimanuk",
  "Kubu", "TBBM Manggis", "TBBM Reo", "TBBM Alabahi", "TBBM Lombok",
  "Pemaron", "Site Lifuleo",
] as const;

export const equipmentUnitAliases: Record<string, string> = {
  "lombok": "UP Lombok",
  "cab. denpasar -- lombok": "UP Lombok",
  "denpasar -- benete": "UP Benete",
  "denpasar -- manggis": "TBBM Manggis",
  "cab. denpasar": "Denpasar",
  "denpasar (alat hibah dari lab cibitung)": "Denpasar",
  "denpasar - celukan bawang": "Celukan Bawang",
  "denpasar celukan bawang": "Celukan Bawang",
  "denpasar -- giliimanuk": "Gilimanuk",
  "denpasar -- gilimanuk": "Gilimanuk",
  "denpasar--gilimanuk": "Gilimanuk",
  "denpasar -- pemaron": "Pemaron",
  "denpasar -- tbbm alabahi": "TBBM Alabahi",
  "denpasar -- tbbm lombok": "TBBM Lombok",
  "denpasar -- tbbm reo": "TBBM Reo",
};

export function normalizeEquipmentUnit(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  return equipmentUnitAliases[clean.toLocaleLowerCase("id")] || equipmentUnits.find((unit) => unit.toLocaleLowerCase("id") === clean.toLocaleLowerCase("id")) || clean;
}
