-- Public RPCs keep caller privileges; privileged implementations stay outside the exposed API schema.
alter function public.stage_personnel_import(text,text,text,integer,jsonb,text) security invoker;
alter function public.review_personnel_import(uuid,jsonb,boolean,text) security invoker;
alter function public.approve_personnel_import_batch(uuid) security invoker;
alter function public.commit_personnel_certificate_import(uuid) security invoker;
grant execute on function private.stage_personnel_import(text,text,text,integer,jsonb,text),private.review_personnel_import(uuid,jsonb,boolean,text),private.approve_personnel_import_batch(uuid),private.commit_personnel_certificate_import(uuid) to authenticated;
