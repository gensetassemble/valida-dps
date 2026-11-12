type Row = Record<string, unknown>;
/** A letter explicitly printed in the Rotameter certificate identifies its valve. */
export function rotameterComponent(name: string, certificate: string): string | null {
  if (!/rotameter/i.test(name)) return null;
  const match=certificate.match(/^\s*K\s*-\s*\d+\s*([A-Z])\s*\//i);
  return match ? `Katup ${match[1].toUpperCase()}` : null;
}
export function componentReportRow(equipment: Row, calibration: Row): Row {
  return {...equipment,...Object.fromEntries(['calibration_internal','calibration_external','significant_yes','significant_no','monitoring_measurements','correction_factor','calibration_date_original','due_date_original','component_label'].map(k=>[k,calibration[k]])),
    latest_calibration_id:calibration.id,monitoring_certificate:calibration.certificate_number,
    monitoring_interval:calibration.interval_label || (calibration.interval_months ? `${calibration.interval_months} bulan` : ''),
    latest_calibration_date:calibration.issue_date || calibration.calibration_date,
    latest_due_date:calibration.due_date,monitoring_laboratory:calibration.laboratory,
  };
}
