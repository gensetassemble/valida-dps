import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeasurementSummary } from "@/features/operations/measurement-summary";
describe("readable measurement summaries",()=>{
 it("uses separate authoritative asset ranges instead of a collapsed legacy summary",()=>{
  const html=renderToStaticMarkup(createElement(MeasurementSummary,{field:"measurement_range",assetRanges:true,row:{measurement_range:'Old collapsed summary',measurement_ranges:['Temperature 0–120 °C','Humidity 2–99 %']}}));
  expect(html.match(/<li /g)).toHaveLength(2);expect(html).toContain('Temperature 0–120 °C');expect(html).toContain('Humidity 2–99 %');expect(html).not.toContain('Old collapsed summary');
 });
 it("retains paired correction values including zero and explicit line breaks",()=>{
  const html=renderToStaticMarkup(createElement(MeasurementSummary,{field:"correction_factor",row:{monitoring_measurements:[{measurement_range:'A',correction_factor:0},{measurement_range:'B',correction_factor:'-1,3\\n0,2'}]}}));
  expect(html.match(/<li /g)).toHaveLength(2);expect(html).toContain('>0</span>');expect(html).toContain('-1,3\n0,2');expect(html).not.toContain('[object Object]');
 });
});
