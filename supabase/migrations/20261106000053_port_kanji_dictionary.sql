-- port-kanji: Han-Viet readings (KANJIDIC2 r_type="vietnam") and Thieu Chuu lines (filled by a later import).
alter table dict_kanji
  add column vi_readings text[] not null default '{}',
  add column tc_lines text[] not null default '{}';
