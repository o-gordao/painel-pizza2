const express = require('express');
const https   = require('https');
const path    = require('path');
const { Pool } = require('pg');
const app  = express();
const PORT = process.env.PORT || 3000;

const FOODY_TOKEN = process.env.FOODY_TOKEN || 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = process.env.CW_TOKEN    || 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';

// ── banco de dados ────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS historico (
      data        DATE PRIMARY KEY,
      foody_json  TEXT,
      cw_json     TEXT,
      det_json    TEXT,
      salvo_em    TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('[DB] tabela histórico pronta');
}

// ── helpers ───────────────────────────────────────────────────
function hojeNoBrasil() {
  const d = new Date();
  d.setHours(d.getHours() - 3);
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

// ── Foody ─────────────────────────────────────────────────────
app.get('/api/foody', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  const url  = 'https://app.foodydelivery.com/rest/1.2/orders?startDate='+hoje+'T00:00:00-03:00&endDate='+hoje+'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { Authorization: FOODY_TOKEN, 'Content-Type': 'application/json' });
    console.log('[FOODY]', r.status, hoje);
    // salvar no banco se for hoje
    if (hoje === hojeNoBrasil() && r.status === 200) {
      await pool.query(
        'INSERT INTO historico (data, foody_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET foody_json=$2, salvo_em=NOW()',
        [hoje, r.body]
      );
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(r.body);
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── Cardápio Web ──────────────────────────────────────────────
app.get('/api/cardapio', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  const url  = 'https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date='+hoje+'T00:00:00-03:00&end_date='+hoje+'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' });
    console.log('[CW]', r.status, hoje);
    if (hoje === hojeNoBrasil() && r.status === 200) {
      await pool.query(
        'INSERT INTO historico (data, cw_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET cw_json=$2, salvo_em=NOW()',
        [hoje, r.body]
      );
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(r.body);
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── Detalhes CW com rate limit ────────────────────────────────
app.get('/api/cardapio/detalhes', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (!ids.length) return res.json({ ok: true, pedidos: [] });

  const pedidos = [];
  for (let i = 0; i < ids.length; i += 4) {
    const lote = ids.slice(i, i + 4);
    const resultados = await Promise.all(lote.map(async id => {
      try {
        const r = await httpGet('https://integracao.cardapioweb.com/api/partner/v1/orders/'+id, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' });
        return r.status === 200 ? JSON.parse(r.body) : null;
      } catch(e) { return null; }
    }));
    pedidos.push(...resultados.filter(Boolean));
    if (i + 4 < ids.length) await sleep(65000);
  }

  // salvar detalhes no banco para o dia de hoje
  const hoje = hojeNoBrasil();
  if (pedidos.length) {
    const existing = await pool.query('SELECT det_json FROM historico WHERE data=$1', [hoje]);
    const detAtual = existing.rows[0]?.det_json ? JSON.parse(existing.rows[0].det_json) : {};
    pedidos.forEach(p => { detAtual[p.id] = p; });
    await pool.query(
      'INSERT INTO historico (data, det_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET det_json=$2',
      [hoje, JSON.stringify(detAtual)]
    );
  }

  res.json({ ok: true, pedidos });
});

// ── Histórico: lista dos últimos 15 dias ──────────────────────
app.get('/api/historico', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT data, salvo_em FROM historico ORDER BY data DESC LIMIT 15'
    );
    res.json({ ok: true, dias: result.rows });
  } catch(e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

// ── Histórico: dados de um dia específico ─────────────────────
app.get('/api/historico/:data', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT foody_json, cw_json, det_json FROM historico WHERE data=$1',
      [req.params.data]
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, erro: 'Dia não encontrado' });
    const row = result.rows[0];
    res.json({
      ok: true,
      foody: row.foody_json ? JSON.parse(row.foody_json) : [],
      cw:    row.cw_json    ? JSON.parse(row.cw_json)    : {},
      det:   row.det_json   ? JSON.parse(row.det_json)   : {}
    });
  } catch(e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, 'public')));

initDB().then(() => {
  app.listen(PORT, () => console.log('🍕 rodando na porta', PORT));
}).catch(e => {
  console.error('[DB] erro ao iniciar:', e.message);
  app.listen(PORT, () => console.log('🍕 rodando SEM banco na porta', PORT));
});
