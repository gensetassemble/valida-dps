import { beforeEach,describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({context:vi.fn(),rpc:vi.fn(),refresh:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/features/master-data/server',()=>({entityContext:mocks.context,masterClient:async()=>({rpc:mocks.rpc})}));
vi.mock('next/cache',()=>({revalidatePath:mocks.refresh}));
import { POST } from '@/app/api/operations/equipment-import/route';
function request(content:string,origin='https://valida.test',extra:Record<string,string>={}){
  const f=new FormData();f.set('branch','DPS');f.set('portfolio','PIK');f.set('file',new File([content],'ptk.csv',{type:'text/csv'}));
  for(const [key,value] of Object.entries(extra))f.set(key,value);
  return new NextRequest('https://valida.test/api/operations/equipment-import',{method:'POST',headers:{origin},body:f});
}
describe('UMA authenticated import endpoint',()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({branch:'DPS'});mocks.rpc.mockResolvedValue({data:{rows:[{sheet:'CSV',row:2,name:'Pump',tag:'PIK-001',equipment_id:'new-id',equipment:'added',calibration:'none',match:'new'}]},error:null});});
  it('rejects cross-origin and unauthorized requests without a database mutation',async()=>{
    expect((await POST(request('invalid','https://other.test'))).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.context.mockRejectedValue(Error('denied'));expect((await POST(request('invalid'))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('screens server-parsed UMA values without applying them',async()=>{
    const r=await POST(request('Nama Barang,Tag-Number,Keterangan\nPump,PIK-001,Siap'));expect(r.status).toBe(200);
    expect(mocks.context).toHaveBeenCalledWith('kalibrasi-alat','DPS',true);
    expect(mocks.rpc).toHaveBeenCalledWith('preview_equipment_uma',expect.objectContaining({b:'DPS',filename:'ptk.csv',items:[expect.objectContaining({portfolio:'PIK',asset:{notes:'Siap'},calibration:{notes:'Siap'}})]}));
    expect(mocks.rpc).not.toHaveBeenCalledWith('apply_equipment_uma_reviewed',expect.anything());
    expect(mocks.refresh).not.toHaveBeenCalled();expect(r.headers.get('cache-control')).toContain('no-store');
    expect((await r.json()).phase).toBe('preview');
  });
  it('applies only the same screened file with a classification for sensitive changes',async()=>{
    const content='Nama Barang,Tag-Number,Nomor Sertifikat,Tanggal terbit sertifikat\nPump,PIK-001,CERT-2,01/11/2026';
    mocks.rpc.mockImplementation(async(name:string)=>name==='preview_equipment_uma'?{data:{rows:[{sheet:'CSV',row:2,name:'Pump',tag:'PIK-001',equipment_id:'new-id',equipment:'added',calibration:'added',match:'new'}]},error:null}:{data:{run:'run-id',rows:[{equipment:'added',calibration:'added'}]},error:null});
    const previewResponse=await POST(request(content));const preview=await previewResponse.json();
    const key=preview.rows[0].reviewKey;
    const applied=await POST(request(content,'https://valida.test',{operation:'apply',fileHash:preview.fileHash,reviews:JSON.stringify({[key]:'calibration_event'})}));
    expect(applied.status).toBe(200);expect((await applied.json()).phase).toBe('applied');
    expect(mocks.rpc).toHaveBeenCalledWith('apply_equipment_uma_reviewed',expect.objectContaining({items:[expect.objectContaining({review:expect.objectContaining({classification:'calibration_event'})})]}));
    expect(mocks.refresh).toHaveBeenCalledWith('/dashboard');
  });
  it('does not mutate on parse errors, and reports database row errors without claiming success',async()=>{
    const invalid=await POST(request('Nama Barang,Tag-Number,Tanggal Berakhir\nPump,PIK-001,31/02/2026'));expect(invalid.status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({data:null,error:{code:'P0001',message:'CSV baris 2: ambigu\nCSV baris 3: nomor seri berbeda'}});
    const rejected=await POST(request('Nama Barang,Tag-Number\nPump,PIK-001'));expect(rejected.status).toBe(422);expect((await rejected.json()).issues).toHaveLength(2);expect(mocks.refresh).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({data:null,error:{code:'57014',message:'timeout'}});const timeout=await POST(request('Nama Barang,Tag-Number\nPump,PIK-001'));expect((await timeout.json()).issues[0]).toContain('batas waktu');
  });
});
