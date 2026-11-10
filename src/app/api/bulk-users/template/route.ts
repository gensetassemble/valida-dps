import {NextResponse,type NextRequest} from "next/server";
import ExcelJS from "exceljs";
import {requireActiveUser} from "@/lib/auth/guards";
import {hasSecondFactor} from "@/lib/auth/security";
import {masterClient} from "@/features/master-data/server";
import {ALL_ROLES} from "@/lib/auth/permissions";
export async function GET(request:NextRequest){
 const c=await requireActiveUser();const b=request.nextUrl.searchParams.get("branch")||c.profile.branch_code;
 if(!c.scopes.some(s=>s.branch_code===b&&s.role_code==="super_admin")||!(await hasSecondFactor(await masterClient())))return NextResponse.json({error:"Akses ditolak."},{status:403});
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet("Pengguna",{views:[{state:"frozen",ySplit:1}]});sheet.columns=[{header:"Nama",key:"name",width:35},{header:"NPP",key:"npp",width:20},{header:"Email",key:"email",width:45},{header:"Peran",key:"roles",width:40}];
 sheet.getColumn(2).numFmt="@";sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0B2545"}};sheet.getRow(1).height=26;
 for(let i=2;i<=101;i++){sheet.getCell(i,2).numFmt="@";sheet.getCell(i,4).dataValidation={type:"list",allowBlank:true,formulae:['"'+ALL_ROLES.join(",")+'"']};}
 const notes=book.addWorksheet("Panduan");notes.getColumn(1).width=110;["Isi sheet Pengguna; satu pegawai per baris. Jangan masukkan password.","NPP wajib format Teks untuk menjaga nol di depan. Non-NPP dikosongkan, cocokkan Nama persis dengan direktori.","Email diisi manual dan tidak akan dikirimi email oleh fitur ini.","Peran memakai kode pada dropdown. Untuk beberapa peran, ketik kode dipisahkan |.","Akun yang sudah ada tidak ditimpa. Baris ambigu/pegawai nonaktif ditolak.","Password awal ditetapkan Admin di server; akun wajib menggantinya saat login pertama.","Koordinator mengikuti penugasan portofolio aktif yang sudah ada; fitur ini tidak membuat penugasan portofolio."].forEach(s=>notes.addRow([s]));
 const bytes=await book.xlsx.writeBuffer();return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="Template Akun Massal VALIDA.xlsx"',"Cache-Control":"private, no-store"}});
}
