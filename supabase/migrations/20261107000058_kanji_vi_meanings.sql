-- port-kanji K16: the Vietnamese meaning of each kanji (hvdic "Từ điển phổ thông" glosses, owner-reviewed overrides first),
-- resolved at import time like vi_readings / tc_lines (053).
alter table dict_kanji add column vi_meanings text[] not null default '{}';
