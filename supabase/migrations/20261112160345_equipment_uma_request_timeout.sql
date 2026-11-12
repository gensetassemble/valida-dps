-- Applies to this RLS-protected RPC only, not other requests or database roles.
alter function public.sync_equipment_uma(text,text,text,jsonb) set statement_timeout='45s';
alter function public.sync_equipment_uma(text,text,text,jsonb) set lock_timeout='5s';
