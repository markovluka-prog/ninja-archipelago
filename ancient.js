// ancient.js — переводчик Древнего языка (Кристофер Паолини, «Эрагон»). Порт из Magician/perevodchik.py: словарь заклинательных слов + канонические правила морфологии.
// Главное свойство то же, что у оригинала: переводчик не выдумывает. Нет слова в каноне — говорит «нет слова» и оставляет пропуск.
// Слова с пометкой ○ придуманы автором игры (заимствования, не Паолини) — их мало, они нужны для чисел и пары понятий.

const VOWELS = 'aeiouyáéíóúäëïöü';
const isV = c => VOWELS.includes(c.toLowerCase());
const CANON_PL = { nam: 'namar', 'celöbra': 'celöbreya', 'älfr': 'älfar', 'ástar': 'ástarya', daert: 'daertya' };
const CANON_ADJ = { beor: 'beur', brisingr: 'brisungr', 'celöbra': 'celubra', skul: 'skúl' };

export function plural(w) {                                  // множественное: согласная +ar, r после согласной → ar, r после гласной +ya, гласная → ya
  if (CANON_PL[w]) return CANON_PL[w];
  if (w.endsWith('r')) return w.length > 1 && isV(w[w.length - 2]) ? w + 'ya' : w.slice(0, -1) + 'ar';
  if (isV(w[w.length - 1])) return w.slice(0, -1) + 'ya';
  return w + 'ar';
}
export function past(w) {                                    // прошедшее: i/í → o, r → +o, á → aí, иначе +í
  const l = w[w.length - 1];
  if (l === 'i' || l === 'í') return w.slice(0, -1) + 'o';
  if (l === 'r') return w + 'o';
  if (l === 'á') return w.slice(0, -1) + 'aí';
  return w + 'í';
}
export function adjective(w) {                               // прилагательное: гласная внутри слова сдвигается в u
  if (CANON_ADJ[w]) return CANON_ADJ[w];
  const idx = [...w].map((c, i) => isV(c) ? i : -1).filter(i => i >= 0); if (!idx.length) return null;
  const t = idx.length <= 2 || w.endsWith('r') ? idx[idx.length - 1] : idx[idx.length - 2], c = w[t];
  return w.slice(0, t) + (c === 'u' ? 'ú' : 'u') + w.slice(t + 1);
}

// [древнее слово, по-русски, основы русских слов через пробел, часть речи, смысл для заклинаний (fx) или модификатор, ○ — придумано]
// fx: fire water wind ice bolt light stone heal shield lev dispel;  mod: big small strong bright;  num: 2
const L = [
  // огонь
  ['brisingr', 'огонь', 'огн огон пламен поджиг зажг жар', 'n', 'fire'], ['istalrí', 'пламя', 'пламя пламе', 'n', 'fire'], ['eldrvarí', 'гореть', 'гори горет сжиг', 'v', 'fire'], ['verma', 'жар', 'жар тепл', 'n', 'fire'],
  // вода
  ['adurna', 'вода', 'вод ливн струя', 'n', 'water'], ['thringa', 'дождь', 'дожд', 'n', 'water'], ['vaer', 'море', 'мор волн', 'n', 'water'], ['akr', 'влажный', 'влажн мокр', 'adj', 'water'],
  // воздух, лёд, молния
  ['vindr', 'ветер, воздух', 'ветр ветер воздух вихр порыв', 'n', 'wind'], ['svell', 'лёд', 'лёд лед льд ледян мороз холод', 'n', 'ice'], ['kveykva', 'молния', 'молни гром', 'n', 'bolt'],
  // свет и тьма
  ['garjzla', 'свет', 'свет огонёк шар', 'n', 'light'], ['naina', 'освещать', 'освети озари', 'v', 'light'], ['ignasia', 'сиять', 'сия свети', 'v', 'light'], ['solus', 'солнце', 'солнц', 'n', 'light'], ['bjartr', 'яркий', 'ярк', 'adj', 'bright'],
  // земля и камень
  ['stenr', 'камень', 'камн камен стен', 'n', 'stone'], ['hamarr', 'утёс', 'утёс утес скал', 'n', 'stone'], ['deloi', 'земля', 'земл почв', 'n', 'stone'], ['herdtha', 'укреплять', 'укрепи затверд', 'v', 'stone'], ['fell', 'гора', 'гор', 'n', 'stone'],
  // жизнь, защита, полёт, рассеять
  ['heill', 'исцелять', 'исцел лечи вылеч здоров', 'v', 'heal'], ['líf', 'жизнь', 'жизн', 'n', 'heal'], ['vardi', 'защищать', 'защит оберег', 'v', 'shield'], ['skölir', 'щит', 'щит', 'n', 'shield'], ['sköliro', 'защищённый', 'защищённ', 'adj', 'shield'],
  ['flauga', 'летать', 'лета лети летай парить', 'v', 'lev'], ['reisa', 'поднимать', 'подним подне вознес', 'v', 'lev'], ['rïsa', 'подниматься', 'взлет взлёт вознес', 'v', 'lev'], ['audr', 'вверх', 'вверх', 'prep', 'lev'], ['haedh', 'высота', 'высот', 'n', 'lev'],
  ['vaetna', 'рассеивать', 'рассей развей', 'v', 'dispel'], ['thurra', 'сушить', 'суши высуш', 'v', 'dispel'],
  // свойства
  ['galba', 'большой', 'больш огромн', 'adj', 'big'], ['litil', 'малый', 'мал небольш крошечн', 'adj', 'small'], ['ramr', 'сильный', 'сильн мощн', 'adj', 'strong'], ['hvass', 'острый', 'остр', 'adj', 'strong'],
  ['tvei', 'два', 'два две', 'num', 'num2', true],
  // для общения (в заклинаниях не работают, но переводчик их знает)
  ['skulblaka', 'дракон', 'дракон', 'n', ''], ['sverd', 'меч', 'меч', 'n', ''], ['blädr', 'клинок', 'клинок', 'n', ''], ['blödh', 'кровь', 'кров', 'n', ''], ['hjarta', 'сердце', 'сердц', 'n', ''], ['hugr', 'разум', 'разум', 'n', ''],
  ['lotha', 'небо', 'неб', 'n', ''], ['dwerva', 'ночь', 'ноч', 'n', ''], ['dag', 'день', 'ден', 'n', ''], ['sundavr', 'тень', 'тен', 'n', ''], ['datia', 'туманы', 'туман', 'n', ''], ['stjarna', 'звезда', 'звезд', 'n', ''], ['tungl', 'луна', 'лун', 'n', '', true],
  ['traevam', 'дерево', 'дерев', 'n', ''], ['welden', 'лес', 'лес', 'n', ''], ['ekar', 'дуб', 'дуб', 'n', ''], ['lauf', 'лист', 'лист', 'n', ''], ['fricai', 'друг', 'друг', 'n', ''], ['fjandí', 'враг', 'враг', 'n', ''], ['vinr', 'спутник', 'спутн', 'n', ''],
  ['könungr', 'король', 'корол', 'n', ''], ['dröttning', 'королева', 'королев', 'n', ''], ['älfa', 'эльф', 'эльф', 'n', ''], ['dvergr', 'гном', 'гном', 'n', ''], ['ástar', 'любовь', 'любов', 'n', ''], ['ilumëo', 'истина', 'истин', 'n', ''],
  ['wyrda', 'судьба', 'судьб', 'n', ''], ['galdr', 'заклинание', 'заклин', 'n', ''], ['vanyalí', 'магия', 'маги', 'n', ''], ['nam', 'имя', 'имя им', 'n', ''], ['eka', 'я', 'я', 'pron', ''], ['ono', 'ты', 'ты', 'pron', ''], ['vae', 'мы', 'мы', 'pron', ''],
  ['un', 'и', 'и', 'fn', 'and'], ['du', 'определённый артикль', '', 'fn', ''], ['medh', 'с', 'с', 'prep', ''], ['laust', 'без', 'без', 'prep', ''], ['thorta', 'говорить', 'говор', 'v', ''], ['kenna', 'знать', 'зна', 'v', ''],
  ['vergarí', 'убивать', 'убив', 'v', ''], ['verrunsmal', 'сражаться', 'сража', 'v', ''], ['kvetha', 'приветствую', 'привет', 'v', ''], ['ládrin', 'открывать', 'откр', 'v', ''], ['letta', 'остановить', 'останов', 'v', ''],
];
export const LEX = L.map(([a, ru, st, pos, fx, inv]) => ({ a, ru, stems: st.split(' ').filter(Boolean), pos, fx: fx || '', inv: !!inv }));
const FORMS = new Map();                                      // словоформа → {w, form}
for (const w of LEX) {
  const put = (f, form) => { if (f && !FORMS.has(f)) FORMS.set(f, { w, form }); };
  put(w.a, 'base');
  if (w.pos === 'n') put(plural(w.a), 'pl');
  if (w.pos === 'v') put(past(w.a), 'past');
  if (w.pos === 'n' || w.pos === 'adj') put(adjective(w.a), 'adj');
}
const norm = s => s.toLowerCase().replace(/ё/g, 'е');
const RU_STEMS = LEX.flatMap(w => w.stems.map(s => ({ w, s: norm(s) }))).sort((x, y) => y.s.length - x.s.length);

export function tokenize(text) { return (text || '').toLowerCase().split(/[\s,.;:!?()«»"“”—–-]+/).filter(Boolean); }

// одно слово → {w, form, via:'ancient'|'ru', count?} или null
export function resolve(tok) {
  const t = tok.toLowerCase();
  const f = FORMS.get(t); if (f) return { ...f, via: 'ancient', tok };
  const n = norm(t);
  for (const { w, s } of RU_STEMS) if (n === s || (s.length >= 3 && n.startsWith(s))) return { w, form: /^(огни|камни|стрелы|молнии|шары)$/.test(n) ? 'pl' : 'base', via: 'ru', tok };
  return null;
}
const MOD_RU = { три: 3, трое: 3, много: 3, несколько: 3 };

// разбор фразы заклинания. Результат: { ok, tokens, fx:[...], size, count, bright, past, ancient, ru, note }
export function parseSpell(text) {
  const toks = tokenize(text), out = []; let count = 1, size = 1, bright = 0, wasPast = false;
  for (const t of toks) {
    if (MOD_RU[t]) { count = Math.max(count, MOD_RU[t]); out.push({ tok: t, w: null, count: MOD_RU[t], via: 'ru' }); continue; }
    const r = resolve(t); out.push(r || { tok: t, w: null, unknown: true });
  }
  const fx = [];
  for (const r of out) {
    if (!r || !r.w) continue;
    const k = r.w.fx;
    if (k === 'big') size *= 1.5; else if (k === 'small') size *= 0.6; else if (k === 'strong') size *= 1.3; else if (k === 'bright') bright++;
    else if (k === 'num2') count = Math.max(count, 2);
    else if (k && k !== 'and') { if (r.w.pos === 'v' && r.form === 'past') wasPast = true; else if (!fx.includes(k)) fx.push(k); }
    if (r.form === 'pl' && r.w.pos === 'n' && k && k !== 'and') count = Math.max(count, 3);
  }
  const ancient = out.map(r => r.w ? (r.form === 'pl' ? plural(r.w.a) : r.form === 'adj' && r.via === 'ru' ? adjective(r.w.a) : r.via === 'ancient' ? r.tok : r.w.a) : r.unknown ? '[' + r.tok + '?]' : r.tok).join(' ');
  const ancientD = ancient.split(' ').filter((w, i, a) => w !== a[i - 1]).join(' ');
  const ru = out.map(r => r.w ? r.w.ru.split(',')[0] + (r.form === 'pl' ? ' (мн.)' : r.form === 'past' ? ' (прош.)' : r.form === 'adj' ? ' (прил.)' : '') : r.unknown ? '[нет слова: ' + r.tok + ']' : r.tok).join(' · ');
  const unknown = out.filter(r => r && r.unknown).map(r => r.tok);
  return { ok: fx.length > 0 && !wasPast, tokens: out, fx, size: Math.min(2.4, size), count: Math.min(4, count), bright, past: wasPast, ancient: ancientD, ru, unknown };
}

// переводчик «туда и обратно» для окна заклинаний: русский → древний и древний → русский, неизвестное оставляет пропуском
export function translate(text) {
  const toks = tokenize(text); if (!toks.length) return '';
  return toks.map(t => { const r = resolve(t); if (!r) return `[${t}?]`; return r.via === 'ru' ? (r.form === 'pl' ? plural(r.w.a) : r.w.a) + (r.w.inv ? '○' : '') : r.w.ru.split(',')[0]; }).join(' ');
}
// слова для книги заклинаний (только те, что делают магию)
export const SPELL_WORDS = LEX.filter(w => w.fx && !['and', 'num2'].includes(w.fx));
