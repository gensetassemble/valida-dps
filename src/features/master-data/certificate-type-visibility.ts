import type { EntityConfig } from "./registry";

// Internal certificate identifiers are presented only to the branch Super Admin.
// Keep other catalogs' codes and the shared registry unchanged.
export function certificateTypePresentation(entity: EntityConfig, superAdmin: boolean): EntityConfig {
  if (entity.key !== "jenis-sertifikat" || superAdmin) return entity;
  return {
    ...entity,
    fields: entity.fields.filter(field => field.key !== "code"),
    columns: entity.columns.filter(column => column !== "code"),
    search: entity.search.filter(column => column !== "code"),
  };
}
export function hasCertificateTypeCode(entity: EntityConfig) {
  return entity.fields.some(field => field.key === "code");
}
export function visibleMasterRecord<T extends Record<string, unknown>>(entity: EntityConfig, row: T): T {
  if (entity.key !== "jenis-sertifikat" || hasCertificateTypeCode(entity)) return row;
  return Object.fromEntries(Object.entries(row).filter(([field]) => field !== "code")) as T;
}
