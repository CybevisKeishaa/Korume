\set ON_ERROR_STOP on
begin;

-- Every FK to users is named here. `n` rows deliberately survive: community
-- attribution, anonymised metering, and videos handled by erase_account_rows.
create temporary table erasure_fk_allowlist (relation regclass, column_name text, action "char", primary key (relation, column_name)) on commit drop;
create temporary table erasure_subject (id uuid primary key) on commit drop;
insert into erasure_fk_allowlist values
  ('public.user_stats','user_id','c'), ('public.user_kanji_progress','user_id','c'), ('public.user_vocab_progress','user_id','c'),
  ('public.user_grammar_progress','user_id','c'), ('public.user_video_progress','user_id','c'), ('public.user_playlists','user_id','c'),
  ('public.shadowing_sessions','user_id','c'), ('public.dictation_attempts','user_id','c'), ('public.conversation_sessions','user_id','c'),
  ('public.user_test_attempts','user_id','c'), ('public.user_badges','user_id','c'), ('public.subscriptions','user_id','c'),
  ('public.sentence_mining_cards','user_id','c'), ('public.user_reading_attempts','user_id','c'), ('public.xp_events','user_id','c'),
  ('public.learning_outcomes','user_id','c'),
  ('public.study_sessions','user_id','c'),
  ('public.daily_missions','user_id','c'),
  ('public.notifications','user_id','c'), ('public.peer_review_shares','user_id','c'), ('public.peer_reviews','reviewer_id','c'),
  ('public.companion_memories','user_id','c'), ('public.user_lesson_library','user_id','c'), ('public.account_deletion_requests','user_id','c'),
  ('public.lesson_creation_jobs','requester_user_id','c'), ('public.user_preferences','user_id','c'), ('public.user_saved_collections','user_id','c'),
  ('public.sentence_marks','user_id','c'), ('public.user_lesson_bookmarks','user_id','c'), ('public.ai_usage_charges','user_id','c'),
  ('public.sentence_notes','user_id','c'), ('public.lesson_notes','user_id','c'), ('public.lesson_reflections','user_id','c'),
  ('public.videos','added_by_user_id','n'), -- erased-user PRIVATE lessons are removed by the function
  ('public.forum_posts','user_id','n'), -- community content survives anonymised
  ('public.forum_comments','user_id','n'), -- community content survives anonymised
  ('public.ai_reservations','requested_by_user_id','n'), -- anonymised metering survives
  ('public.ai_generations','requested_by_user_id','n'); -- anonymised metering survives

do $$
declare catalog_count int; allow_count int; bad text;
begin
  select count(*) into catalog_count
  from pg_constraint c cross join lateral unnest(c.conkey) as k(attnum)
  where c.contype = 'f' and c.confrelid = 'public.users'::regclass;
  select count(*) into allow_count from erasure_fk_allowlist;
  if catalog_count = 0 then raise exception 'FK policy: catalog has no public.users foreign keys'; end if;
  if catalog_count <> allow_count then raise exception 'FK policy: catalog count % differs from allowlist count %', catalog_count, allow_count; end if;
  select format('%s.%s', c.conrelid::regclass, a.attname) into bad
  from pg_constraint c cross join lateral unnest(c.conkey) as k(attnum)
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
  left join erasure_fk_allowlist x on x.relation=c.conrelid and x.column_name=a.attname and x.action=c.confdeltype
  where c.contype='f' and c.confrelid='public.users'::regclass and x.relation is null limit 1;
  if bad is not null then raise exception 'FK policy: missing or wrong allowlist entry for %', bad; end if;
  select format('%s.%s', x.relation, x.column_name) into bad from erasure_fk_allowlist x
  left join pg_constraint c on c.conrelid=x.relation and c.contype='f' and c.confrelid='public.users'::regclass and c.confdeltype=x.action
  left join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) and a.attname=x.column_name
  where a.attname is null limit 1;
  if bad is not null then raise exception 'FK policy: stale allowlist entry for %', bad; end if;
end $$;

-- Every uuid column except `id` must be an FK or be exempted here, so a new
-- user key cannot hide behind a name (an FK alone is section 1's subject).
create temporary table erasure_unlinked_uuid (relation regclass, column_name text, primary key (relation, column_name)) on commit drop;
insert into erasure_unlinked_uuid values
  ('public.account_deletion_tombstones','user_id'), -- must outlive the users row it names
  ('public.ai_generations','turn_id'), ('public.ai_reservations','turn_id'), ('public.conversation_messages','turn_id'), -- turn correlation ids
  ('public.knowledge_entries','lease_token'), ('public.lesson_creation_jobs','lease_token'), ('public.lesson_reflections','lease_token'); -- lease tokens
insert into erasure_unlinked_uuid values ('public.study_sessions','client_presence_id'); -- client-minted tab id, not a user key; the row cascades on user_id

do $$
declare bad text; found int;
begin
  create temporary table erasure_unlinked_catalog on commit drop as
  select t.oid::regclass relation, a.attname::text column_name
  from pg_class t join pg_namespace n on n.oid=t.relnamespace join pg_attribute a on a.attrelid=t.oid
  where n.nspname='public' and t.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
    and a.atttypid='uuid'::regtype and a.attname<>'id'
    and not exists (select 1 from pg_constraint c where c.contype='f' and c.conrelid=t.oid and a.attnum=any(c.conkey));
  select count(*) into found from erasure_unlinked_catalog;
  if found = 0 then raise exception 'unlinked uuid: catalog read found nothing (expected the tombstone at least)'; end if;
  select format('%s.%s', c.relation, c.column_name) into bad from erasure_unlinked_catalog c
    left join erasure_unlinked_uuid x using (relation, column_name) where x.relation is null limit 1;
  if bad is not null then raise exception 'unlinked uuid column (add an FK or an exemption): %', bad; end if;
  select format('%s.%s', x.relation, x.column_name) into bad from erasure_unlinked_uuid x
    left join erasure_unlinked_catalog c using (relation, column_name) where c.relation is null limit 1;
  if bad is not null then raise exception 'unlinked uuid: stale exemption %', bad; end if;
end $$;

do $$ begin
  if has_function_privilege('anon', 'public.erase_account_rows(uuid)', 'execute') then raise exception 'function privileges: anon can execute'; end if;
  if has_function_privilege('authenticated', 'public.erase_account_rows(uuid)', 'execute') then raise exception 'function privileges: authenticated can execute'; end if;
  if not has_function_privilege('service_role', 'public.erase_account_rows(uuid)', 'execute') then raise exception 'function privileges: service_role cannot execute'; end if;
  if (select prosecdef from pg_proc where oid = 'public.erase_account_rows(uuid)'::regprocedure) then raise exception 'function privileges: erase_account_rows must not be security definer'; end if;
end $$;

do $$
declare unexpected text;
begin
  select c.conrelid::regclass::text into unexpected
  from pg_constraint c
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and c.confrelid = 'auth.users'::regclass
    and c.conrelid <> 'public.users'::regclass
  limit 1;
  if unexpected is not null then raise exception 'auth.users references: unexpected public FK from %', unexpected; end if;
  if not exists (select 1 from pg_constraint c where c.contype='f' and c.conrelid='public.users'::regclass and c.confrelid='auth.users'::regclass) then
    raise exception 'auth.users references: public.users(id) FK missing';
  end if;
end $$;

delete from auth.users where email in ('erasuregate-a@example.invalid','erasuregate-b@example.invalid');
delete from public.videos where youtube_video_id like 'ERASUREGATE%';
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','erasuregate-a@example.invalid',crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}'),
 (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','erasuregate-b@example.invalid',crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}');

do $$
declare a uuid; b uuid; v1 uuid; v2 uuid; v3 uuid; v4 uuid; tr uuid; line uuid; post uuid; reserve uuid; knowledge uuid; coll uuid; r record; n bigint;
begin
 select id into a from public.users where email='erasuregate-a@example.invalid'; select id into b from public.users where email='erasuregate-b@example.invalid';
 insert into erasure_subject values (a);
 insert into public.videos(youtube_video_id,title,added_by_user_id,library_access) values ('ERASUREGATEV1','exclusive',a,'PRIVATE') returning id into v1;
 insert into public.transcripts(video_id,source,language) values(v1,'youtube_caption','ja') returning id into tr;
 insert into public.transcript_lines(transcript_id,start_time,end_time,text_jp) values(tr,0,1,'消える') returning id into line;
 insert into public.sentence_notes(user_id,transcript_line_id,body) values(a,line,'note'); insert into public.lesson_notes(user_id,video_id,body) values(a,v1,'note');
 insert into public.user_lesson_library(user_id,lesson_id) values(a,v1);
 insert into public.videos(youtube_video_id,title,added_by_user_id,library_access) values ('ERASUREGATEV2','free',a,'FREE') returning id into v2;
 insert into public.transcripts(video_id,source,language) values(v2,'youtube_caption','ja');
 insert into public.videos(youtube_video_id,title,added_by_user_id,library_access) values ('ERASUREGATEV3','b-private',b,'PRIVATE') returning id into v3; insert into public.user_lesson_library(user_id,lesson_id) values(b,v3);
 insert into public.videos(youtube_video_id,title,added_by_user_id,library_access) values ('ERASUREGATEV4','shared',a,'PRIVATE') returning id into v4; insert into public.user_lesson_library(user_id,lesson_id) values(a,v4),(b,v4); insert into public.lesson_notes(user_id,video_id,body) values(b,v4,'b note');
 insert into public.forum_posts(user_id,title,content) values(a,'keep','keep') returning id into post;
 insert into public.ai_reservations(requested_by_user_id,billing_scope,entitlement_kind,fingerprint,reserved_usd,expires_at,period_day,period_month) values(a,'learner','free_sentence','erasure-reservation',0,now()+interval '1 day',current_date,date_trunc('month',current_date)::date) returning id into reserve;
 insert into public.ai_generations(requested_by_user_id,billing_scope,section,provider,model,outcome) values(a,'learner','test','test','test','success');
 insert into public.user_preferences(user_id) values(a); insert into public.sentence_marks(user_id,transcript_line_id,kind) values(a,line,'bookmark'); insert into public.user_lesson_bookmarks(user_id,video_id) values(a,v2);
 insert into public.conversation_sessions(user_id) values(a) returning id into tr; insert into public.conversation_messages(session_id,role,content) values(tr,'user','erase'); insert into public.shadowing_sessions(user_id,video_id,transcript_line_id) values(a,v2,line);
 insert into public.forum_comments(post_id,user_id,content) values(post,a,'keep');
 insert into public.collections(slug,title,kind) values('erasuregate-shelf','Erasure gate shelf','shelf') returning id into coll;
 insert into public.user_saved_collections(user_id,collection_id) values(a,coll);
 insert into public.lesson_reflections(user_id,video_id,locale,analysis_fingerprint,evidence_fingerprint,schema_version,generator_version,status)
   values(a,v2,'vi','erasure-analysis','erasure-evidence',1,1,'pending');
 insert into public.lesson_creation_jobs(requester_user_id,origin,requested_library_access,youtube_video_id) values(a,'learner','PRIVATE','ERASUREGT01');
 insert into public.ai_usage_charges(user_id,entitlement_kind,fingerprint,reservation_id,period_day,period_month)
   values(a,'free_sentence','erasure-reservation',reserve,current_date,date_trunc('month',current_date)::date);
 -- Shared lesson analysis: no user key, must outlive any account.
 insert into public.knowledge_entries(fingerprint,section,locale,schema_version,generator_version,content_variant,status)
   values('erasure-knowledge','summary','vi',1,1,'full','pending') returning id into knowledge;

 -- Positive control: every seeded user table really holds a row for A, so the
 -- post-erasure zero counts below cannot pass on an empty seed.
 for r in select * from (values
   ('public.sentence_notes','user_id'),('public.lesson_notes','user_id'),('public.user_lesson_library','user_id'),
   ('public.videos','added_by_user_id'),('public.forum_posts','user_id'),('public.forum_comments','user_id'),
   ('public.ai_reservations','requested_by_user_id'),('public.ai_generations','requested_by_user_id'),
   ('public.ai_usage_charges','user_id'),('public.user_preferences','user_id'),('public.sentence_marks','user_id'),
   ('public.user_lesson_bookmarks','user_id'),('public.conversation_sessions','user_id'),('public.shadowing_sessions','user_id'),
   ('public.user_saved_collections','user_id'),('public.lesson_reflections','user_id'),('public.lesson_creation_jobs','requester_user_id')
 ) s(relation, column_name) loop
   execute format('select count(*) from %s where %I = $1', r.relation, r.column_name) into n using a;
   if n = 0 then raise exception 'positive control: % has no seeded row for A', r.relation; end if;
 end loop;

 perform public.erase_account_rows(a);
 if exists(select 1 from public.videos where id=v1) or exists(select 1 from public.transcripts where video_id=v1)
   or exists(select 1 from public.transcript_lines where id=line) then raise exception 'V1/transcripts: exclusive PRIVATE lesson survived'; end if;
 if not exists(select 1 from public.knowledge_entries where id=knowledge) then raise exception 'knowledge_entries: shared analysis was erased'; end if;
 if not exists(select 1 from public.forum_comments where post_id=post and user_id is null) then raise exception 'forum_comments: anonymised row missing'; end if;
 if not exists(select 1 from public.videos where id=v2 and added_by_user_id is null) then raise exception 'V2: free lesson did not survive anonymised'; end if;
 if not exists(select 1 from public.videos where id=v3) or not exists(select 1 from public.user_lesson_library where user_id=b and lesson_id=v3) then raise exception 'V3: B private lesson changed'; end if;
 if not exists(select 1 from public.videos where id=v4 and added_by_user_id is null) or not exists(select 1 from public.lesson_notes where user_id=b and video_id=v4) then raise exception 'V4: shared PRIVATE lesson changed'; end if;
 if not exists(select 1 from public.forum_posts where id=post and user_id is null) then raise exception 'forum_posts: anonymised row missing'; end if;
 if not exists(select 1 from public.ai_reservations where id=reserve and requested_by_user_id is null) then raise exception 'ai_reservations: anonymised row missing'; end if;
 if not exists(select 1 from public.users where id=b) then raise exception 'users: B missing'; end if;
end $$;

do $$
declare r record; n bigint;
begin
 for r in select c.conrelid::regclass relation, a.attname column_name from pg_constraint c cross join lateral unnest(c.conkey) k(attnum) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum where c.contype='f' and c.confrelid='public.users'::regclass loop
   execute format('select count(*) from %s where %I = (select id from erasure_subject)', r.relation, r.column_name) into n;
   if n <> 0 then raise exception 'cascade: %.% retains erased user rows', r.relation, r.column_name; end if;
 end loop;
end $$;
rollback;
