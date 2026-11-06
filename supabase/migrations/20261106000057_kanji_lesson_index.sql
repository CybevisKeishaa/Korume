-- port-kanji task 5: transcript lines that contain a kanji, and the lessons that use it most.
-- Latest transcript per video only; SECURITY INVOKER so transcript RLS decides which lessons the caller sees.
-- ponytail: seq scan; add a pg_trgm index when transcript_lines grows past ~100k

create function kanji_lesson_lines(p_literal text, p_limit int, p_offset int)
  returns table (line_id uuid, video_id uuid, lesson_title text, text_jp text, translation text, start_time numeric)
  language sql stable security invoker set search_path = public
as $$
  select l.id, v.id, v.title, l.text_jp, l.text_translation, l.start_time
  from latest_transcript_ids((select array_agg(id) from videos)) lt
  join videos v on v.id = lt.video_id
  join transcript_lines l on l.transcript_id = lt.transcript_id
  where l.text_jp like '%' || p_literal || '%'
  order by v.title, l.start_time, l.id
  limit p_limit offset p_offset;
$$;

create function kanji_lesson_counts(p_literal text, p_limit int)
  returns table (video_id uuid, lesson_title text, occurrences int)
  language sql stable security invoker set search_path = public
as $$
  select v.id, v.title, count(*)::int
  from latest_transcript_ids((select array_agg(id) from videos)) lt
  join videos v on v.id = lt.video_id
  join transcript_lines l on l.transcript_id = lt.transcript_id
  where l.text_jp like '%' || p_literal || '%'
  group by v.id, v.title
  order by count(*) desc, v.title
  limit p_limit;
$$;

revoke all on function kanji_lesson_lines(text, int, int) from public, anon;
revoke all on function kanji_lesson_counts(text, int) from public, anon;
grant execute on function kanji_lesson_lines(text, int, int) to authenticated;
grant execute on function kanji_lesson_counts(text, int) to authenticated;
