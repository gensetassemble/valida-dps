import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), context: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireActiveUser: mocks.user }));
vi.mock("@/features/master-data/server", () => ({ masterClient: mocks.client, entityContext: mocks.context }));
import { DELETE } from "@/app/api/documents/route";
const id = "cf120000-0000-4000-8000-000000000001", record = "cf120000-0000-4000-8000-000000000002";
const path = `DPS/personnel/${record}/${id}.pdf`;
function request(origin = "https://valida.example", params = `id=${id}&record=${record}&domain=personnel&branch=DPS`) {
 return new NextRequest(`https://valida.example/api/documents?${params}`, { method: "DELETE", headers: { origin } });
}
describe("remove private attachment", () => {
 beforeEach(() => vi.resetAllMocks());
 it("rejects cross-site deletion before auth or database access", async () => {
  expect((await DELETE(request("https://other.example"))).status).toBe(403);
  expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled();
 });
 it("validates the attachment and its real parent", async () => {
  expect((await DELETE(request(undefined,"id=invalid"))).status).toBe(400);expect(mocks.client).not.toHaveBeenCalled();
 });
 it("requires an active session", async () => {
  mocks.user.mockRejectedValue(new Error("Login required"));await expect(DELETE(request())).rejects.toThrow("Login required");expect(mocks.client).not.toHaveBeenCalled();
 });
 it("rejects read-only users", async () => {
  mocks.context.mockRejectedValue(new Error("Forbidden"));expect((await DELETE(request())).status).toBe(403);expect(mocks.client).not.toHaveBeenCalled();
 });
 it.each([["23503",409],["42501",403],["P0002",404]])("does not touch storage when metadata removal fails %s", async (code,status) => {
  const remove=vi.fn();mocks.client.mockResolvedValue({rpc:vi.fn().mockResolvedValue({error:{code}}),storage:{from:()=>({remove})}});
  expect((await DELETE(request())).status).toBe(status);expect(remove).not.toHaveBeenCalled();
 });
 it("removes only the server-resolved object after the scoped RPC, then marks cleanup", async () => {
  const rpc=vi.fn().mockResolvedValueOnce({data:{id,object_path:path,cleanup_pending:true},error:null}).mockResolvedValueOnce({error:null});
  const remove=vi.fn().mockImplementation(async()=>{expect(rpc).toHaveBeenCalledTimes(1);return{error:null};});
  mocks.client.mockResolvedValue({rpc,storage:{from:()=>({remove})}});
  const response=await DELETE(request());expect(await response.json()).toMatchObject({ok:true,cleanupPending:false});expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.context).toHaveBeenCalledWith("kompetensi-personil","DPS",true);
  expect(rpc).toHaveBeenNthCalledWith(1,"remove_operational_document",{doc:id,b:"DPS",d:"personnel",r:record});expect(remove).toHaveBeenCalledWith([path]);expect(rpc).toHaveBeenNthCalledWith(2,"finish_document_cleanup",{doc:id});
 });
 it("preserves retry state if storage is unavailable", async () => {
  const rpc=vi.fn().mockResolvedValue({data:{id,object_path:path,cleanup_pending:true},error:null});mocks.client.mockResolvedValue({rpc,storage:{from:()=>({remove:vi.fn().mockRejectedValue(Error("Storage offline"))})}});
  expect(await (await DELETE(request())).json()).toMatchObject({ok:true,cleanupPending:true});expect(rpc).toHaveBeenCalledTimes(1);
 });
 it("handles a completed retry without deleting any other blob", async () => {
  const from=vi.fn();mocks.client.mockResolvedValue({rpc:vi.fn().mockResolvedValue({data:{id,object_path:path,cleanup_pending:false},error:null}),storage:{from}});
  expect(await (await DELETE(request())).json()).toMatchObject({ok:true,cleanupPending:false});expect(from).not.toHaveBeenCalled();
 });
});
