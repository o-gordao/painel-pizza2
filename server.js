const express = require('express');
const https   = require('https');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

const FOODY_TOKEN = process.env.FOODY_TOKEN || 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = process.env.CW_TOKEN    || 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';

// ── banco OPCIONAL ────────────────────────────────────────────
let pool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
    pool.query('SELECT 1')
      .then(() => pool.query(`CREATE TABLE IF NOT EXISTS historico (
        data DATE PRIMARY KEY, foody_json TEXT, cw_json TEXT, det_json TEXT, salvo_em TIMESTAMP DEFAULT NOW()
      )`))
      .then(() => console.log('[DB] conectado e pronto'))
      .catch(e => { console.log('[DB] erro:', e.message); pool = null; });
  } catch(e) {
    console.log('[DB] módulo pg indisponível:', e.message);
  }
}

async function dbSave(sql, params) {
  if (!pool) return;
  try { await pool.query(sql, params); }
  catch(e) { console.log('[DB] erro ao salvar:', e.message); }
}
async function dbGet(sql, params) {
  if (!pool) return null;
  try { return await pool.query(sql, params); }
  catch(e) { console.log('[DB] erro ao buscar:', e.message); return null; }
}

// ── helpers ───────────────────────────────────────────────────
function hojeNoBrasil() {
  const d = new Date(); d.setHours(d.getHours() - 3);
  return d.toISOString().slice(0, 10);
}

function httpGet(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (timeoutMs) req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function tryJSON(body) {
  try { return JSON.parse(body); } catch(e) { return null; }
}

// ── Foody ─────────────────────────────────────────────────────
app.get('/api/foody', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  // data passada: tenta banco primeiro
  if (hoje !== hojeNoBrasil()) {
    const r = await dbGet('SELECT foody_json FROM historico WHERE data=$1', [hoje]);
    if (r?.rows[0]?.foody_json) {
      console.log('[FOODY] do banco:', hoje);
      res.setHeader('Content-Type', 'application/json');
      return res.send(r.rows[0].foody_json);
    }
  }
  const url = 'https://app.foodydelivery.com/rest/1.2/orders?startDate='+hoje+'T00:00:00-03:00&endDate='+hoje+'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { Authorization: FOODY_TOKEN, 'Content-Type': 'application/json' }, 15000);
    console.log('[FOODY]', r.status, hoje, r.body.length+'b');
    if (r.status === 200) dbSave('INSERT INTO historico (data,foody_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET foody_json=$2,salvo_em=NOW()', [hoje, r.body]);
    res.setHeader('Content-Type', 'application/json'); res.send(r.body);
  } catch(e) {
    console.log('[FOODY] erro:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ── Cardápio Web ── sem retry longo, falha rápido ─────────────
app.get('/api/cardapio', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  // data passada: banco primeiro
  if (hoje !== hojeNoBrasil()) {
    const r = await dbGet('SELECT cw_json FROM historico WHERE data=$1', [hoje]);
    if (r?.rows[0]?.cw_json) {
      console.log('[CW] do banco:', hoje);
      res.setHeader('Content-Type', 'application/json');
      return res.send(r.rows[0].cw_json);
    }
  }
  const url = 'https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date='+hoje+'T00:00:00-03:00&end_date='+hoje+'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' }, 15000);
    const data = tryJSON(r.body);
    if (!data) {
      console.log('[CW] rate limit ou erro:', r.body.slice(0, 60));
      return res.status(429).json({ erro: 'rate_limit', msg: 'Cardápio Web temporariamente indisponível' });
    }
    console.log('[CW]', r.status, hoje, r.body.length+'b');
    if (r.status === 200) dbSave('INSERT INTO historico (data,cw_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET cw_json=$2,salvo_em=NOW()', [hoje, r.body]);
    res.setHeader('Content-Type', 'application/json'); res.send(r.body);
  } catch(e) {
    console.log('[CW] erro:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ── Detalhes CW ───────────────────────────────────────────────
app.get('/api/cardapio/detalhes', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (!ids.length) return res.json({ ok: true, pedidos: [] });
  const pedidos = [];
  for (let i = 0; i < ids.length; i += 4) {
    const lote = ids.slice(i, i + 4);
    const results = await Promise.all(lote.map(async id => {
      try {
        const r = await httpGet('https://integracao.cardapioweb.com/api/partner/v1/orders/'+id, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' }, 10000);
        return tryJSON(r.body);
      } catch(e) { return null; }
    }));
    pedidos.push(...results.filter(Boolean));
    if (i + 4 < ids.length) await new Promise(r => setTimeout(r, 65000));
  }
  // salvar detalhes no banco
  const hoje = hojeNoBrasil();
  if (pedidos.length) {
    const ex = await dbGet('SELECT det_json FROM historico WHERE data=$1', [hoje]);
    const det = ex?.rows[0]?.det_json ? JSON.parse(ex.rows[0].det_json) : {};
    pedidos.forEach(p => { det[p.id] = p; });
    dbSave('INSERT INTO historico (data,det_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET det_json=$2', [hoje, JSON.stringify(det)]);
  }
  res.json({ ok: true, pedidos });
});

// ── Histórico ─────────────────────────────────────────────────
app.get('/api/historico', async (req, res) => {
  const r = await dbGet('SELECT data, salvo_em FROM historico ORDER BY data DESC LIMIT 15');
  res.json({ ok: !!r, dias: r?.rows || [], dbOk: !!pool });
});

app.get('/api/historico/:data', async (req, res) => {
  const r = await dbGet('SELECT foody_json, cw_json, det_json FROM historico WHERE data=$1', [req.params.data]);
  if (!r?.rows.length) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
  const row = r.rows[0];
  res.json({
    ok: true,
    foody: row.foody_json ? tryJSON(row.foody_json) || [] : [],
    cw:    row.cw_json    ? tryJSON(row.cw_json)    || {} : {},
    det:   row.det_json   ? tryJSON(row.det_json)   || {} : {}
  });
});

app.get('/health', (_, res) => res.json({ ok: true, db: !!pool, hora: new Date().toISOString() }));
app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log('🍕 rodando na porta', PORT));
