import {beforeEach, describe, expect, it, vi} from "vitest";

const db = vi.hoisted(() => {
  const query = {
    select: vi.fn(), eq: vi.fn(), or: vi.fn(), order: vi.fn(),
    range: vi.fn(async () => ({data: [], count: 0, error: null})),
  };
  for (const method of [query.select, query.eq, query.or, query.order]) method.mockReturnValue(query);
  return {query, from: vi.fn(() => query)};
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({createClient: async () => db}));
vi.mock("@/lib/auth/guards", () => ({requireActiveUser: vi.fn()}));
import {listRecords} from "@/features/master-data/server";
import {OPERATIONAL_ENTITIES} from "@/features/operations/entities";

describe("Calibration search", () => {
  beforeEach(() => vi.clearAllMocks());
  it("searches laboratory labels in the scoped server query before pagination", async () => {
    await listRecords(OPERATIONAL_ENTITIES["kalibrasi-alat"], "DPS", {q:"Caltesys", unit:"Denpasar", page:"2"});
    expect(db.from).toHaveBeenCalledWith("equipment_monitoring_records");
    expect(db.query.eq).toHaveBeenCalledWith("branch_code", "DPS");
    expect(db.query.eq).toHaveBeenCalledWith("owner_unit", "Denpasar");
    const clause = db.query.or.mock.calls[0][0];
    for (const column of ["monitoring_laboratory", "monitoring_certificate", "portfolio_code", "owner_unit"])
      expect(clause).toContain(`${column}.ilike.%Caltesys%`);
    expect(db.query.range).toHaveBeenCalledWith(40,79);
    expect(db.query.or.mock.invocationCallOrder[0]).toBeLessThan(db.query.range.mock.invocationCallOrder[0]);
  });
});
