export function certificateFormSections(entity:string){
  if(entity==="kalibrasi-alat")return [{id:"identity",label:"Identitas alat"},{id:"specification",label:"Spesifikasi & kondisi"},{id:"initial",label:"Kalibrasi awal"},{id:"notes",label:"Catatan"}];
  if(["riwayat-kalibrasi","kompetensi-personil","sertifikat-klien"].includes(entity))return [{id:"identity",label:"Data sertifikat"},{id:"dates",label:"Masa berlaku"},...(entity==="riwayat-kalibrasi"?[{id:"parameters",label:"Parameter & koreksi"}]:[]),{id:"notes",label:"Catatan & dokumen"}];
  return [];
}
export function certificateFieldSection(entity:string,key:string){
  if(entity==="kalibrasi-alat"){
    if(key.startsWith("initial_"))return "initial";
    if(["measurement_groups","measurement_range","correction_factor","color","specification_size","item_condition","item_status"].includes(key))return "specification";
  }
  if(["notes","source_folder_url","is_active"].includes(key))return "notes";
  if(["measurement_groups","measurement_range","correction_factor"].includes(key))return "parameters";
  if(["validity_kind","issue_date","expiry_date","interval_months","interval_days","due_date","calibration_date","reported_due_date","calculation_base","resolution_note"].includes(key))return "dates";
  return "identity";
}
