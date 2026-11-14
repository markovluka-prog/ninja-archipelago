// ancient.js — Древний язык (Паолини) целиком: словарь (words.js, ~800 слов с метками достоверности), грамматика и разбор заклинания.
// Магия в «Эрагоне» — не список заклинаний: слово называет действие или вещь, а мир подчиняется смыслу слова. Поэтому здесь нет таблицы «слово → эффект»:
// разбор даёт ПРЕДЛОЖЕНИЕ (глагол, объект, определения, предлоги, время, отрицание), а magic.js превращает его в физику (какие предметы, сколько энергии).
//   Порядок слов свободный (Stenr reisa! = Reisa stenr!), определение стоит ПОСЛЕ существительного (stenr galba — большой камень).
//   Прошедшее время (+í / +o) — «уже случилось», ничего не происходит. Будущее (weohnata + глагол) — отложенное заклинание (ловушка).
//   Néiat + глагол — запрет. Множественное: +ar / +ya. Прилагательное из существительного: u-сдвиг (brisingr → brisungr). Притяжательное: +s.
import { DICT } from './words.js';

const VOWELS = 'aeiouyáéíóúäëïöü';
const isV = c => VOWELS.includes(c.toLowerCase());
export function plural(w) {
  const CANON = { nam: 'namar', 'celöbra': 'celöbreya', 'älfr': 'älfar', 'ástar': 'ástarya', daert: 'daertya' }; if (CANON[w]) return CANON[w];
  if (w.endsWith('r')) return w.length > 1 && isV(w[w.length - 2]) ? w + 'ya' : w.slice(0, -1) + 'ar';
  if (isV(w[w.length - 1])) return w.slice(0, -1) + 'ya';
  return w + 'ar';
}
export function past(w) {
  const l = w[w.length - 1];
  if (l === 'i' || l === 'í') return w.slice(0, -1) + 'o';
  if (l === 'r') return w + 'o';
  if (l === 'á') return w.slice(0, -1) + 'aí';
  return w + 'í';
}
export function adjective(w) {
  const CANON = { beor: 'beur', brisingr: 'brisungr', 'celöbra': 'celubra', skul: 'skúl' }; if (CANON[w]) return CANON[w];
  const idx = [...w].map((c, i) => isV(c) ? i : -1).filter(i => i >= 0); if (!idx.length) return null;
  const t = idx.length <= 2 || w.endsWith('r') ? idx[idx.length - 1] : idx[idx.length - 2], c = w[t];
  return w.slice(0, t) + (c === 'u' ? 'ú' : 'u') + w.slice(t + 1);
}
export const possessive = w => w.endsWith('í') ? w.slice(0, -1) + 'is' : w + 's';

/* ───── смысл слов для магии (то, что слово ЗНАЧИТ в физическом мире) ───── */
// глаголы → действие
export const VERB = {
  reisa: 'lift', 'rïsa': 'lift', flauga: 'fly', flautja: 'fly', thrysta: 'push', thrautha: 'throw', kodthr: 'hold', 'thrífa': 'hold', 'thrífask': 'hold', huildr: 'hold', losna: 'release', letta: 'stop', 'blöthr': 'stop',
  gath: 'gather', taka: 'pull', kausta: 'pull', aurboda: 'banish', vaetna: 'scatter', jierda: 'break', kverst: 'cut', kremja: 'crush', 'eldrvarí': 'ignite', thurra: 'dry', herdtha: 'harden', tuatha: 'harden',
  heill: 'heal', 'lífa': 'heal', vardi: 'ward', varda: 'ward', naina: 'light', ignasia: 'light', slytha: 'sleep', vakna: 'wake', malthinae: 'bind', taelda: 'bind', dvelja: 'slow',
  'vergarí': 'kill', deyja: 'kill', andask: 'kill', 'aldanarí': 'create', fortha: 'manifest', moi: 'change', sjon: 'inspect', sja: 'inspect', kenna: 'inspect', hlaupa: 'sprint', eitha: 'sprint', 'gánga': 'sprint',
  frethya: 'conceal', 'ládrin': 'open', laesa: 'lock', blanda: 'gather', brakka: 'shrink', 'gëuloth': 'warp', thverr: 'sprint',
  eldhrimner: 'grow', orpin: 'warp', 'kvetha': 'greet', 'astorí': 'greet', elrun: 'greet', gala: 'greet', 'hórna': 'listen', finna: 'find', blunda: 'sleep', drukna: 'drown', stydja: 'heal', sitja: 'stop', skaga: 'push', tauthr: 'pull', threyja: 'pull',
  standa: 'stop', falla: 'release', 'stíga': 'lift', 'snúa': 'warp', fara: 'sprint', sigla: 'sprint', svimma: 'sprint', 'klífa': 'sprint', hoppa: 'sprint', draga: 'pull', 'ýta': 'push', bera: 'hold', fylgja: 'pull', 'flýja': 'banish', kasta: 'throw', skera: 'cut', bindra: 'bind',
  spurja: 'greet', svara: 'greet', huga: 'inspect', skilja: 'inspect', laera: 'inspect', lesa: 'inspect', liduena: 'inspect', kalla: 'pull', hvísla: 'greet', 'hrópa': 'greet', hlaeja: 'greet', 'gráta': 'greet', brosa: 'greet', muna: 'inspect', gleyma: 'sleep', 'trúa': 'greet', efa: 'inspect',
  skynja: 'listen', thefa: 'find', smakka: 'inspect', snerta: 'inspect', 'förna': 'greet', 'ásta': 'greet', eta: 'heal', drekka: 'heal', hjalpa: 'heal', vinna: 'inspect', leika: 'greet', byggja: 'build', kaupa: 'greet', selja: 'greet', 'bída': 'stop', skapa: 'create', gera: 'manifest', grafa: 'push', saa: 'grow', uppskera: 'cut', elda: 'ignite',
  'thvá': 'drown', klaedha: 'conceal', laekna: 'heal', berjast: 'ward', verja: 'ward', sigra: 'greet', tapa: 'banish', byrja: 'manifest', enda: 'stop', reyna: 'inspect', velja: 'inspect', bidhja: 'greet', thakka: 'greet', firgefa: 'greet', lofa: 'greet', banna: 'stop', 'óttast': 'banish', vona: 'greet', thurfa: 'inspect', vilja: 'pull', muga: 'inspect', algara: 'inspect', bidja: 'greet', bita: 'cut', silbena: 'greet', skuta: 'greet', vanta: 'inspect', 'elthrimórno': 'greet', flutningr: 'hold',
  thorta: 'greet', bregdha: 'push', 'otherúm': 'greet',
  thelduin: 'bind', theyna: 'bind', verda: 'change', verrunsmal: 'ward', 'äftaka': 'pull', 'hávr': 'hold', ach: 'manifest', 'ethgrí': 'pull', thaefathan: 'harden', blinkna: 'conceal',
};
// существительные → вид: elem (стихия), mat (материал), item (вещь), flora, struct (постройка), wea (погода), part (часть тела), creature, abs
export const NOUN = {
  brisingr: ['elem', 'fire'], 'istalrí': ['elem', 'fire'], verma: ['elem', 'fire'], adurna: ['elem', 'water'], vaer: ['elem', 'water'], thringa: ['wea', 'rain'], vindr: ['elem', 'wind'], svell: ['elem', 'ice'], kveykva: ['elem', 'bolt'],
  garjzla: ['elem', 'light'], solus: ['elem', 'light'], aiedail: ['elem', 'light'], 'evarína': ['elem', 'light'], stjarna: ['elem', 'light'], sundavr: ['elem', 'shadow'], dwerva: ['elem', 'shadow'], datia: ['elem', 'mist'], 'hrúthr': ['mat', 'ice'],
  stenr: ['mat', 'stone'], hamarr: ['mat', 'stone'], deloi: ['mat', 'soil'], malmr: ['mat', 'metal'], 'stál': ['mat', 'metal'], arget: ['mat', 'silver'], kuldr: ['mat', 'gold'], lethr: ['mat', 'cloth'], nagz: ['mat', 'cloth'], skyrta: ['mat', 'cloth'],
  ekar: ['flora', 'tree'], traevam: ['flora', 'tree'], thindr: ['flora', 'tree'], welden: ['flora', 'tree'], 'fëon': ['flora', 'plant'], niernen: ['flora', 'plant'], thin: ['flora', 'plant'],
  'kvïstr': ['item', 'stick'], keppr: ['item', 'stick'], 'vöndr': ['item', 'stick'], lauf: ['item', 'leaf'], sverd: ['item', 'sword'], 'blädr': ['item', 'sword'], 'knífr': ['item', 'knife'], oro: ['item', 'arrow'], daert: ['item', 'spear'],
  'skölir': ['item', 'shield'], skal: ['item', 'bowl'], hald: ['item', 'apple'], karst: ['item', 'chest'], hernskja: ['item', 'armor'], fethr: ['item', 'feather'], 'böllr': ['item', 'stone'],
  hurdh: ['struct', 'door'], 'ília': ['struct', 'house'], hjall: ['struct', 'house'], breoal: ['struct', 'house'], grind: ['struct', 'house'], dras: ['struct', 'house'],
  auga: ['part', 'eye'], eyra: ['part', 'ear'], lam: ['part', 'hand'], 'gedwëy': ['part', 'hand'], hjarta: ['part', 'heart'], hugr: ['part', 'mind'], vaupna: ['part', 'arm'], bak: ['part', 'back'], hrygr: ['part', 'back'], vaengr: ['part', 'wing'],
  skul: ['part', 'scale'], 'blödh': ['part', 'blood'], 'kalfí': ['part', 'leg'], brun: ['part', 'eye'],
  lotha: ['sky', 'sky'], tungl: ['elem', 'light'], dag: ['elem', 'light'],
};
// определения → изменение параметров заклинания
export const ADJ = {
  galba: { size: 1.5 }, litil: { size: 0.6 }, boetk: { size: 1.25 }, 'äenora': { size: 1.25 }, ramr: { pow: 1.4 }, hvass: { pow: 1.2, sharp: 1 }, 'drjugr': { dur: 2 }, 'vëoht': { slow: 1 }, maela: { quiet: 1 },
  bjartr: { bright: 1 }, bleikr: { bright: 1 }, hvitr: { bright: 1 }, raudhr: { heat: 1.3 }, svartr: { dark: 1 }, akr: { wet: 1 }, rakr: { wet: 1 }, vrangr: { homing: 1 }, 'edoc\'sil': { pow: 1.6 }, 'sköliro': { pow: 1.3 }, lunaea: {}, 'dauthleikr': { lethal: 1 },
};
// слова-намерения: когда в фразе нет глагола, существительное само задаёт действие («Líf!» — жизнь = исцели)
export const INTENT = { 'líf': 'heal', hjarta: 'heal', verkr: 'bane', harmr: 'bane', 'baní': 'bane', grathr: 'bane', 'mïnen': 'bane', 'dauthí': 'kill', 'andlát': 'kill', freohr: 'kill', ilian: 'greet', 'ástar': 'greet', "mor'ranr": 'bind', fyrn: 'ward', 'hügin': 'inspect', manin: 'inspect', nam: 'inspect', 'kópa': 'inspect', draumr: 'sleep', dreyma: 'conceal', galdr: 'manifest', 'ilumëo': 'inspect', wyrda: 'inspect' };
export const PREP = { audr: 'up', undir: 'down', fram: 'fwd', aptr: 'back', 'arúnd': 'over', eom: 'to', fra: 'from', medh: 'with', oth: 'with', laust: 'without', vel: 'upon', unin: 'in', 'äthr': 'on', abr: 'of', 'framvír': 'before' };
export const PRON = { edtha: 'self', thornessa: 'this', 'thäet': 'it', thorna: 'those', eka: 'self', ietdar: 'self', ono: 'you', therr: 'they', vae: 'we', thar: 'there', allr: 'all' };
// числа (○ — придуманы курсом: в каноне чисел нет)
const NUMS = { ein: 1, tvei: 2, 'thrír': 3, 'fjórr': 4, fimr: 5, ses: 6, sjau: 7, 'átta': 8, 'níu': 9, 'tíu': 10 };
const RU_NUMS = { один: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10 };
// русские основы для самых ходовых слов магии (общий поиск по переводу словаря их не поймает: «огня», «камня», «лети»)
const ALIAS = {
  brisingr: 'огн огон пламен поджиг поджг зажг зажиг', 'eldrvarí': 'сожг гори горет жги', adurna: 'вод ливн струя', thringa: 'дожд ливень', vindr: 'ветр ветер вихр порыв воздух', svell: 'лёд лед льд ледян мороз', kveykva: 'молни гром',
  garjzla: 'свет озар освети', stenr: 'камн камен булыж', hamarr: 'утес скал', deloi: 'земл почв', malmr: 'метал', 'stál': 'стал', kuldr: 'золот', arget: 'серебр', ekar: 'дуб', traevam: 'дерев', 'kvïstr': 'ветк ветв', keppr: 'палк палка', hald: 'яблок',
  sverd: 'меч', 'knífr': 'нож', oro: 'стрел', daert: 'копь дротик', 'skölir': 'щит', skal: 'чаш', karst: 'ларец сундук', fethr: 'пер', lauf: 'лист',
  reisa: 'подн возн', 'rïsa': 'взлет взлёт', flauga: 'лет лета лети парить', thrysta: 'толкн толка толк', thrautha: 'брос кин швыр', kodthr: 'лови', 'thrífa': 'хват', huildr: 'держи держ', losna: 'отпуст освобод', letta: 'стой стоп останов прекрат', gath: 'соедин', taka: 'возьм бери', kausta: 'приди прихо', aurboda: 'изгон прочь',
  vaetna: 'рассей развей', jierda: 'ломай слом разруш', kverst: 'режь рез руби', kremja: 'сожм сжим дави', thurra: 'суши высуш', herdtha: 'закал укреп', heill: 'исцел лечи вылеч здоров', vardi: 'защит оберег', slytha: 'усни спи спать', vakna: 'проснис разбуд',
  malthinae: 'свяж связ', 'vergarí': 'убей убив убий', 'aldanarí': 'твор созд', moi: 'измени преврат', sjon: 'смотр вижу осмотр', hlaupa: 'беги бежать', fortha: 'яви', naina: 'освети', ignasia: 'сия', 'ládrin': 'откро откр', laesa: 'запри', frethya: 'скрой', dvelja: 'медли',
  galba: 'больш огромн', litil: 'мал небольш', ramr: 'сильн мощн', hvass: 'остр', 'drjugr': 'стойк', bjartr: 'ярк', raudhr: 'красн', svartr: 'чёрн черн', akr: 'мокр влажн', vrangr: 'блужда', un: 'и', 'néiat': 'не нельзя', weohnata: 'будет буду',
  thornessa: 'эт эту', eka: 'я себя', ono: 'ты тебя', 'älfa': 'эльф', dvergr: 'гном', kona: 'женщин', madhr: 'мужчин человек', fricai: 'друг', 'fjandí': 'враг', 'skulblaka': 'дракон', hjarta: 'сердц', lam: 'рук кист ладон', auga: 'глаз', 'blödh': 'кров',
};

/* ───── словарь ───── */
export const ENTRIES = DICT.map(([a, ru, mark, pos, theme]) => ({ a, ru, mark, pos, theme }));
const norm = s => s.toLowerCase().replace(/ё/g, 'е');
const FORMS = new Map();      // словоформа → [{e, form}]
const put = (f, e, form) => { if (!f) return; const k = f.toLowerCase(); if (!FORMS.has(k)) FORMS.set(k, []); const l = FORMS.get(k); if (!l.some(x => x.e === e && x.form === form)) l.push({ e, form }); };
for (const e of ENTRIES) put(e.a, e, 'base');
for (const e of ENTRIES) {
  if (e.pos === 'n' || e.pos === 'm') { const pl = plural(e.a), ad = adjective(e.a); if (!FORMS.has(pl.toLowerCase())) put(pl, e, 'pl'); if (ad && !FORMS.has(ad.toLowerCase())) put(ad, e, 'adj'); const ps = possessive(e.a); if (!FORMS.has(ps.toLowerCase())) put(ps, e, 'poss'); }
  if (e.pos === 'v' || (e.pos === 'm' && VERB[e.a])) { const ps = past(e.a); if (!FORMS.has(ps.toLowerCase())) put(ps, e, 'past'); }
}
const BYA = new Map(); for (const e of ENTRIES) if (!BYA.has(e.a)) BYA.set(e.a, []); for (const e of ENTRIES) BYA.get(e.a).push(e);
const stem = w => { w = norm(w); return w.length > 5 ? w.slice(0, 5) : w; };
const RUX = new Map();        // основа русского слова → [{e, rank}]
function rux(k, e, rank) { if (k.length < 3) return; if (!RUX.has(k)) RUX.set(k, []); RUX.get(k).push({ e, rank }); }
for (const e of ENTRIES) {
  const ws = norm(e.ru).replace(/\([^)]*\)/g, ' ').split(/[^а-я]+/).filter(w => w.length >= 3);
  ws.forEach((w, i) => rux(stem(w), e, i + e.mark * 2 + (e.pos === 'm' ? -1 : 0) + (e.a.length > 9 ? 1 : 0)));
}
const ALIAS_LIST = Object.entries(ALIAS).flatMap(([a, st]) => st.split(' ').map(s => [norm(s), a])).sort((x, y) => y[0].length - x[0].length);

// слово → {e, form, via, tok}; предпочитает смысл, известный магии
function bestEntry(list) {
  return list.slice().sort((x, y) => (VERB[y.e.a] || NOUN[y.e.a] ? 1 : 0) - (VERB[x.e.a] || NOUN[x.e.a] ? 1 : 0) || x.e.mark - y.e.mark)[0];
}
export function resolve(tok) {
  const t = tok.toLowerCase(), f = FORMS.get(t); if (f) { const b = bestEntry(f); return { e: b.e, form: b.form, via: 'ancient', tok }; }
  const n = norm(t);
  if (RU_NUMS[n]) { const e = ENTRIES.find(x => x.a === ['', 'ein', 'tvei', 'thrír', 'fjórr', 'fimr', 'ses', 'sjau', 'átta', 'níu', 'tíu'][RU_NUMS[n]]); if (e) return { e, form: 'base', via: 'ru', tok }; }
  for (const [s, a] of ALIAS_LIST) if (n === s || (s.length >= 3 && n.startsWith(s))) { const e = (BYA.get(a) || []).sort((x, y) => (VERB[y.a] || NOUN[y.a] ? 1 : 0) - (VERB[x.a] || NOUN[x.a] ? 1 : 0))[0]; if (e) return { e, form: /^(камни|огни|стрелы|мечи|яблоки)$/.test(n) ? 'pl' : 'base', via: 'ru', tok }; }
  const l = RUX.get(stem(n)); if (l) { const b = l.slice().sort((x, y) => x.rank - y.rank)[0]; return { e: b.e, form: 'base', via: 'ru', tok }; }
  return null;
}
export const tokenize = text => (text || '').toLowerCase().split(/[\s,.;:!?()«»"“”—–]+/).filter(Boolean);

/* ───── разбор заклинания ───── */
// роли: V глагол, N существительное, A определение, P предлог, Q число, R местоимение, NEG отрицание, FUT будущее, AND союз, X слово без физического смысла
export function parse(text) {
  const toks = tokenize(text).map(t => {
    const r = resolve(t); if (!r) return { tok: t, role: '?', unknown: true };
    const a = r.e.a; let role = 'X';
    if (a === 'néiat' || a === 'né') role = 'NEG'; else if (a === 'weohnata') role = 'FUT'; else if (a === 'un') role = 'AND';
    else if (NUMS[a] || NUMS[a] === 0) role = 'Q'; else if (PRON[a]) role = 'R';
    else if (VERB[a] && !(r.form === 'adj' || r.form === 'pl' || r.form === 'poss')) role = 'V';
    else if (r.form === 'adj' && NOUN[a]) role = 'A';
    else if (NOUN[a] || (r.e.pos === 'n' && (r.e.theme === 'ppl' || r.e.theme === 'ani' || r.e.theme === 'bod' || r.e.theme === 'thg'))) role = 'N';
    else if (ADJ[a]) role = 'A'; else if (PREP[a]) role = 'P'; else if (a === 'du' || a === 'aí' || a === 'atra' || a === 'sé') role = 'ART';
    return { ...r, role, a, sem: NOUN[a], num: NUMS[a], pastForm: r.form === 'past' };
  });
  const out = { toks, unknown: toks.filter(t => t.unknown).map(t => t.tok), tense: 'pres', neg: false, clauses: [], mods: { size: 1, pow: 1, dur: 1, heat: 1, bright: 0, wet: 0, slow: 0, homing: 0, dark: 0, lethal: 0, sharp: 0 }, count: 1, marks: [], trap: false };
  if (!toks.length) return out;
  for (const t of toks) { if (t.e) out.marks.push(t.e.mark); if (t.role === 'A' && ADJ[t.a]) for (const [k, v] of Object.entries(ADJ[t.a])) { if (k === 'size' || k === 'pow' || k === 'dur' || k === 'heat') out.mods[k] *= v; else out.mods[k] += v; } if (t.role === 'NEG') out.neg = true; if (t.role === 'FUT') out.trap = true; if (t.pastForm && t.role === 'V') out.tense = 'past'; if (t.role === 'Q') out.count = Math.max(out.count, t.num); if (t.form === 'pl' && t.role === 'N') out.count = Math.max(out.count, 3); }
  // предложения: каждый глагол берёт группу существительного рядом (после него — по-русски, до него — как «Stenr reisa»)
  const isNP = t => t && ['N', 'A', 'Q', 'R', 'AND'].includes(t.role);
  const used = new Array(toks.length).fill(false);
  const takeNP = (from, dir) => {      // собрать группу существительного, идя от from в сторону dir; вернуть токены
    const g = []; let i = from; while (i >= 0 && i < toks.length && isNP(toks[i]) && !used[i]) { g.push(i); i += dir; }
    while (g.length && toks[g[g.length - 1]].role === 'AND') g.pop();
    return dir < 0 ? g.reverse() : g;
  };
  if (!toks.some(t => t.role === 'V')) { const it = toks.find(t => INTENT[t.a] && t.role !== 'NEG' && t.role !== 'FUT'); if (it) { it.role = 'V'; it.intent = INTENT[it.a]; } }      // «Líf» без глагола — само слово действует
  const vs = toks.map((t, i) => t.role === 'V' ? i : -1).filter(i => i >= 0);
  for (const vi of vs) {
    const cl = { verb: toks[vi].a, act: toks[vi].intent || VERB[toks[vi].a], vtok: toks[vi], np: [], preps: [] };
    used[vi] = true;
    let g = takeNP(vi + 1, 1); if (!g.length) g = takeNP(vi - 1, -1);
    for (const i of g) used[i] = true; cl.np = g.map(i => toks[i]);
    // предлоги: P + группа
    for (let j = vi + 1; j < toks.length; j++) { if (toks[j].role === 'P' && !used[j]) { used[j] = true; const pg = takeNP(j + 1, 1); for (const i of pg) used[i] = true; cl.preps.push({ p: PREP[toks[j].a], np: pg.map(i => toks[i]) }); } }
    out.clauses.push(cl);
  }
  const rest = toks.map((t, i) => !used[i] && isNP(t) && t.role !== 'AND' ? i : -1).filter(i => i >= 0);
  if (rest.length && rest.every(i => toks[i].role === 'R')) { const empty = out.clauses.find(c => !c.np.length); if (empty) { empty.np = rest.map(i => toks[i]); rest.length = 0; } }      // «Eka waíse heill» — «я исцелён»
  if (rest.length) { const g = rest.map(i => toks[i]); out.clauses.push({ verb: null, vtok: null, np: g, preps: [] }); }      // голые существительные: «Brisingr!»
  for (const t of toks) if (t.role === 'P' && !used[toks.indexOf(t)] && out.clauses[0]) out.clauses[0].preps.push({ p: PREP[t.a], np: [] });
  return out;
}

// запись фразы на древнем и словарь-перевод слово в слово (для окна заклинаний)
export function render(p) {
  const anc = p.toks.map(t => t.unknown ? `[${t.tok}?]` : t.via === 'ru' ? (t.form === 'pl' ? plural(t.e.a) : t.e.a) : t.tok).filter((w, i, a) => w !== a[i - 1]).join(' ');
  const gl = p.toks.map(t => t.unknown ? `[нет слова: ${t.tok}]` : `${t.e.ru.split(/[;,(]/)[0].trim()}${t.form === 'pl' ? ' (мн.)' : t.form === 'past' ? ' (прош.)' : t.form === 'adj' ? ' (прил.)' : ''}${t.e.mark === 3 ? ' ○' : t.e.mark === 1 ? ' ?' : ''}`).join(' · ');
  return { ancient: anc, gloss: gl };
}
// переводчик «туда и обратно»: русский → древний, древний → русский; неизвестное — пропуск, ничего не выдумывает
export function translate(text) {
  return tokenize(text).map(t => { const r = resolve(t); if (!r) return `[${t}?]`; return r.via === 'ru' ? (r.form === 'pl' ? plural(r.e.a) : r.e.a) + (r.e.mark === 3 ? '○' : '') : r.e.ru.split(/[;,(]/)[0].trim(); }).join(' ');
}
export const MARK = ['◆ канон', '◆? под вопросом', '✦ производное', '○ не канон'];
export const WORDBOOK = ENTRIES.filter((e, i) => ENTRIES.findIndex(x => x.a === e.a && x.ru === e.ru) === i);
