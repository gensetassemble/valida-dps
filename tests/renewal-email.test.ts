import { expect,it } from "vitest";
import { renewalEmail } from "../src/features/operations/renewal-email";
it("includes actual work details and expiry without inventing an offer",()=>{
 const email=renewalEmail("PT Uji","CERT/01","[UJI] Adli",{certificateType:"Residual Disinsection",object:"Airbus A320",serial:"PK-ABC",location:"Bandara Ngurah Rai",expiryDate:"2026-11-30",orderReference:"SPK/01"},"2026-11-04");
 for(const text of ["Nama pekerjaan: Perpanjangan Residual Disinsection","Objek pekerjaan: Airbus A320","PK-ABC","Jenis sertifikat: Residual Disinsection","Nomor sertifikat: CERT/01","Bandara Ngurah Rai","30 Nov 2026","26 hari","SPK/01"])expect(email.body).toContain(text);
 expect(email.subject).toMatch(/^\[UJI\]/);expect(email.body).not.toContain("[lengkapi]");
});
it("distinguishes expired and due today",()=>{
 const base={certificateType:"Uji",object:"Alat",location:"Bali",expiryDate:"2026-11-04"};
 expect(renewalEmail("PT Uji","1","PIC",base,"2026-11-04").body).toContain("berakhir hari ini");
 expect(renewalEmail("PT Uji","1","PIC",base,"2026-11-06").body).toContain("berakhir 2 hari yang lalu");
});
