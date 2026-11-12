import { beforeEach,describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({context:vi.fn(),rpc:vi.fn(),refresh:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/features/master-data/server',()=>({entityContext:mocks.context,masterClient:async()=>({rpc:mocks.rpc})}));
vi.mock('next/cache',()=>({revalidatePath:mocks.refresh}));
import { POST } from '@/app/api/operations/equipment-import/route';
function request(content:string,origin='https://valida.test'){
  const f=new FormData();f.set('branch','DPS');f.set('portfolio','PIK');f.set('file',new File([content],'ptk.csv',{type:'text/csv'}));
  return new NextRequest('https://valida.test/api/operations/equipment-import',{method:'POST',headers:{origin},body:f});
}
describe('UMA authenticated import endpoint',()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({branch:'DPS'});mocks.rpc.mockResolvedValue({data:{run:'run-id',rows:[{equipment:'updated',calibration:'added'}]},error:null});});
  it('rejects cross-origin and unauthorized requests without a database mutation',async()=>{
    expect((await POST(request('invalid','https://other.test'))).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.context.mockRejectedValue(Error('denied'));expect((await POST(request('invalid'))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('sends only server-parsed UMA values through the authorized atomic RPC',async()=>{
    const r=await POST(request('Nama Barang,Tag-Number,Keterangan\nPump,PIK-001,Siap'));expect(r.status).toBe(200);
    expect(mocks.context).toHaveBeenCalledWith('kalibrasi-alat','DPS',true);
    expect(mocks.rpc).toHaveBeenCalledWith('sync_equipment_uma',expect.objectContaining({b:'DPS',filename:'ptk.csv',items:[expect.objectContaining({portfolio:'PIK',asset:{notes:'Siap'},calibration:{notes:'Siap'}})]}));
    expect(mocks.refresh).toHaveBeenCalledWith('/dashboard');expect(r.headers.get('cache-control')).toContain('no-store');
  });
  it('does not mutate on parse errors, and reports database row errors without claiming success',async()=>{
    const invalid=await POST(request('Nama Barang,Tag-Number,Tanggal Berakhir\nPump,PIK-001,31/02/2026'));expect(invalid.status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({data:null,error:{code:'P0001',message:'CSV baris 2: ambigu\nCSV baris 3: nomor seri berbeda'}});
    const rejected=await POST(request('Nama Barang,Tag-Number\nPump,PIK-001'));expect(rejected.status).toBe(422);expect((await rejected.json()).issues).toHaveLength(2);expect(mocks.refresh).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({data:null,error:{code:'57014',message:'timeout'}});const timeout=await POST(request('Nama Barang,Tag-Number\nPump,PIK-001'));expect((await timeout.json()).issues[0]).toContain('batas waktu');
  });
});
