import "server-only";
export interface TokenStore {
  // Store the serialized MSAL cache encrypted with a managed key, scoped to the Supabase user and tenant.
  read(userId: string, tenantId: string): Promise<string | null>;
  write(userId: string, tenantId: string, encryptedCache: string): Promise<void>;
  remove(userId: string, tenantId: string): Promise<void>;
}
export const tokenStore: TokenStore = {
  async read() { return null; },
  async write() { throw new Error("Penyimpanan token terenkripsi belum disetujui dan belum dikonfigurasi."); },
  async remove() { throw new Error("Penyimpanan token belum dikonfigurasi."); },
};
