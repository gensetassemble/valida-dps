import {describe,it,expect} from "vitest";
import {contractDisplay,contractInput} from "@/features/master-data/contract-money";
describe("Contract currency editing",()=>{
  it("formats rupiah and preserves decimal cents and large exact strings",()=>{
    expect(contractDisplay("170000000.00")).toBe("IDR 170.000.000,-");
    expect(contractDisplay("123456789012345678.90")).toBe("IDR 123.456.789.012.345.678,90");
    expect(contractDisplay("0.05")).toBe("IDR 0,05");
    expect(contractDisplay("")).toBe("");
  });
  it("round trips pasted Indonesian currency without silently deleting invalid text",()=>{
    for(const value of ["170000000","123456789012345678.90","0.05"])
      expect(contractInput(contractDisplay(value))).toBe(value);
    expect(contractInput("Rp 170.000.000,50")).toBe("170000000.50");
    expect(contractInput("1700000.00")).toBe("1700000.00");
    expect(contractInput("abc")).toBe("abc");
    expect(contractInput("-100")).toBe("-100");
  });
});
