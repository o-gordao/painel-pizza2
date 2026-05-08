const express = require('express');
const https   = require('https');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

const FOODY_TOKEN = process.env.FOODY_TOKEN || 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = process.env.CW_TOKEN    || 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';

// ── banco OPCIONAL — se falhar, servidor continua funcionando ─
let pool = null;
try {
  if (process.env.DATABASE_URL) {
    const pg = require('pg');
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    pool.query('SELECT 1').then(() => {
      console.log('[DB] conectado');
      return pool.query(`CREATE TABLE IF NOT EXISTS historico (
        data DATE PRIMARY KEY, foody_json TEXT, cw_json TEXT, det_json TEXT, salvo_em TIMESTAMP DEFAULT NOW()
      )`);
    }).then(() => console.log('[DB] tabela pronta')).catch(e => {
      console.log('[DB] erro ao iniciar:', e.message);
      pool = null;
    });
  } else {
    console.log('[DB] sem DATABASE_URL — rodando sem banco');
  }
} catch(e) {
  console.log('[DB] pg não disponível:', e.message);
  pool = null;
}

async function dbQuery(sql, params) {
  if (!pool) return null;
  try { return await pool.query(sql, params); }
  catch(e) { console.log('[DB] query erro:', e.message); return null; }
}

// ── helpers ───────────────────────────────────────────────────
function hojeNoBrasil() {
  const d = new Date(); d.setHours(d.getHours() - 3);
  return d.toISOString().slice(0, 10);
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function tryJSON(body, label) {
  try { return JSON.parse(body); }
  catch(e) { console.log('['+label+'] não é JSON:', body.slice(0, 80)); return null; }
}

// ── Foody ─────────────────────────────────────────────────────
app.get('/api/foody', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  const url  = 'https://app.foodydelivery.com/rest/1.2/orders?startDate='+hoje+'T00:00:00-03:00&endDate='+hoje+'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { Authorization: FOODY_TOKEN, 'Content-Type': 'application/json' });
    console.log('[FOODY]', r.status, hoje, r.body.length, 'bytes');
    if (r.status === 200 && hoje === hojeNoBrasil()) {
      dbQuery('INSERT INTO historico (data,foody_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET foody_json=$2,salvo_em=NOW()', [hoje, r.body]);
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(r.body);
  } catch(e) {
    console.log('[FOODY] erro:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ── Cardápio Web ──────────────────────────────────────────────
app.get('/api/cardapio', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();

  // se for data passada, tenta banco primeiro
  if (hoje !== hojeNoBrasil()) {
    const cached = await dbQuery('SELECT cw_json FROM historico WHERE data=$1', [hoje]);
    if (cached?.rows[0]?.cw_json) {
      console.log('[CW] do banco:', hoje);
      res.setHeader('Content-Type', 'application/json');
      return res.send(cached.rows[0].cw_json);
    }
  }

  const url = 'https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date='+hoje+'T00:00:00-03:00&end_date='+hoje+'T23:59:59-03:00';
  try {
    // tenta até 3x com espera de 65s se der rate limit
    let result = null;
    for (let t = 1; t <= 3; t++) {
      const r = await httpGet(url, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' });
      const data = tryJSON(r.body, 'CW');
      if (data) { result = { status: r.status, body: r.body }; break; }
      console.log('[CW] rate limit tentativa', t, '— aguardando 65s');
      if (t < 3) await sleep(65000);
    }
    if (!result) return res.status(429).json({ erro: 'Rate limit — tente em 1 minuto' });
    console.log('[CW]', result.status, hoje, result.body.length, 'bytes');
    if (result.status === 200 && hoje === hojeNoBrasil()) {
      dbQuery('INSERT INTO historico (data,cw_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET cw_json=$2,salvo_em=NOW()', [hoje, result.body]);
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(result.body);
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
    const resultados = await Promise.all(lote.map(async id => {
      try {
        const r = await httpGet('https://integracao.cardapioweb.com/api/partner/v1/orders/'+id, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' });
        return tryJSON(r.body, 'CW-DET');
      } catch(e) { return null; }
    }));
    pedidos.push(...resultados.filter(Boolean));
    if (i + 4 < ids.length) await sleep(65000);
  }

  const hoje = hojeNoBrasil();
  if (pedidos.length) {
    const existing = await dbQuery('SELECT det_json FROM historico WHERE data=$1', [hoje]);
    const detAtual = existing?.rows[0]?.det_json ? JSON.parse(existing.rows[0].det_json) : {};
    pedidos.forEach(p => { detAtual[p.id] = p; });
    dbQuery('INSERT INTO historico (data,det_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET det_json=$2', [hoje, JSON.stringify(detAtual)]);
  }
  res.json({ ok: true, pedidos });
});

// ── Histórico ─────────────────────────────────────────────────
app.get('/api/historico', async (req, res) => {
  const result = await dbQuery('SELECT data, salvo_em FROM historico ORDER BY data DESC LIMIT 15');
  if (!result) return res.json({ ok: false, erro: 'Banco não disponível', dias: [] });
  res.json({ ok: true, dias: result.rows });
});

app.get('/api/historico/:data', async (req, res) => {
  const result = await dbQuery('SELECT foody_json, cw_json, det_json FROM historico WHERE data=$1', [req.params.data]);
  if (!result?.rows.length) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
  const row = result.rows[0];
  res.json({
    ok: true,
    foody: row.foody_json ? JSON.parse(row.foody_json) : [],
    cw:    row.cw_json    ? JSON.parse(row.cw_json)    : {},
    det:   row.det_json   ? JSON.parse(row.det_json)   : {}
  });
});

app.get('/health', (_, res) => res.json({ ok: true, db: !!pool }));
app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log('🍕 rodando na porta', PORT));
