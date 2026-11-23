import 'server-only';
import ExcelJS from 'exceljs';
import {read,utils} from 'xlsx';
import {checkZip, isOleWorkbook} from '@/features/imports/workbook-security';

/** Convert values and merges only. Macros, links and embedded objects are never executed. */
export function legacyWorkbook(name:string,bytes:Buffer):ExcelJS.Workbook {
  if(/\.xlsb$/i.test(name)) checkZip(bytes);
  else if(!isOleWorkbook(bytes))
    throw Error('Format XLS tidak valid. Simpan workbook sebagai XLS atau XLSX asli.');
  const source=read(bytes,{type:'buffer',cellDates:true,cellFormula:true,cellHTML:false,bookVBA:false,sheetRows:20001});
  if(source.SheetNames.length>100)throw Error('Maksimum 100 sheet dalam satu workbook.');
  const book=new ExcelJS.Workbook();
  source.SheetNames.forEach((name,index)=>{
    const input=source.Sheets[name],sheet=book.addWorksheet(name);
    if(source.Workbook?.Sheets?.[index]?.Hidden)sheet.state='hidden';
    if(!input['!ref'])return;
    const bounds=utils.decode_range(input['!fullref']||input['!ref']);
    if(bounds.e.r>=20000||bounds.e.c>=100)throw Error(`${name}: maksimum 20.000 baris fisik dan 100 kolom.`);
    for(const [address,cell] of Object.entries(input)){
      if(address.startsWith('!')||!cell)continue;
      const target=sheet.getCell(address);
      if(cell.f)target.value={formula:cell.f,...(cell.v!==undefined?{result:cell.v}: {})};
      else if(cell.t==='d')target.value=new Date(cell.v);
      else target.value=cell.w??cell.v??null;
    }
    for(const merge of input['!merges']||[])sheet.mergeCells(utils.encode_range(merge));
  });
  return book;
}
