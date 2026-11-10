import { z } from "zod";

export const measurementGroupsSchema = z
  .array(
    z.object({
      measurement_range: z.string().trim().max(2000),
      correction_factor: z.string().max(10000).default(""),
      source_index: z.number().int().min(0).max(199).optional(),
    }),
  )
  .min(1)
  .max(200)
  .superRefine((groups, context) => {
    groups.forEach((group, index) => {
      if (
        !group.measurement_range &&
        (groups.length > 1 || group.correction_factor.trim())
      )
        context.addIssue({
          code: "custom",
          path: [index, "measurement_range"],
          message: "Isi rentang ukur pada setiap baris.",
        });
    });
  })
  .refine((groups) => {
    const indices = groups.flatMap((g) =>
      g.source_index === undefined ? [] : [g.source_index],
    );
    return new Set(indices).size === indices.length;
  }, "Referensi kelompok tidak boleh berulang.");
export type MeasurementGroupInput = z.infer<
  typeof measurementGroupsSchema
>[number];

export function measurementInputs(
  row?: Record<string, unknown>,
  rangesOnly = false,
): MeasurementGroupInput[] {
  if (
    rangesOnly &&
    Array.isArray(row?.measurement_ranges) &&
    row.measurement_ranges.length
  )
    return row.measurement_ranges.map((range) => ({
      measurement_range: String(range),
      correction_factor: "",
    }));
  if (
    Array.isArray(row?.monitoring_measurements) &&
    row.monitoring_measurements.length
  )
    return row.monitoring_measurements.map((group, index) => {
      const g = group as Record<string, unknown>;
      return {
        measurement_range: String(
          g.measurement_range ?? row.measurement_range ?? "",
        ),
        correction_factor: String(g.correction_factor ?? ""),
        source_index: index,
      };
    });
  return [
    {
      measurement_range: String(row?.measurement_range ?? ""),
      correction_factor: String(row?.correction_factor ?? ""),
    },
  ];
}

// Source metadata is read from the database, never accepted as editable form values.
export function mergeMeasurementGroups(
  inputs: MeasurementGroupInput[],
  previous: unknown,
  shared: Record<string, unknown>,
) {
  const old = Array.isArray(previous) ? previous : [];
  return inputs.map((input) => {
    if (input.source_index !== undefined && !old[input.source_index])
      throw Error(
        "Referensi kelompok ukur telah berubah. Muat ulang formulir.",
      );
    const source =
      input.source_index === undefined ? {} : old[input.source_index];
    return {
      ...source,
      ...shared,
      measurement_range: input.measurement_range,
      correction_factor: input.correction_factor,
    };
  });
}
