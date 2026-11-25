'use strict';
/* =====================================================================
   Rachadinha — app de divisão de contas para 2 pessoas
   - Login individual (e-mail e senha) via Supabase
   - Sem Supabase configurado: MODO DEMONSTRAÇÃO (tudo neste aparelho)
   - Tudo que mexe no dinheiro precisa da aprovação da outra pessoa
   ===================================================================== */
(() => {
const CFG = window.RACHADINHA_CONFIG || {};
const DEMO = !CFG.supabaseUrl || !CFG.supabaseAnonKey;
const SUPABASE_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js';

/* ---------- utilitários ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pctFmt = v => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const ym = d => String(d).slice(0, 7);
const addMonths = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const monthDiff = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
const monthName = m => { const [y, mo] = m.split('-').map(Number); return cap(new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })); };
const monthShort = m => { const [y, mo] = m.split('-').map(Number); return cap(new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')) + ' ' + String(y).slice(2); };
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const thisMonth = () => ym(todayStr());
const fmtDate = d => d ? d.split('-').reverse().join('/') : '';
const now = () => new Date().toISOString();
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const other = p => p === 'p1' ? 'p2' : 'p1';
const CATS = ['Moradia', 'Contas da casa', 'Mercado', 'Transporte', 'Saúde', 'Lazer', 'Pets', 'Outros'];

function toast(t, ms = 3200) { const el = $('toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), ms); }
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Não consegui carregar ' + src)); document.head.appendChild(s); }); }

/* =====================================================================
   BACKENDS
   ===================================================================== */
function DemoBackend() {
  const K = 'rachadinha-demo-v1', SK = K + ':session';
  const blank = () => ({ users: {}, households: {}, records: {} });
  const load = () => { try { return JSON.parse(localStorage.getItem(K)) || blank(); } catch { return blank(); } };
  let db = load();
  const save = () => { try { localStorage.setItem(K, JSON.stringify(db)); } catch { throw new Error('Sem espaço neste navegador.'); } };
  const pub = u => u && { id: u.id, email: u.email, name: u.name };
  let full = null;
  window.addEventListener('storage', e => { if (e.key === K) { db = load(); full && full(); } });
  const houseOf = uid => Object.entries(db.households).find(([, h]) => h.members.some(m => m.user_id === uid));
  return {
    demo: true,
    async getUser() { db = load(); const id = localStorage.getItem(SK); return pub(Object.values(db.users).find(u => u.id === id)); },
    onAuth() {},
    async signUp(email, pass, name) {
      email = email.trim().toLowerCase(); db = load();
      if (db.users[email]) throw new Error('Já existe uma conta com este e-mail.');
      const u = { id: 'u' + newId(), email, pass, name }; db.users[email] = u; save();
      localStorage.setItem(SK, u.id); return { needsConfirm: false };
    },
    async signIn(email, pass) {
      db = load(); const u = db.users[email.trim().toLowerCase()];
      if (!u || u.pass !== pass) throw new Error('E-mail ou senha incorretos.');
      localStorage.setItem(SK, u.id);
    },
    async signOut() { localStorage.removeItem(SK); },
    async resetPassword() { throw new Error('No modo demonstração nenhum e-mail é enviado.'); },
    async setPassword() {},
    async myHousehold(uid) {
      db = load(); const f = houseOf(uid); if (!f) return null;
      const [id, h] = f; return { id, name: h.name, code: h.code, members: h.members };
    },
    async createHousehold(uid, name, display) {
      db = load(); if (houseOf(uid)) throw new Error('Você já participa de uma casa.');
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      db.households['h' + newId()] = { name: name || 'Nossa casa', code, members: [{ user_id: uid, slot: 'p1', name: display }] }; save();
    },
    async joinHousehold(uid, code, display) {
      db = load(); if (houseOf(uid)) throw new Error('Você já participa de uma casa.');
      const f = Object.entries(db.households).find(([, h]) => h.code === code.trim().toUpperCase());
      if (!f) throw new Error('Código não encontrado. Confira as letras e números.');
      if (f[1].members.length >= 2) throw new Error('Esta casa já tem duas pessoas.');
      f[1].members.push({ user_id: uid, slot: 'p2', name: display }); save();
    },
    async updateMyName(hid, uid, name) {
      db = load(); const m = db.households[hid].members.find(x => x.user_id === uid); m.name = name;
      const u = Object.values(db.users).find(x => x.id === uid); if (u) u.name = name; save();
    },
    async loadRecords(hid) { db = load(); return structuredClone(db.records[hid] || {}); },
    subscribe(hid, h) { full = () => h.onFull(); return () => { full = null; }; },
    async put(hid, kind, id, obj) {
      db = load(); const r = db.records[hid] || (db.records[hid] = {}); const k = r[kind] || (r[kind] = {});
      if (obj) k[id] = obj; else delete k[id]; save();
    },
    async upload(hid, blob, type) {
      if (blob.size > 1.2e6) throw new Error('Arquivo grande demais para o modo demonstração.');
      const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      return { data, type };
    },
    async receiptUrl(rc) { return rc.data; },
    reset() { localStorage.removeItem(K); localStorage.removeItem(SK); }
  };
}

function SupaBackend() {
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const back = () => location.origin + location.pathname;
  const nm = u => (u.user_metadata && u.user_metadata.name) || u.email.split('@')[0];
  const tr = e => {
    const m = String(e && (e.message || e.error_description) || e || '');
    const map = [
      [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
      [/already registered|already exists/i, 'Já existe uma conta com este e-mail.'],
      [/email not confirmed/i, 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada e o spam).'],
      [/at least 6/i, 'A senha precisa ter pelo menos 6 caracteres.'],
      [/rate limit|too many/i, 'Muitas tentativas. Espere um pouco e tente de novo.'],
      [/invalid email|unable to validate email/i, 'E-mail inválido.'],
      [/failed to fetch|network/i, 'Sem conexão. Verifique a internet.']
    ];
    for (const [re, t] of map) if (re.test(m)) return new Error(t);
    return new Error(m || 'Algo deu errado.');
  };
  const chk = ({ data, error }) => { if (error) throw tr(error); return data; };
  return {
    demo: false,
    async getUser() { const { data } = await sb.auth.getSession(); const u = data.session && data.session.user; return u ? { id: u.id, email: u.email, name: nm(u) } : null; },
    onAuth(cb) { sb.auth.onAuthStateChange(ev => setTimeout(() => cb(ev), 0)); },
    async signUp(email, pass, name) { const d = chk(await sb.auth.signUp({ email: email.trim(), password: pass, options: { data: { name }, emailRedirectTo: back() } })); return { needsConfirm: !d.session }; },
    async signIn(email, pass) { chk(await sb.auth.signInWithPassword({ email: email.trim(), password: pass })); },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) { chk(await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: back() })); },
    async setPassword(p) { chk(await sb.auth.updateUser({ password: p })); },
    async myHousehold(uid) {
      const m = chk(await sb.from('members').select('household_id').eq('user_id', uid).maybeSingle());
      if (!m) return null;
      const hid = m.household_id;
      const [h, ms] = await Promise.all([
        sb.from('households').select('id,name,code').eq('id', hid).single().then(chk),
        sb.from('members').select('user_id,slot,name').eq('household_id', hid).then(chk)
      ]);
      return { id: hid, name: h.name, code: h.code, members: ms };
    },
    async createHousehold(uid, name, display) { chk(await sb.rpc('create_household', { p_name: name, p_display: display })); },
    async joinHousehold(uid, code, display) { chk(await sb.rpc('join_household', { p_code: code, p_display: display })); },
    async updateMyName(hid, uid, name) {
      chk(await sb.from('members').update({ name }).eq('household_id', hid).eq('user_id', uid));
      await sb.auth.updateUser({ data: { name } });
    },
    async loadRecords(hid) {
      const rows = chk(await sb.from('records').select('kind,id,data').eq('household_id', hid));
      const out = {}; for (const r of rows) (out[r.kind] || (out[r.kind] = {}))[r.id] = r.data; return out;
    },
    subscribe(hid, h) {
      const ch = sb.channel('casa-' + hid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: 'household_id=eq.' + hid }, p => {
          if (p.eventType === 'DELETE') { if (!p.old || (p.old.household_id && p.old.household_id !== hid)) return; h.onRow(p.old.kind, p.old.id, null); }
          else h.onRow(p.new.kind, p.new.id, p.new.data);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: 'household_id=eq.' + hid }, () => h.onMembers())
        .subscribe(st => { if (st === 'SUBSCRIBED') h.onFull(); });
      // ao voltar para o app (celular em segundo plano), recarrega tudo
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') h.onFull(); });
      return () => sb.removeChannel(ch);
    },
    async put(hid, kind, id, obj) {
      if (obj) chk(await sb.from('records').upsert({ household_id: hid, kind, id, data: obj, updated_at: now() }));
      else chk(await sb.from('records').delete().match({ household_id: hid, kind, id }));
    },
    async upload(hid, blob, type) {
      const ext = type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${hid}/${newId()}.${ext}`;
      chk(await sb.storage.from('comprovantes').upload(path, blob, { contentType: type }));
      return { path, type };
    },
    async receiptUrl(rc) { if (rc.data) return rc.data; return chk(await sb.storage.from('comprovantes').createSignedUrl(rc.path, 3600)).signedUrl; }
  };
}

/* =====================================================================
   ESTADO
   ===================================================================== */
let B = null;            // backend
let user = null;         // { id, email, name }
let house = null;        // { id, name, code, members[] }
let me = null;           // 'p1' | 'p2'
let unsub = null;
const DEF_SETTINGS = { p1: { income: 0 }, p2: { income: 0 }, mode: 'renda', manualPct1: 50 };
const S = { config: {}, expenses: {}, payments: {}, settles: {} };
let curMonth = thisMonth();


const cfg = () => S.config.main || { settings: DEF_SETTINGS };
const settings = () => Object.assign({}, DEF_SETTINGS, cfg().settings || {});
const member = p => house && house.members.find(m => m.slot === p);
const name = p => (member(p) && member(p).name) || (p === me ? 'Você' : (p === 'p1' ? 'Pessoa 1' : 'Pessoa 2'));
const bothIn = () => !!(house && house.members.length >= 2);
const payKey = (expId, month) => expId + '__' + month;
const pColor = p => p === 'p1' ? 'var(--p1)' : 'var(--p2)';

function pct1(s = settings()) {
  if (s.mode === 'manual') return Math.min(100, Math.max(0, Number(s.manualPct1) || 0)) / 100;
  const a = +(s.p1 && s.p1.income) || 0, b = +(s.p2 && s.p2.income) || 0;
  return a + b > 0 ? a / (a + b) : 0.5;
}
const shareP1 = split => ({ renda: pct1(), igual: 0.5, p1: 1, p2: 0 }[split] ?? pct1());
const splitTxt = sp => ({ renda: 'proporcional', igual: '50/50', p1: 'só ' + name('p1'), p2: 'só ' + name('p2') }[sp] || 'proporcional');
const typeTxt = e => e.type === 'mensal' ? 'mensal' : e.type === 'parcelada' ? `${e.installments}x` : 'única';

/* ---------- gravação ---------- */
const chains = {};
function put(kind, id, obj) {
  const clean = obj ? JSON.parse(JSON.stringify(obj)) : null;
  if (clean) S[kind][id] = clean; else delete S[kind][id];
  render();
  const key = kind + '/' + id, hid = house.id;
  chains[key] = (chains[key] || Promise.resolve()).then(() => B.put(hid, kind, id, clean)).catch(async e => {
    toast('Não consegui salvar: ' + e.message, 5000);
    await reloadRecords();
  });
}
async function reloadRecords() {
  if (!house) return;
  try {
    const r = await B.loadRecords(house.id);
    for (const k of ['config', 'expenses', 'payments', 'settles']) S[k] = r[k] || {};
    render();
  } catch (e) { toast(e.message); }
}

/* =====================================================================
   APROVAÇÕES (genérico)
   ===================================================================== */
function createRec(kind, id, data) { put(kind, id, { ...data, status: 'pendente', by: me, at: now() }); }
function requestEdit(kind, id, data) {
  const r = S[kind][id];
  if (!r) return createRec(kind, id, data);
  if (r.status === 'aprovada') put(kind, id, { ...r, change: { kind: 'editar', data, by: me, at: now() }, note: null });
  else put(kind, id, { ...r, ...data, status: 'pendente', by: me, at: now(), reason: null, rejectedBy: null });
}
function requestDelete(kind, id) {
  const r = S[kind][id]; if (!r) return;
  if (r.status !== 'aprovada') { put(kind, id, null); if (kind === 'expenses') dropPayments(id); }
  else put(kind, id, { ...r, change: { kind: 'excluir', by: me, at: now() }, note: null });
}
function dropPayments(expId) { for (const [k, p] of Object.entries(S.payments)) if (p.expId === expId) put('payments', k, null); }
function approve(kind, id) {
  const r = S[kind][id]; if (!r) return;
  if (kind === 'config') return put('config', id, { ...r, settings: r.change.data, change: null, note: null });
  if (r.change && r.change.kind === 'excluir') { put(kind, id, null); if (kind === 'expenses') dropPayments(id); }
  else if (r.change) put(kind, id, { ...r, ...r.change.data, change: null, approvedBy: me, approvedAt: now() });
  else put(kind, id, { ...r, status: 'aprovada', approvedBy: me, approvedAt: now(), reason: null });
}
function reject(kind, id, reason) {
  const r = S[kind][id]; if (!r) return;
  if (r.change) put(kind, id, { ...r, change: null, note: { to: r.change.by, by: me, reason, what: kind === 'config' ? 'alteração de renda' : r.change.kind === 'excluir' ? 'exclusão' : 'alteração', at: now() } });
  else put(kind, id, { ...r, status: 'recusada', rejectedBy: me, reason, at: now() });
}
function pendingItems() {
  const out = [];
  for (const kind of ['config', 'expenses', 'payments', 'settles']) for (const [id, r] of Object.entries(S[kind])) {
    if (r.change) out.push({ kind, id, r, type: r.change.kind, author: r.change.by, at: r.change.at });
    else if (r.status === 'pendente') out.push({ kind, id, r, type: 'novo', author: r.by, at: r.at });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function rejectedItems() {
  const out = [];
  const descOf = (kind, id, r) => kind === 'expenses' ? r.desc : kind === 'payments' ? ((S.expenses[r.expId] || {}).desc || '?') + ' · ' + monthShort(r.month) : kind === 'settles' ? monthName(id) : 'renda e divisão';
  for (const kind of ['config', 'expenses', 'payments', 'settles']) for (const [id, r] of Object.entries(S[kind])) {
    const label = { expenses: 'Despesa recusada', payments: 'Pagamento recusado', settles: 'Acerto recusado', config: '' }[kind];
    if (r.status === 'recusada') out.push({ kind, id, t: `${label}: ${descOf(kind, id, r)}`, by: r.rejectedBy, reason: r.reason, own: r.by === me, type: 'rec', at: r.at });
    if (r.note) out.push({ kind, id, t: `${cap(r.note.what)} recusada: ${descOf(kind, id, r)}`, by: r.note.by, reason: r.note.reason, own: r.note.to === me, type: 'note', at: r.note.at });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/* =====================================================================
   CÁLCULOS — só o que foi aprovado entra no dinheiro
   ===================================================================== */
function occurrences(month) {
  const out = [];
  for (const [id, e] of Object.entries(S.expenses)) {
    if (!e.date) continue;
    const diff = monthDiff(ym(e.date), month);
    if (diff < 0) continue;
    if (e.type === 'unica' && diff !== 0) continue;
    if (e.type === 'parcelada' && diff >= e.installments) continue;
    if (e.type === 'mensal' && e.endMonth && month >= e.endMonth) continue;
    const key = payKey(id, month);
    out.push({ id, e, month, key, pay: S.payments[key] || null, day: Number(e.date.slice(8, 10)),
      label: e.type === 'parcelada' ? `${diff + 1}/${e.installments}` : (e.type === 'mensal' ? 'mensal' : '') });
  }
  return out.sort((a, b) => a.day - b.day || String(a.e.desc).localeCompare(String(b.e.desc)));
}
function summarize(month) {
  let total = 0, due1 = 0, due2 = 0, paid1 = 0, paid2 = 0, paidTotal = 0, paidDue1 = 0, pendingAmt = 0;
  for (const o of occurrences(month)) {
    if (o.e.status !== 'aprovada') { if (o.e.status === 'pendente') pendingAmt += +o.e.amount; continue; }
    const payOk = o.pay && o.pay.status === 'aprovada';
    const a = payOk ? +o.pay.amount : +o.e.amount, s = shareP1(o.e.split);
    total += a; due1 += a * s; due2 += a * (1 - s);
    if (payOk) { paidTotal += a; paidDue1 += a * s; if (o.pay.paidBy === 'p1') paid1 += a; else paid2 += a; }
    else if (o.pay && o.pay.status === 'pendente') pendingAmt += +o.pay.amount;
  }
  return { total, due1, due2, paid1, paid2, paidTotal, bal1: paid1 - paidDue1, pendingAmt };
}
const owesText = b => Math.abs(b) < 0.01 ? '' : b > 0 ? `${name('p2')} deve ${brl(b)} para ${name('p1')}` : `${name('p1')} deve ${brl(-b)} para ${name('p2')}`;

/* ---------- estado visual de uma ocorrência ---------- */
function occState(o) {
  const e = o.e, p = o.pay;
  if (e.change) return { cls: 'wait', txt: e.change.kind === 'excluir' ? 'exclusão pendente' : 'alteração pendente' };
  if (e.status === 'pendente') return { cls: 'wait', txt: e.by === me ? `esperando ${name(other(me))}` : 'precisa do seu OK' };
  if (e.status === 'recusada') return { cls: 'bad', txt: 'recusada' };
  if (p && p.change) return { cls: 'wait', txt: 'pagamento: pedido pendente' };
  if (p && p.status === 'aprovada') return { cls: 'ok', txt: 'pago' };
  if (p && p.status === 'pendente') return { cls: 'wait', txt: p.by === me ? `pago · esperando ${name(other(me))}` : 'confirme o pagamento' };
  if (p && p.status === 'recusada') return { cls: 'bad', txt: 'pagamento recusado' };
  return { cls: '', txt: o.month < thisMonth() ? 'em aberto' : 'a pagar' };
}

/* ---------- comprovantes ---------- */
async function compress(file) {
  if (!file.type.startsWith('image/') || /svg|gif/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.8));
  } catch { return file; }
}
async function uploadReceipt(file) {
  const blob = await compress(file);
  const type = blob.type || file.type || 'image/jpeg';
  if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(type)) throw new Error('Use uma foto (JPG/PNG) ou PDF.');
  return B.upload(house.id, blob, type);
}
let rcReg = [];
const rcBtn = (rc, label = 'Ver comprovante') => rc ? `<button type="button" class="link" data-rc="${rcReg.push(rc) - 1}">📎 ${label}</button>` : '';
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-rc]'); if (!b) return;
  ev.preventDefault(); ev.stopPropagation();
  const rc = rcReg[+b.dataset.rc]; if (!rc) return;
  try {
    const url = await B.receiptUrl(rc);
    const pdf = rc.type === 'application/pdf';
    $('viewImg').classList.toggle('hidden', pdf); $('viewPdf').classList.toggle('hidden', !pdf);
    if (pdf) $('viewPdfLink').href = url; else $('viewImg').src = url;
    openSheet('shView');
  } catch (e) { toast('Não consegui abrir o comprovante: ' + e.message); }
}, true);
$('viewClose').onclick = () => $('shView').close();

/* ---------- folhas ---------- */
function openSheet(id) { const d = $(id); if (!d.open) d.showModal(); }
document.querySelectorAll('dialog.sheet').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
function ask(text, yes = 'Confirmar', withReason = false, danger = false) {
  return new Promise(res => {
    $('askText').textContent = text; $('askYes').textContent = yes;
    $('askYes').className = 'btn ' + (danger ? 'danger' : 'primary');
    $('askReasonBox').classList.toggle('hidden', !withReason); $('askReason').value = '';
    let done = false; const fin = v => { if (done) return; done = true; $('shAsk').close(); res(v); };
    $('askForm').onsubmit = ev => { ev.preventDefault(); fin({ reason: $('askReason').value.trim() }); };
    $('askNo').onclick = () => fin(false);
    $('shAsk').onclose = () => fin(false);
    openSheet('shAsk');
  });
}

/* =====================================================================
   TELAS
   ===================================================================== */
const SCREENS = ['scr-loading', 'scr-welcome', 'scr-login', 'scr-newpass', 'scr-onboard', 'scr-app'];
function show(id) { SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id)); window.scrollTo(0, 0); }
function busy(btn, on, txt) { if (on) { btn.dataset.t = btn.textContent; btn.textContent = txt || 'Aguarde…'; btn.disabled = true; } else { btn.textContent = btn.dataset.t || btn.textContent; btn.disabled = false; } }

/* ---------- login / cadastro ---------- */
function authPanel(which) {
  ['formLogin', 'formSignup', 'formForgot'].forEach(f => $(f).classList.toggle('hidden', f !== which));
  $('goSignup').parentElement.classList.toggle('hidden', which !== 'formLogin');
  document.querySelectorAll('.err').forEach(e => e.textContent = '');
}
$('goSignup').onclick = () => authPanel('formSignup');
$('wStart').onclick = () => { authPanel('formSignup'); show('scr-login'); };
$('wLogin').onclick = () => { authPanel('formLogin'); show('scr-login'); };
$('authBack').onclick = () => show('scr-welcome');
/* tema de cores */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('rachadinha-tema', t); } catch {}
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'lima' ? '#161816' : '#2b0b22';
  if (house) render();
}
document.querySelectorAll('[data-theme-btn]').forEach(b => b.onclick = () => setTheme(b.dataset.themeBtn));
$('goForgot').onclick = () => { $('fgEmail').value = $('liEmail').value; authPanel('formForgot'); };
$('backLogin1').onclick = $('backLogin2').onclick = () => authPanel('formLogin');

$('formLogin').onsubmit = async ev => {
  ev.preventDefault(); const btn = $('liBtn');
  if (!$('liEmail').value || !$('liPass').value) { $('liErr').textContent = 'Preencha e-mail e senha.'; return; }
  busy(btn, true, 'Entrando…');
  try { await B.signIn($('liEmail').value, $('liPass').value); await route(); }
  catch (e) { $('liErr').textContent = e.message; }
  busy(btn, false);
};
$('formSignup').onsubmit = async ev => {
  ev.preventDefault(); const btn = $('suBtn');
  const nameV = $('suName').value.trim(), email = $('suEmail').value.trim(), pass = $('suPass').value;
  if (!nameV || !email) { $('suErr').textContent = 'Preencha nome e e-mail.'; return; }
  if (pass.length < 6) { $('suErr').textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
  busy(btn, true, 'Criando…');
  try {
    const r = await B.signUp(email, pass, nameV);
    if (r.needsConfirm) { authPanel('formLogin'); $('liEmail').value = email; $('liErr').textContent = ''; toast('Conta criada! Confirme pelo link que enviamos para ' + email + '.', 7000); }
    else await route();
  } catch (e) { $('suErr').textContent = e.message; }
  busy(btn, false);
};
$('formForgot').onsubmit = async ev => {
  ev.preventDefault(); const btn = $('fgBtn');
  busy(btn, true, 'Enviando…');
  try { await B.resetPassword($('fgEmail').value); toast('Pronto! Veja seu e-mail para criar a senha nova.', 6000); authPanel('formLogin'); }
  catch (e) { $('fgErr').textContent = e.message; }
  busy(btn, false);
};
$('formNewPass').onsubmit = async ev => {
  ev.preventDefault();
  if ($('npPass').value.length < 6) { $('npErr').textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
  try { await B.setPassword($('npPass').value); toast('Senha alterada ✓'); history.replaceState(null, '', location.pathname); await route(); }
  catch (e) { $('npErr').textContent = e.message; }
};

/* ---------- criar / entrar na casa ---------- */
$('obCreate').onclick = () => { $('obCreate').classList.add('active'); $('obJoin').classList.remove('active'); $('formCreate').classList.remove('hidden'); $('formJoin').classList.add('hidden'); $('hcName').focus(); };
$('obJoin').onclick = () => { $('obJoin').classList.add('active'); $('obCreate').classList.remove('active'); $('formJoin').classList.remove('hidden'); $('formCreate').classList.add('hidden'); $('hjCode').focus(); };
$('formCreate').onsubmit = async ev => {
  ev.preventDefault(); const btn = ev.target.querySelector('button');
  busy(btn, true, 'Criando…');
  try { await B.createHousehold(user.id, $('hcName').value.trim(), user.name); await route(); toast('Casa criada! 🎉', 4000); }
  catch (e) { $('hcErr').textContent = e.message; }
  busy(btn, false);
};
$('formJoin').onsubmit = async ev => {
  ev.preventDefault(); const btn = ev.target.querySelector('button');
  if (!$('hjCode').value.trim()) { $('hjErr').textContent = 'Digite o código.'; return; }
  busy(btn, true, 'Entrando…');
  try { await B.joinHousehold(user.id, $('hjCode').value, user.name); await route(); toast('Você entrou na casa 🎉'); }
  catch (e) { $('hjErr').textContent = e.message; }
  busy(btn, false);
};
const doLogout = async () => { if (unsub) { unsub(); unsub = null; } await B.signOut(); house = null; user = null; me = null; await route(); };
$('obLogout').onclick = doLogout;
$('logout').onclick = async () => { $('shSet').close(); if (await ask('Sair da sua conta neste aparelho?', 'Sair')) doLogout(); };

/* ---------- roteamento ---------- */
let routing = 0;
async function route() {
  const my = ++routing;
  try {
    user = await B.getUser();
    if (my !== routing) return;
    if (!user) { authPanel('formLogin'); return show('scr-welcome'); }
    house = await B.myHousehold(user.id);
    if (my !== routing) return;
    if (!house) {
      $('obHello').textContent = `Oi, ${user.name}!`;
      ['formCreate', 'formJoin'].forEach(f => $(f).classList.add('hidden'));
      ['obCreate', 'obJoin'].forEach(f => $(f).classList.remove('active'));
      return show('scr-onboard');
    }
    me = (house.members.find(m => m.user_id === user.id) || {}).slot;
    const r = await B.loadRecords(house.id);
    if (my !== routing) return;
    for (const k of ['config', 'expenses', 'payments', 'settles']) S[k] = r[k] || {};
    if (unsub) unsub();
    unsub = B.subscribe(house.id, {
      onRow(kind, id, data) { if (!S[kind]) return; if (data) S[kind][id] = data; else delete S[kind][id]; render(); },
      onFull() { reloadRecords(); },
      async onMembers() { const h = await B.myHousehold(user.id); if (h) { house = h; render(); } }
    });
    show('scr-app'); render();
  } catch (e) {
    show('scr-login'); authPanel('formLogin'); $('liErr').textContent = 'Erro: ' + e.message;
  }
}

/* =====================================================================
   TELA ÚNICA
   ===================================================================== */
function render() {
  if (!house) return;
  rcReg = [];
  document.querySelectorAll('.mlabel').forEach(el => el.textContent = monthName(curMonth));
  renderHome(); renderSetup(); renderAttn(); renderList(); renderProfile();
}
$('navPlus').onclick = () => openExpense();
$('meBtn').onclick = () => { renderProfile(); openSheet('shSet'); };
$('setClose').onclick = () => $('shSet').close();
document.querySelectorAll('.monthsw button').forEach(b => b.onclick = () => { curMonth = addMonths(curMonth, +b.dataset.m); render(); });

const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>'
};

/* topo, acerto e as duas pessoas */
function renderHome() {
  $('homeHello').innerHTML = `Olá,<br>${esc(name(me))} 👋`;
  $('homeHouse').textContent = house.name + (DEMO ? ' · demonstração' : '');
  $('meBtn').textContent = (name(me)[0] || '?').toUpperCase();

  const s = summarize(curMonth), st = S.settles[curMonth], owes = s.bal1;
  const stPend = st && (st.status === 'pendente' || st.change), stOk = st && st.status === 'aprovada' && !st.change;
  const debtor = owes > 0 ? 'p2' : 'p1';
  let amt, who, tab, act = null;
  if (stOk) { amt = 'Acertado ✓'; who = st.text || 'Ninguém devia nada.'; tab = 'Desfazer'; act = 'undo'; }
  else if (stPend) { amt = brl(Math.abs(owes)); who = `Esperando ${name(other(st.change ? st.change.by : st.by))} confirmar o acerto`; tab = 'Enviado'; }
  else if (Math.abs(owes) < 0.01) { amt = 'R$ 0,00'; who = s.paidTotal ? 'Tudo equilibrado: ninguém deve nada.' : 'Nenhuma conta paga ainda.'; tab = s.paidTotal ? 'Fechar mês' : '—'; act = s.paidTotal ? 'settle' : null; }
  else { amt = brl(Math.abs(owes)); who = `${name(debtor)} deve para ${name(other(debtor))}`; tab = 'Acertar'; act = 'settle'; }
  $('balance').innerHTML = `<span class="star">${ICON.star}</span>
    <div class="lbl">Acerto do mês</div>
    <div class="amt">${esc(amt)}</div><div class="who">${esc(who)}</div>
    <div class="foot"><span>Total ${brl(s.total)}</span><span>Falta pagar ${brl(s.total - s.paidTotal)}</span></div>
    ${act || stPend ? `<button class="tab" id="balTab" ${act ? '' : 'disabled'}>${act === 'undo' ? ICON.undo : ICON.check}<span>${esc(tab)}</span></button>` : ''}`;
  $('balance').classList.toggle('notab', !(act || stPend));
  if ($('balTab')) $('balTab').onclick = async () => {
    if (act === 'undo') { if (await ask('Pedir para desfazer o acerto deste mês? A outra pessoa precisa confirmar.', 'Pedir')) requestDelete('settles', curMonth); return; }
    if (act !== 'settle') return;
    const txt = owesText(owes);
    if (!await ask(`${txt ? txt + '. ' : ''}Vocês já acertaram essa diferença? ${name(other(me))} vai confirmar.`, 'Sim, já acertamos')) return;
    requestEdit('settles', curMonth, { month: curMonth, text: txt });
    toast(`Enviado para ${name(other(me))} confirmar.`);
  };

  const p = pct1();
  $('blocks').innerHTML = ['p1', 'p2'].map(k => `<div class="pblock ${k}">
      <div class="bt"><span class="bn">${esc(name(k))}</span><span class="badge">${pctFmt(k === 'p1' ? p : 1 - p)}</span></div>
      <div class="bv">${brl(k === 'p1' ? s.due1 : s.due2)}</div>
      <div class="bs">${k === me ? 'sua parte' : 'parte de ' + esc(name(k))} no mês</div>
      <div class="bp">já pagou ${brl(k === 'p1' ? s.paid1 : s.paid2)}</div></div>`).join('');
}

/* primeiros passos: renda e convite */
function renderSetup() {
  const s = settings(), parts = [];
  if (!s.p1.income && !s.p2.income && s.mode !== 'manual')
    parts.push(`<div class="setup"><h2>Primeiro passo: as rendas</h2><p>Com a renda de cada uma, o app calcula quanto cada pessoa paga.</p><button class="btn block" id="goIncome">Informar rendas</button></div>`);
  if (!bothIn())
    parts.push(`<div class="setup"><h2>Convide a outra pessoa</h2><p>Ela cria a conta dela e entra com este código. Até lá, suas despesas ficam esperando aprovação.</p>
      <div class="codebox"><div class="code">${esc(house.code)}</div><button class="btn sm" id="copyCode2" style="margin-top:10px">Copiar convite</button></div></div>`);
  $('setup').innerHTML = parts.join('');
  const gi = $('goIncome'); if (gi) gi.onclick = () => { renderProfile(); openSheet('shSet'); setTimeout(() => $('r1').focus(), 250); };
  const cc = $('copyCode2'); if (cc) cc.onclick = copyInvite;
}
async function copyInvite() {
  const txt = `Vem dividir as contas comigo no Rachadinha! Crie sua conta em ${location.origin + location.pathname} e use o código ${house.code}`;
  try { await navigator.clipboard.writeText(txt); toast('Convite copiado ✓'); } catch { toast('Código: ' + house.code); }
}

/* precisa do seu OK: aprovações e recusas, tudo na mesma tela */
function renderAttn() {
  const toMe = pendingItems().filter(i => i.author !== me);
  const rej = rejectedItems().filter(x => x.own);
  const box = $('attn');
  if (!toMe.length && !rej.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const n = toMe.length + rej.length;
  box.innerHTML = `<h2>Precisa de você <span class="n">${n}</span></h2>` +
    toMe.map((it, i) => { const x = describe(it); return `<div class="appr"><div class="top"><div class="t">${x.t}</div><b style="white-space:nowrap">${x.amt}</b></div><div class="d">${x.d}</div><div class="w">Enviado por ${esc(name(it.author))}</div>
      <div class="acts"><button class="btn ok sm" data-ap="${i}">Aprovar</button><button class="btn ghost sm" data-rj="${i}">Recusar</button></div></div>`; }).join('') +
    rej.map((x, i) => `<div class="appr"><div class="t">${esc(x.t)}</div><div class="d">Recusado por ${esc(name(x.by))}${x.reason ? `: “${esc(x.reason)}”` : '.'}</div>
      <div class="acts">${x.type === 'rec' && x.kind === 'expenses' ? `<button class="btn ok sm" data-fix="${i}">Corrigir</button>` : ''}<button class="btn ghost sm" data-drop="${i}">${x.type === 'rec' ? 'Apagar' : 'Ok'}</button></div></div>`).join('');
  box.classList.remove('hidden');
  box.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => { const it = toMe[b.dataset.ap]; approve(it.kind, it.id); toast('Aprovado ✓'); });
  box.querySelectorAll('[data-rj]').forEach(b => b.onclick = async () => { const it = toMe[b.dataset.rj]; const r = await ask('Recusar?', 'Recusar', true, true); if (r) reject(it.kind, it.id, r.reason); });
  box.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => openExpense(rej[b.dataset.fix].id));
  box.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {
    const x = rej[b.dataset.drop], r = S[x.kind][x.id];
    if (x.type === 'note') put(x.kind, x.id, { ...r, note: null }); else { put(x.kind, x.id, null); if (x.kind === 'expenses') dropPayments(x.id); }
  });
}

/* contas do mês */
function itemRow(o) {
  const e = o.e, st = occState(o);
  const amount = o.pay && o.pay.status === 'aprovada' ? o.pay.amount : e.amount;
  return `<li class="item ${e.status !== 'aprovada' ? 'dim' : ''}" data-occ="${esc(o.key)}">
    <div class="mid"><div class="t">${esc(e.desc)}</div>
      <div class="tg"><span class="pill dark">dia ${o.day}</span>${o.label ? `<span class="pill">${o.label}</span>` : ''}<span class="pill ${st.cls}">${esc(st.txt)}</span></div></div>
    <div class="r"><div class="a">${brl(amount)}</div><span class="go">${ICON.play}</span></div></li>`;
}
function renderList() {
  const occ = occurrences(curMonth);
  const tot = occ.reduce((a, o) => a + +(o.pay && o.pay.status === 'aprovada' ? o.pay.amount : o.e.amount), 0);
  $('listTotal').textContent = occ.length ? brl(tot) : '';
  $('listTotal').classList.toggle('hidden', !occ.length);
  $('listItems').innerHTML = occ.length ? occ.map(itemRow).join('')
    : `<li class="empty"><b>Nenhuma conta neste mês</b>Toque em “Nova despesa” para começar.</li>`;
  $('listItems').querySelectorAll('[data-occ]').forEach(li => li.onclick = () => openDetail(li.dataset.occ));
}

/* ---------- Detalhe ---------- */
function openDetail(key) {
  const [expId, month] = key.split('__');
  const o = occurrences(month).find(x => x.key === key); if (!o) return;
  rcReg = rcReg.length > 500 ? [] : rcReg;
  const e = o.e, pay = o.pay, st = occState(o), s = shareP1(e.split);
  const mineToApprove = it => it && it.author !== me;
  const expPending = e.change ? { author: e.change.by } : e.status === 'pendente' ? { author: e.by } : null;
  const payPending = pay ? (pay.change ? { author: pay.change.by } : pay.status === 'pendente' ? { author: pay.by } : null) : null;
  const amt = pay && pay.status === 'aprovada' ? pay.amount : e.amount;

  let html = `<div class="dtop"><div class="t">${esc(e.desc)}</div><div class="sub">${esc(monthName(month))} · vence dia ${o.day}</div>
    <div class="damt">${brl(amt)}</div>
    <div class="tg"><span class="pill ${st.cls || 'dark'}">${esc(st.txt)}</span><span class="pill">${typeTxt(e)}${o.label && e.type === 'parcelada' ? ' · parcela ' + o.label : ''}</span><span class="pill">${esc(e.category)}</span><span class="pill">paga ${esc(name(e.paidBy))}</span></div></div>
    <div class="box">
      <div class="kv"><span>Divisão</span><b>${esc(splitTxt(e.split))}</b></div>
      <div class="kv"><span>Parte de ${esc(name('p1'))}</span><b>${brl(amt * s)}</b></div>
      <div class="kv"><span>Parte de ${esc(name('p2'))}</span><b>${brl(amt * (1 - s))}</b></div>
      ${e.receipt ? `<div>${rcBtn(e.receipt, 'Ver nota')}</div>` : ''}
    </div>`;
  if (e.status === 'recusada') html += `<div class="box" style="color:var(--bad)">Recusada por ${esc(name(e.rejectedBy))}${e.reason ? `: “${esc(e.reason)}”` : '.'}</div>`;
  if (e.change && e.change.kind === 'editar') html += `<div class="box" style="color:var(--warn)">Alteração pendente: ${describeExpChange(e)}</div>`;
  if (expPending && mineToApprove(expPending)) html += `<div class="acts" style="margin-bottom:12px"><button class="btn ok" data-a="apExp">Aprovar${e.change ? ' alteração' : ''}</button><button class="btn ghost" data-a="rjExp">Recusar</button></div>`;

  if (pay) {
    html += `<div class="box"><div style="font-weight:700;margin-bottom:4px">Pagamento</div>
      <div class="kv"><span>Pago por</span><b>${esc(name(pay.paidBy))}</b></div>
      <div class="kv"><span>Valor</span><b>${brl(pay.amount)}</b></div>
      <div class="kv"><span>Data</span><b>${fmtDate(pay.date)}</b></div>
      ${pay.receipt ? rcBtn(pay.receipt) : ''}
      ${pay.status === 'recusada' ? `<div style="color:var(--bad);margin-top:6px">Recusado${pay.reason ? `: “${esc(pay.reason)}”` : ''}</div>` : ''}
      ${payPending ? `<div style="color:var(--warn);margin-top:6px">${pay.change ? 'Pedido para desmarcar' : 'Aguardando confirmação'} de ${esc(name(other(payPending.author)))}</div>` : ''}</div>`;
    if (payPending && mineToApprove(payPending)) html += `<div class="acts" style="margin-bottom:12px"><button class="btn ok" data-a="apPay">Confirmar pagamento</button><button class="btn ghost" data-a="rjPay">Recusar</button></div>`;
  }

  const acts = [];
  if (e.status !== 'recusada') {
    if (!pay || pay.status === 'recusada') acts.push(`<button class="btn primary" data-a="pay">Registrar pagamento</button>`);
    else if (!pay.change && !(payPending && mineToApprove(payPending))) acts.push(`<button class="btn ghost" data-a="unpay">${pay.status === 'pendente' ? 'Cancelar pagamento' : 'Desmarcar pagamento'}</button>`);
  }
  acts.push(`<button class="btn ghost" data-a="edit">Editar</button>`);
  if (e.type === 'mensal' && e.status === 'aprovada' && !e.change) acts.push(`<button class="btn ghost" data-a="end">Encerrar recorrência</button>`);
  if (!e.change) acts.push(`<button class="btn ghost" data-a="del" style="color:var(--bad)">Excluir</button>`);
  html += `<div class="acts">${acts.join('')}</div>`;
  $('detBody').innerHTML = html;

  const A = {
    apExp: () => { approve('expenses', expId); toast('Aprovado ✓'); $('shDet').close(); },
    rjExp: async () => { $('shDet').close(); const r = await ask('Recusar este lançamento?', 'Recusar', true, true); if (r) reject('expenses', expId, r.reason); },
    apPay: () => { approve('payments', key); toast('Pagamento confirmado ✓'); $('shDet').close(); },
    rjPay: async () => { $('shDet').close(); const r = await ask('Recusar este pagamento?', 'Recusar', true, true); if (r) reject('payments', key, r.reason); },
    pay: () => { $('shDet').close(); openPay(o); },
    unpay: async () => {
      $('shDet').close();
      const pend = pay.status === 'pendente';
      if (await ask(pend ? 'Cancelar este pagamento ainda não confirmado?' : 'Pedir para desmarcar este pagamento? A outra pessoa precisa confirmar.', pend ? 'Cancelar pagamento' : 'Pedir', false, pend)) requestDelete('payments', key);
    },
    edit: () => { $('shDet').close(); openExpense(expId); },
    end: async () => {
      $('shDet').close();
      if (!await ask(`Pedir para encerrar “${e.desc}” a partir de ${monthName(month).toLowerCase()}? Os meses anteriores continuam valendo.`, 'Pedir')) return;
      requestEdit('expenses', expId, { ...expData(e), endMonth: month }); toast(`Enviado para ${name(other(me))} aprovar.`);
    },
    del: async () => {
      $('shDet').close();
      const direct = e.status !== 'aprovada';
      if (!await ask(direct ? 'Excluir esta despesa?' : 'Pedir para excluir esta despesa (todos os meses)? A outra pessoa precisa aprovar.', direct ? 'Excluir' : 'Pedir exclusão', false, true)) return;
      requestDelete('expenses', expId); if (!direct) toast(`Enviado para ${name(other(me))} aprovar.`);
    }
  };
  $('detBody').querySelectorAll('[data-a]').forEach(b => b.onclick = A[b.dataset.a]);
  openSheet('shDet');
}
const EXP_FIELDS = ['desc', 'amount', 'date', 'category', 'paidBy', 'type', 'installments', 'split', 'endMonth', 'receipt'];
const expData = e => Object.fromEntries(EXP_FIELDS.map(k => [k, e[k] ?? null]));
function describeExpChange(r) {
  const n = r.change.data, out = [];
  const F = { desc: ['descrição', esc], amount: ['valor', brl], date: ['data', fmtDate], category: ['categoria', esc], paidBy: ['quem paga', p => esc(name(p))],
    type: ['tipo', t => ({ unica: 'única', mensal: 'mensal', parcelada: 'parcelada' }[t])], installments: ['parcelas', String], split: ['divisão', splitTxt], endMonth: ['encerra em', m => m ? monthShort(m) : '—'] };
  for (const [k, [lbl, f]] of Object.entries(F)) if (String(r[k] ?? '') !== String(n[k] ?? '')) out.push(`${lbl}: ${f(r[k]) || '—'} → <b>${f(n[k]) || '—'}</b>`);
  if (JSON.stringify(r.receipt || null) !== JSON.stringify(n.receipt || null)) out.push(n.receipt ? 'nova nota ' + rcBtn(n.receipt, 'ver') : 'nota removida');
  return out.join('<br>') || 'sem mudanças visíveis';
}

/* ---------- Aprovações ---------- */
function describe(it) {
  const r = it.r;
  if (it.kind === 'config') {
    const a = settings(), b = Object.assign({}, DEF_SETTINGS, r.change.data), lines = [];
    for (const p of ['p1', 'p2']) if (+a[p].income !== +b[p].income) lines.push(`Renda de ${esc(name(p))}: ${brl(a[p].income)} → <b>${brl(b[p].income)}</b>`);
    lines.push(`Divisão: ${pctFmt(pct1(a))} / ${pctFmt(1 - pct1(a))} → <b>${pctFmt(pct1(b))} / ${pctFmt(1 - pct1(b))}</b>`);
    return { t: 'Renda e divisão', d: lines.join('<br>'), amt: '' };
  }
  if (it.kind === 'expenses') {
    const base = `${typeTxt(r)} desde ${monthShort(ym(r.date))} · paga ${esc(name(r.paidBy))} · ${splitTxt(r.split)}`;
    if (it.type === 'novo') return { t: `Nova despesa: ${esc(r.desc)}`, d: base + ' ' + rcBtn(r.receipt, 'nota'), amt: brl(r.amount) };
    if (it.type === 'excluir') return { t: `Excluir: ${esc(r.desc)}`, d: base, amt: brl(r.amount) };
    return { t: `Alterar: ${esc(r.desc)}`, d: describeExpChange(r), amt: '' };
  }
  if (it.kind === 'payments') {
    const e = S.expenses[r.expId] || { desc: '(despesa removida)' };
    const base = `pago por ${esc(name(r.paidBy))} em ${fmtDate(r.date)} · ${monthShort(r.month)} ${rcBtn(r.receipt)}`;
    if (it.type === 'excluir') return { t: `Desmarcar pagamento: ${esc(e.desc)}`, d: base, amt: brl(r.amount) };
    return { t: `Pagamento: ${esc(e.desc)}`, d: base, amt: brl(r.amount) };
  }
  if (it.type === 'excluir') return { t: `Desfazer acerto de ${esc(monthName(it.id).toLowerCase())}`, d: '', amt: '' };
  return { t: `Acerto de ${esc(monthName(it.id).toLowerCase())}`, d: esc((r.change ? r.change.data.text : r.text) || 'Ninguém devia nada.'), amt: '' };
}

/* ---------- Perfil ---------- */
function renderProfile() {
  $('meCard').innerHTML = `<span class="avatar ${me}">${esc((name(me)[0] || '?').toUpperCase())}</span>
    <div><div style="font-weight:800;font-size:20px">${esc(name(me))}</div><div style="opacity:.7;font-size:14px">${esc(user.email)}</div></div>`;
  if (document.activeElement !== $('myName')) $('myName').value = name(me);
  $('houseCard').innerHTML = `<h3>${esc(house.name)}</h3>
    ${['p1', 'p2'].map(p => `<div class="kv"><span>${member(p) ? esc(name(p)) + (p === me ? ' (você)' : '') : '<i>esperando entrar</i>'}</span><b>${member(p) ? '✓' : '—'}</b></div>`).join('')}
    ${bothIn() ? '' : `<div class="codebox"><div style="font-size:13px;font-weight:600;margin-bottom:4px">Código para a outra pessoa entrar</div><div class="code">${esc(house.code)}</div>
      <button class="btn sm" id="copyCode" style="margin-top:10px">Copiar convite</button></div>`}`;
  const cc = $('copyCode'); if (cc) cc.onclick = copyInvite;

  const s = settings(), c = cfg();
  $('r1l').textContent = 'Renda de ' + name('p1'); $('r2l').textContent = 'Renda de ' + name('p2'); $('mp1l').textContent = 'Percentual de ' + name('p1') + ' (%)';
  if (!$('shSet').contains(document.activeElement) || document.activeElement === $('myName')) {
    $('r1').value = s.p1.income || ''; $('r2').value = s.p2.income || ''; $('pctMode').value = s.mode; $('mp1').value = s.manualPct1;
  }
  const locked = !!c.change;
  ['r1', 'r2', 'pctMode', 'mp1', 'saveCfg'].forEach(id => $(id).disabled = locked);
  $('cfgHint').textContent = locked ? `Há uma alteração aguardando ${name(other(c.change.by))}.` : bothIn() ? 'Mudanças aqui precisam da aprovação da outra pessoa.' : 'Enquanto a outra pessoa não entrar, as mudanças valem na hora.';
  $('saveCfg').textContent = bothIn() ? 'Enviar para aprovação' : 'Salvar';
  cfgPreview();
  $('demoCard').classList.toggle('hidden', !DEMO);
  document.querySelectorAll('[data-theme-btn]').forEach(b => b.classList.toggle('on', b.dataset.themeBtn === (document.documentElement.dataset.theme || 'rosa')));
}
function readCfg() { return { p1: { income: +$('r1').value || 0 }, p2: { income: +$('r2').value || 0 }, mode: $('pctMode').value, manualPct1: +$('mp1').value || 0 }; }
function cfgPreview() {
  $('manualBox').classList.toggle('hidden', $('pctMode').value !== 'manual');
  const p = pct1(readCfg());
  $('cfgBar').innerHTML = `<i style="width:${p * 100}%;background:var(--p1)"></i><i style="width:${(1 - p) * 100}%;background:var(--p2)"></i>`;
  $('cfgPrev').textContent = `${name('p1')}: ${pctFmt(p)} · ${name('p2')}: ${pctFmt(1 - p)}`;
}
['r1', 'r2', 'pctMode', 'mp1'].forEach(id => $(id).addEventListener('input', cfgPreview));
$('saveCfg').onclick = () => {
  const data = readCfg(), c = S.config.main || { settings: DEF_SETTINGS };
  document.activeElement.blur();
  if (bothIn()) { put('config', 'main', { ...c, change: { kind: 'editar', data, by: me, at: now() }, note: null }); toast(`Enviado para ${name(other(me))} aprovar.`); }
  else { put('config', 'main', { ...c, settings: data, status: 'aprovada' }); toast('Salvo ✓'); }
};
$('saveName').onclick = async () => {
  const v = $('myName').value.trim(); if (!v) return;
  try { await B.updateMyName(house.id, user.id, v); house.members.find(m => m.user_id === user.id).name = v; user.name = v; render(); toast('Nome salvo ✓'); }
  catch (e) { toast(e.message); }
};
$('demoReset').onclick = async () => { if (await ask('Apagar todas as contas e dados da demonstração neste aparelho?', 'Apagar', false, true)) { B.reset(); location.reload(); } };

/* ---------- formulário de despesa ---------- */
let editingId = null, photoState = null;
$('fCat').innerHTML = CATS.map(c => `<option>${c}</option>`).join('');
function openExpense(id) {
  editingId = id || null;
  const r = id ? S.expenses[id] : null;
  const e = r ? (r.change && r.change.kind === 'editar' ? { ...r, ...r.change.data } : r) : null;
  const opts = `<option value="p1">${esc(name('p1'))}</option><option value="p2">${esc(name('p2'))}</option>`;
  $('fPaidBy').innerHTML = opts;
  $('fSplit').innerHTML = `<option value="renda">Proporcional (${pctFmt(pct1())}/${pctFmt(1 - pct1())})</option><option value="igual">Meio a meio</option><option value="p1">Só ${esc(name('p1'))}</option><option value="p2">Só ${esc(name('p2'))}</option>`;
  $('expTitle').textContent = e ? 'Editar despesa' : 'Nova despesa';
  $('expNote').textContent = r && r.status === 'aprovada' ? 'Já aprovada: a mudança vai para aprovação e, até lá, vale a versão atual.' : '';
  $('fDesc').value = e?.desc ?? ''; $('fAmt').value = e?.amount ?? '';
  $('fDate').value = e?.date ?? (curMonth === thisMonth() ? todayStr() : curMonth + '-01');
  $('fCat').value = e?.category ?? 'Moradia'; $('fPaidBy').value = e?.paidBy ?? me;
  $('fType').value = e?.type ?? 'unica'; $('fInst').value = e?.installments > 1 ? e.installments : 2;
  $('fSplit').value = e?.split ?? 'renda';
  $('fPhoto').value = ''; photoState = e?.receipt || null; drawPhoto();
  $('expErr').textContent = ''; $('expSave').disabled = false; $('expSave').textContent = bothIn() || r ? 'Enviar para aprovação' : 'Salvar';
  typeHint();
  openSheet('shExp');
}
function drawPhoto() {
  rcReg = rcReg.length > 500 ? [] : rcReg;
  $('fPhotoCur').innerHTML = photoState ? `${rcBtn(photoState, 'Nota atual')} · <button type="button" class="link" id="rmPhoto" style="color:var(--bad)">remover</button>` : '';
  const rm = $('rmPhoto'); if (rm) rm.onclick = () => { photoState = null; drawPhoto(); };
}
function typeHint() {
  const t = $('fType').value;
  $('instBox').classList.toggle('hidden', t !== 'parcelada');
  $('typeHint').textContent = { unica: 'Aparece só no mês do vencimento.', mensal: 'Repete todo mês até alguém encerrar. Se o valor varia (luz, água), o valor real vai no pagamento.', parcelada: 'Informe o valor de cada parcela.' }[t];
}
$('fType').onchange = typeHint;
$('expCancel').onclick = () => $('shExp').close();
$('expForm').onsubmit = async ev => {
  ev.preventDefault();
  const desc = $('fDesc').value.trim(), amount = Math.round(+$('fAmt').value * 100) / 100, date = $('fDate').value;
  if (!desc || !(amount > 0) || !date) { $('expErr').textContent = 'Preencha descrição, valor e vencimento.'; return; }
  const btn = $('expSave');
  let receipt = photoState;
  const f = $('fPhoto').files[0];
  if (f) { busy(btn, true, 'Enviando foto…'); try { receipt = await uploadReceipt(f); } catch (e) { $('expErr').textContent = e.message; busy(btn, false); return; } busy(btn, false); }
  const prev = editingId ? S.expenses[editingId] : null;
  const prevEnd = prev ? (prev.change && prev.change.data ? prev.change.data.endMonth : prev.endMonth) : null;
  const type = $('fType').value;
  const data = { desc, amount, date, category: $('fCat').value, paidBy: $('fPaidBy').value, type,
    installments: type === 'parcelada' ? Math.max(2, parseInt($('fInst').value) || 2) : 1,
    split: $('fSplit').value, endMonth: type === 'mensal' ? (prevEnd || null) : null, receipt: receipt || null };
  $('shExp').close();
  if (editingId) requestEdit('expenses', editingId, data); else createRec('expenses', newId(), data);
  curMonth = ym(date) > curMonth && !editingId ? ym(date) : curMonth;
  render();
  toast(bothIn() ? `Enviado para ${name(other(me))} aprovar.` : 'Salvo. Vai para aprovação quando a outra pessoa entrar.');
};

/* ---------- formulário de pagamento ---------- */
let payingOcc = null;
function openPay(o) {
  payingOcc = o;
  $('payTitle').textContent = `Pagar ${o.e.desc}`;
  $('pBy').innerHTML = `<option value="p1">${esc(name('p1'))}</option><option value="p2">${esc(name('p2'))}</option>`;
  $('pBy').value = o.pay?.paidBy || o.e.paidBy || me;
  $('pAmt').value = o.pay?.amount || o.e.amount;
  $('pDate').value = o.pay?.date || (o.month === thisMonth() ? todayStr() : o.month + '-' + String(o.day).padStart(2, '0'));
  $('pPhoto').value = ''; $('payErr').textContent = ''; $('paySave').disabled = false; $('paySave').textContent = 'Enviar para confirmação';
  openSheet('shPay');
}
$('payCancel').onclick = () => $('shPay').close();
$('payForm').onsubmit = async ev => {
  ev.preventDefault();
  const o = payingOcc, btn = $('paySave');
  const amount = Math.round(+$('pAmt').value * 100) / 100;
  if (!(amount > 0) || !$('pDate').value) { $('payErr').textContent = 'Informe valor e data.'; return; }
  let receipt = o.pay?.receipt || null;
  const f = $('pPhoto').files[0];
  if (f) { busy(btn, true, 'Enviando foto…'); try { receipt = await uploadReceipt(f); } catch (e) { $('payErr').textContent = e.message; busy(btn, false); return; } busy(btn, false); }
  $('shPay').close();
  requestEdit('payments', o.key, { expId: o.id, month: o.month, amount, paidBy: $('pBy').value, date: $('pDate').value, receipt });
  toast(`Enviado para ${name(other(me))} confirmar.`);
};

/* =====================================================================
   INÍCIO
   ===================================================================== */
async function boot() {
  $('demoNote').classList.toggle('hidden', !DEMO);
  if (DEMO) B = DemoBackend();
  else {
    try { await loadScript(SUPABASE_SDK); B = SupaBackend(); }
    catch (e) { show('scr-login'); $('liErr').textContent = 'Sem conexão para carregar o app. Tente de novo.'; return; }
  }
  B.onAuth(ev => {
    if (ev === 'PASSWORD_RECOVERY') { show('scr-newpass'); return; }
    if (ev === 'SIGNED_OUT') { route(); }
  });
  if (/type=recovery/.test(location.hash)) { setTimeout(() => { if (!$('scr-loading').classList.contains('hidden')) show('scr-newpass'); }, 2500); return; } // normalmente abre pelo evento acima
  await route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
