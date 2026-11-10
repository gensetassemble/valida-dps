-- A new HRGA case is an actual start of work, recorded once as processing.
-- Existing histories are not rewritten. Accept old clients' unprocessed input
-- during rollout, normalize it before the first event/notification is emitted.
alter table public.personnel_renewal_cases alter column status set default 'processing';
do $migration$
declare definition text; old_rule text := $old$if new.status<>'unprocessed' then raise exception 'Proses dimulai dari Belum Diproses.';end if;$old$;
begin
 definition := pg_get_functiondef('private.guard_personnel_renewal()'::regprocedure);
 if position(old_rule in definition)=0 then raise exception 'Renewal guard changed; review before applying';end if;
 execute replace(definition,old_rule,$new$if new.status not in ('unprocessed','processing') then raise exception 'Proses dimulai dari Sedang Diproses.';end if;
  new.status:='processing';$new$);
end $migration$;
