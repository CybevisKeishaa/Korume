-- Original N5 + early-N4 study content (CLAUDE.md §3 — no verbatim copying).
-- Readings/stroke counts/JLPT levels are facts; meanings and mnemonics are
-- original. Idempotent (ON CONFLICT / NOT EXISTS) so it is safe on re-run and
-- reaches cloud via `supabase db push`. Bulk authoring later via the admin CMS.

-- Natural-key uniqueness so the ON CONFLICT clauses below are real (the base
-- tables key on a random UUID; without these, re-running would duplicate rows).
alter table vocab add constraint vocab_word_reading_key unique (word, reading);
alter table grammar_points add constraint grammar_points_title_key unique (title);

-- ---------------------------------------------------------------------------
-- Kanji
-- ---------------------------------------------------------------------------
insert into kanji (character, jlpt_level, stroke_count, meaning_en, meaning_vi, mnemonic_text) values
  ('日','N5',4,'sun / day','mặt trời / ngày','A window with the sun framed inside — one square, one day.'),
  ('月','N5',4,'moon / month','mặt trăng / tháng','A crescent leaning in the night sky; count them to count months.'),
  ('火','N5',4,'fire','lửa','A central spark throwing off two flanking flames.'),
  ('水','N5',4,'water','nước','A stream with droplets flung to either side.'),
  ('木','N5',4,'tree / wood','cây / gỗ','A trunk with branches up and roots spreading down.'),
  ('金','N5',8,'gold / money','vàng / tiền','A roof over two nuggets buried in the earth.'),
  ('土','N5',3,'earth / soil','đất','A cross planted in the ground — a mound of soil.'),
  ('一','N5',1,'one','một','A single horizontal stroke: one.'),
  ('二','N5',2,'two','hai','Two stacked strokes: two.'),
  ('三','N5',3,'three','ba','Three stacked strokes: three.'),
  ('四','N5',5,'four','bốn','A box with legs inside — four walls.'),
  ('五','N5',4,'five','năm','A shape twisting between the lines of one and ten.'),
  ('六','N5',4,'six','sáu','A little hat on two legs.'),
  ('七','N5',2,'seven','bảy','A cross that hooks like a stylised 7.'),
  ('八','N5',2,'eight','tám','Two strokes spreading apart, opening outward.'),
  ('九','N5',2,'nine','chín','A hook curling back — almost the full ten.'),
  ('十','N5',2,'ten','mười','A perfect plus sign: ten.'),
  ('百','N5',6,'hundred','trăm','One (一) stacked on top of white (白): a round hundred.'),
  ('千','N5',3,'thousand','nghìn','A slash over ten — many tens make a thousand.'),
  ('円','N5',4,'yen / circle','yên / tròn','A rounded frame — currency drawn as a circle.'),
  ('人','N5',2,'person','người','Two legs mid-stride: a walking person.'),
  ('大','N5',3,'big','to / lớn','A person stretching arms as wide as they can.'),
  ('小','N5',3,'small','nhỏ','A tiny centre pinched by two small marks.'),
  ('中','N5',4,'middle / inside','giữa / trong','A line pierced straight through the centre.'),
  ('上','N5',3,'up / above','trên','A mark sitting on top of the baseline.'),
  ('下','N5',3,'down / below','dưới','A mark hanging under the baseline.'),
  ('山','N5',3,'mountain','núi','Three peaks rising from the ground.'),
  ('川','N5',3,'river','sông','Three lines of flowing water.'),
  ('田','N5',5,'rice field','ruộng','A plot divided into four paddies.'),
  ('目','N5',5,'eye','mắt','A box with the lines of an eyelid inside.'),
  ('口','N5',3,'mouth','miệng','An open square: a mouth.'),
  ('手','N5',4,'hand','tay','A wrist with fingers branching off.'),
  ('足','N5',7,'foot / leg','chân','A knee over a foot, ready to step.'),
  ('男','N5',7,'man / male','đàn ông','Power (力) worked in the rice field (田).'),
  ('女','N5',3,'woman / female','phụ nữ','A figure seated with crossed arms.'),
  ('子','N5',3,'child','con / trẻ','A swaddled infant with outstretched arms.'),
  ('学','N5',8,'study / learning','học','A child under a roof, gathering knowledge.'),
  ('生','N5',5,'life / birth','sinh / sống','A sprout pushing up through the soil.'),
  ('先','N5',6,'previous / ahead','trước','A foot stepping out in front — going first.'),
  ('名','N4',6,'name','tên','In the evening (夕) you call a mouth (口) by its name.'),
  ('会','N4',6,'meeting / to meet','gặp / họp','People gathering under one roof to meet.'),
  ('社','N4',7,'company / shrine','công ty','An altar beside the earth — a place people belong to.'),
  ('時','N4',10,'time / hour','giờ / thời gian','The sun (日) marking the temple bell — the hour.'),
  ('語','N4',14,'language / word','ngôn ngữ / từ','Words (言) counted five (五) mouths (口) at a time.'),
  ('電','N4',13,'electricity','điện','Rain (雨) with a bolt streaking through it.')
on conflict (character) do nothing;

-- Kanji readings (on = katakana, kun = hiragana). Most common one or two each.
insert into kanji_readings (kanji_id, reading, reading_type)
select k.id, r.reading, r.rt::reading_type
from (values
  ('日','ニチ','on'),('日','ひ','kun'),
  ('月','ゲツ','on'),('月','つき','kun'),
  ('火','カ','on'),('火','ひ','kun'),
  ('水','スイ','on'),('水','みず','kun'),
  ('木','モク','on'),('木','き','kun'),
  ('金','キン','on'),('金','かね','kun'),
  ('土','ド','on'),('土','つち','kun'),
  ('一','イチ','on'),('一','ひと','kun'),
  ('二','ニ','on'),('二','ふた','kun'),
  ('三','サン','on'),('三','みっ','kun'),
  ('四','シ','on'),('四','よん','kun'),
  ('五','ゴ','on'),('五','いつ','kun'),
  ('六','ロク','on'),('六','むっ','kun'),
  ('七','シチ','on'),('七','なな','kun'),
  ('八','ハチ','on'),('八','やっ','kun'),
  ('九','キュウ','on'),('九','ここの','kun'),
  ('十','ジュウ','on'),('十','とお','kun'),
  ('百','ヒャク','on'),
  ('千','セン','on'),('千','ち','kun'),
  ('円','エン','on'),('円','まる','kun'),
  ('人','ジン','on'),('人','ひと','kun'),
  ('大','ダイ','on'),('大','おお','kun'),
  ('小','ショウ','on'),('小','ちい','kun'),
  ('中','チュウ','on'),('中','なか','kun'),
  ('上','ジョウ','on'),('上','うえ','kun'),
  ('下','カ','on'),('下','した','kun'),
  ('山','サン','on'),('山','やま','kun'),
  ('川','セン','on'),('川','かわ','kun'),
  ('田','デン','on'),('田','た','kun'),
  ('目','モク','on'),('目','め','kun'),
  ('口','コウ','on'),('口','くち','kun'),
  ('手','シュ','on'),('手','て','kun'),
  ('足','ソク','on'),('足','あし','kun'),
  ('男','ダン','on'),('男','おとこ','kun'),
  ('女','ジョ','on'),('女','おんな','kun'),
  ('子','シ','on'),('子','こ','kun'),
  ('学','ガク','on'),('学','まな','kun'),
  ('生','セイ','on'),('生','い','kun'),
  ('先','セン','on'),('先','さき','kun'),
  ('名','メイ','on'),('名','な','kun'),
  ('会','カイ','on'),('会','あ','kun'),
  ('社','シャ','on'),('社','やしろ','kun'),
  ('時','ジ','on'),('時','とき','kun'),
  ('語','ゴ','on'),('語','かた','kun'),
  ('電','デン','on')
) as r(ch, reading, rt)
join kanji k on k.character = r.ch
where not exists (
  select 1 from kanji_readings kr where kr.kanji_id = k.id and kr.reading = r.reading
);

-- ---------------------------------------------------------------------------
-- Vocabulary
-- ---------------------------------------------------------------------------
insert into vocab (word, reading, meaning_en, meaning_vi, jlpt_level, part_of_speech) values
  ('私','わたし','I / me','tôi','N5','pronoun'),
  ('人','ひと','person','người','N5','noun'),
  ('水','みず','water','nước','N5','noun'),
  ('火','ひ','fire','lửa','N5','noun'),
  ('日','ひ','day / sun','ngày','N5','noun'),
  ('月','つき','moon','mặt trăng','N5','noun'),
  ('山','やま','mountain','núi','N5','noun'),
  ('川','かわ','river','sông','N5','noun'),
  ('木','き','tree','cây','N5','noun'),
  ('本','ほん','book','sách','N5','noun'),
  ('車','くるま','car','xe','N5','noun'),
  ('学校','がっこう','school','trường học','N5','noun'),
  ('先生','せんせい','teacher','giáo viên','N5','noun'),
  ('学生','がくせい','student','học sinh','N5','noun'),
  ('友達','ともだち','friend','bạn','N5','noun'),
  ('家','いえ','house / home','nhà','N5','noun'),
  ('手','て','hand','tay','N5','noun'),
  ('目','め','eye','mắt','N5','noun'),
  ('口','くち','mouth','miệng','N5','noun'),
  ('名前','なまえ','name','tên','N5','noun'),
  ('食べる','たべる','to eat','ăn','N5','verb (ichidan)'),
  ('飲む','のむ','to drink','uống','N5','verb (godan)'),
  ('見る','みる','to see / watch','xem / nhìn','N5','verb (ichidan)'),
  ('聞く','きく','to listen / ask','nghe / hỏi','N5','verb (godan)'),
  ('話す','はなす','to speak','nói','N5','verb (godan)'),
  ('読む','よむ','to read','đọc','N5','verb (godan)'),
  ('書く','かく','to write','viết','N5','verb (godan)'),
  ('行く','いく','to go','đi','N5','verb (godan)'),
  ('来る','くる','to come','đến','N5','verb (irregular)'),
  ('する','する','to do','làm','N5','verb (irregular)'),
  ('買う','かう','to buy','mua','N5','verb (godan)'),
  ('大きい','おおきい','big','to / lớn','N5','i-adjective'),
  ('小さい','ちいさい','small','nhỏ','N5','i-adjective'),
  ('新しい','あたらしい','new','mới','N5','i-adjective'),
  ('古い','ふるい','old (thing)','cũ','N5','i-adjective'),
  ('良い','いい','good','tốt','N5','i-adjective'),
  ('悪い','わるい','bad','xấu','N5','i-adjective'),
  ('暑い','あつい','hot (weather)','nóng','N5','i-adjective'),
  ('寒い','さむい','cold (weather)','lạnh','N5','i-adjective'),
  ('高い','たかい','tall / expensive','cao / đắt','N5','i-adjective'),
  ('安い','やすい','cheap','rẻ','N5','i-adjective'),
  ('元気','げんき','healthy / energetic','khỏe','N5','na-adjective'),
  ('静か','しずか','quiet','yên tĩnh','N5','na-adjective'),
  ('綺麗','きれい','pretty / clean','đẹp / sạch','N5','na-adjective'),
  ('好き','すき','liked / favourite','thích','N5','na-adjective'),
  ('今日','きょう','today','hôm nay','N5','noun'),
  ('明日','あした','tomorrow','ngày mai','N5','noun'),
  ('昨日','きのう','yesterday','hôm qua','N5','noun'),
  ('朝','あさ','morning','buổi sáng','N5','noun'),
  ('夜','よる','night','buổi tối','N5','noun'),
  ('時間','じかん','time / hour','thời gian','N5','noun'),
  ('お金','おかね','money','tiền','N5','noun'),
  ('電車','でんしゃ','train','tàu điện','N5','noun'),
  ('会社','かいしゃ','company','công ty','N5','noun'),
  ('仕事','しごと','work / job','công việc','N5','noun'),
  ('説明','せつめい','explanation','giải thích','N4','noun (suru-verb)'),
  ('経験','けいけん','experience','kinh nghiệm','N4','noun (suru-verb)'),
  ('準備','じゅんび','preparation','chuẩn bị','N4','noun (suru-verb)'),
  ('案内','あんない','guidance / showing around','hướng dẫn','N4','noun (suru-verb)'),
  ('約束','やくそく','promise','lời hứa','N4','noun (suru-verb)')
on conflict (word, reading) do nothing;

-- ---------------------------------------------------------------------------
-- Grammar points
-- ---------------------------------------------------------------------------
insert into grammar_points (title, jlpt_level, structure_pattern, explanation, example_sentences) values
  ('は (topic marker)','N5','〔Noun〕は 〔comment〕',
   'Marks the topic — what the sentence is about. Contrasts with the subject marker が, which introduces new or emphasised information.',
   '[{"jp":"わたしは がくせいです。","en":"As for me, I am a student."}]'::jsonb),
  ('が (subject marker)','N5','〔Noun〕が 〔predicate〕',
   'Marks the grammatical subject, often new information or the answer to "who/what?". Used with existence verbs あります/います.',
   '[{"jp":"ねこが います。","en":"There is a cat."}]'::jsonb),
  ('を (object marker)','N5','〔Noun〕を 〔transitive verb〕',
   'Marks the direct object — the thing the action is done to.',
   '[{"jp":"みずを のみます。","en":"I drink water."}]'::jsonb),
  ('に (time / destination)','N5','〔time / place〕に',
   'Points to a specific time, or the destination/target of movement.',
   '[{"jp":"がっこうに いきます。","en":"I go to school."}]'::jsonb),
  ('で (place / means)','N5','〔place / means〕で 〔action〕',
   'Marks where an action happens, or the means/tool used to do it.',
   '[{"jp":"でんしゃで いきます。","en":"I go by train."}]'::jsonb),
  ('の (linking / possessive)','N5','〔Noun1〕の 〔Noun2〕',
   'Links two nouns: possession, or Noun1 describing Noun2.',
   '[{"jp":"わたしの ほん","en":"my book"}]'::jsonb),
  ('〜ます (polite non-past)','N5','〔verb stem〕ます',
   'The polite form of a verb for present or future actions. Negative is 〜ません.',
   '[{"jp":"まいにち べんきょうします。","en":"I study every day."}]'::jsonb),
  ('〜たい (want to)','N5','〔verb stem〕たい',
   'Expresses the speaker''s desire to do something. Conjugates like an i-adjective (〜たくない, 〜たかった).',
   '[{"jp":"すしを たべたいです。","en":"I want to eat sushi."}]'::jsonb),
  ('〜てください (please do)','N5','〔verb て-form〕ください',
   'A polite request or instruction to do something.',
   '[{"jp":"ここに なまえを かいてください。","en":"Please write your name here."}]'::jsonb),
  ('〜なければならない (must)','N4','〔verb ない-stem〕なければならない',
   'Expresses obligation — something that must be done. Casual/spoken forms include 〜なきゃ and 〜ないといけない.',
   '[{"jp":"あした はやく おきなければならない。","en":"I have to get up early tomorrow."}]'::jsonb)
on conflict (title) do nothing;

-- ---------------------------------------------------------------------------
-- Badges (gamification config — needed in every environment)
-- ---------------------------------------------------------------------------
insert into badges (name, description, criteria) values
  ('first_steps','Completed your first study session.','{"type":"sessions","count":1}'::jsonb),
  ('week_streak','Studied 7 days in a row.','{"type":"streak","days":7}'::jsonb),
  ('hundred_kanji','Learned 100 kanji.','{"type":"kanji_learned","count":100}'::jsonb)
on conflict (name) do nothing;
