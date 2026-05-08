const express = require('express');
const https   = require('https');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

const FOODY_TOKEN = process.env.FOODY_TOKEN || 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = process.env.CW_TOKEN    || 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';
const MP_TOKEN    = process.env.MP_TOKEN    || 'APP_USR-6810969181774493-050818-bf3a137b13e1fcfc41c0d42eb1dffbf2-2493027197';

// ── banco OPCIONAL ────────────────────────────────────────────
let pool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    pool.query('SELECT 1')
      .then(() => pool.query(`
        CREATE TABLE IF NOT EXISTS historico (
          data DATE PRIMARY KEY, foody_json TEXT, cw_json TEXT, det_json TEXT, salvo_em TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS pagamentos_mp (
          id BIGINT PRIMARY KEY,
          valor NUMERIC(10,2),
          status VARCHAR(50),
          metodo VARCHAR(50),
          criado_em TIMESTAMP,
          descricao TEXT,
          raw_json TEXT,
          recebido_em TIMESTAMP DEFAULT NOW()
        );
      `))
      .then(() => console.log('[DB] pronto'))
      .catch(e => { console.log('[DB] erro:', e.message); pool = null; });
  } catch(e) {
    console.log('[DB] indisponível:', e.message);
  }
}

async function dbSave(sql, params) {
  if (!pool) return;
  try { await pool.query(sql, params); } catch(e) { console.log('[DB] save erro:', e.message); }
}
async function dbGet(sql, params) {
  if (!pool) return null;
  try { return await pool.query(sql, params); } catch(e) { console.log('[DB] get erro:', e.message); return null; }
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
  if (hoje !== hojeNoBrasil()) {
    const r = await dbGet('SELECT foody_json FROM historico WHERE data=$1', [hoje]);
    if (r?.rows[0]?.foody_json) { res.setHeader('Content-Type','application/json'); return res.send(r.rows[0].foody_json); }
  }
  const url = 'https://app.foodydelivery.com/rest/1.2/orders?startDate='+hoje+'T00:00:00-03:00&endDate='+hoje+'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { Authorization: FOODY_TOKEN, 'Content-Type': 'application/json' }, 15000);
    console.log('[FOODY]', r.status, hoje);
    if (r.status === 200) dbSave('INSERT INTO historico (data,foody_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET foody_json=$2,salvo_em=NOW()', [hoje, r.body]);
    res.setHeader('Content-Type', 'application/json'); res.send(r.body);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ── Cardápio Web ──────────────────────────────────────────────
app.get('/api/cardapio', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  if (hoje !== hojeNoBrasil()) {
    const r = await dbGet('SELECT cw_json FROM historico WHERE data=$1', [hoje]);
    if (r?.rows[0]?.cw_json) { res.setHeader('Content-Type','application/json'); return res.send(r.rows[0].cw_json); }
  }
  const url = 'https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date='+hoje+'T00:00:00-03:00&end_date='+hoje+'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' }, 15000);
    const data = tryJSON(r.body);
    if (!data) return res.status(429).json({ erro: 'rate_limit', msg: 'Cardápio Web indisponível' });
    console.log('[CW]', r.status, hoje);
    if (r.status === 200) dbSave('INSERT INTO historico (data,cw_json) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET cw_json=$2,salvo_em=NOW()', [hoje, r.body]);
    res.setHeader('Content-Type', 'application/json'); res.send(r.body);
  } catch(e) { res.status(500).json({ erro: e.message }); }
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
  res.json({ ok: true, foody: tryJSON(row.foody_json)||[], cw: tryJSON(row.cw_json)||{}, det: tryJSON(row.det_json)||{} });
});

// ── Mercado Pago Webhook ──────────────────────────────────────
app.use(express.json());

app.post('/webhook/mp', async (req, res) => {
  res.sendStatus(200); // responde imediatamente ao MP
  const body = req.body;
  console.log('[MP WEBHOOK] type:', body.type, JSON.stringify(body).slice(0, 300));

  try {
    // ── Maquininha Point: IPN direto (sem type, tem payment.state) ─
    if (body.payment && body.amount && body.caller_id) {
      const state = body.payment.state || '';
      if (!['approved','accredited'].includes(state)) {
        console.log('[MP POINT IPN] ignorado, state:', state);
        return;
      }
      const valor    = parseFloat(body.amount) / 100; // em centavos
      const metodo   = body.payment.payment_method_id || 'credit_card';
      const criadoEm = body.created_at || new Date().toISOString();
      const pgId     = String(body.payment.id || body.id);

      console.log('[MP POINT IPN] pagamento R$', valor, metodo, pgId);

      await dbSave(
        'INSERT INTO pagamentos_mp (id, valor, status, metodo, criado_em, descricao, raw_json) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
        [pgId, valor, state, metodo, criadoEm, body.additional_info?.external_reference||'', JSON.stringify(body)]
      );
      broadcastPagamento({ id: pgId, valor, metodo, criadoEm });
      return;
    }

    // ── Maquininha Point: type=order ──────────────────────────
    if (body.type === 'order' && body.data) {
      const order = body.data;
      if (!['processed','approved'].includes(order.status)) return;
      const payments = order.transactions?.payments || [];
      for (const pg of payments) {
        if (!['processed','approved','accredited'].includes(pg.status)) continue;
        const valor    = parseFloat(pg.amount) / 100;
        const metodo   = pg.payment_method?.type || 'credit_card';
        const criadoEm = body.date_created || new Date().toISOString();
        const pgId     = pg.id || (order.id + '_' + (pg.reference?.id||''));
        console.log('[MP ORDER] pagamento R$', valor, metodo, pgId);
        await dbSave(
          'INSERT INTO pagamentos_mp (id, valor, status, metodo, criado_em, descricao, raw_json) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
          [pgId, valor, pg.status, metodo, criadoEm, order.external_reference||'', JSON.stringify(body)]
        );
        broadcastPagamento({ id: pgId, valor, metodo, criadoEm });
      }
      return;
    }

    // ── Pagamento online: type=payment ────────────────────────
    if (body.type === 'payment' && body.data?.id) {
      const r = await httpGet(
        'https://api.mercadopago.com/v1/payments/' + body.data.id,
        { Authorization: 'Bearer ' + MP_TOKEN, 'Content-Type': 'application/json' },
        10000
      );
      const pg = tryJSON(r.body);
      if (!pg || pg.status !== 'approved') return;

      const valor    = parseFloat(pg.transaction_amount);
      const metodo   = pg.payment_type_id;
      const criadoEm = pg.date_approved || pg.date_created;

      console.log('[MP PAYMENT] pagamento R$', valor, metodo);

      await dbSave(
        'INSERT INTO pagamentos_mp (id, valor, status, metodo, criado_em, descricao, raw_json) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
        [pg.id, valor, pg.status, metodo, criadoEm, pg.description||'', r.body]
      );

      broadcastPagamento({ id: pg.id, valor, metodo, criadoEm });
      return;
    }

    console.log('[MP] evento ignorado:', body.type);

  } catch(e) {
    console.log('[MP] erro ao processar:', e.message);
  }
});

// ── SSE — notificações em tempo real para o painel ────────────
const sseClients = new Set();

app.get('/api/mp/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('data: {"tipo":"conectado"}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcastPagamento(dados) {
  const msg = 'data: ' + JSON.stringify({ tipo: 'pagamento', ...dados }) + '\n\n';
  sseClients.forEach(client => { try { client.write(msg); } catch(e) {} });
}

// ── Pagamentos MP recentes ────────────────────────────────────
app.get('/api/mp/pagamentos', async (req, res) => {
  const hoje = hojeNoBrasil();
  const r = await dbGet(
    "SELECT id, valor, metodo, criado_em, descricao FROM pagamentos_mp WHERE criado_em::date = $1 ORDER BY criado_em DESC",
    [hoje]
  );
  res.json({ ok: true, pagamentos: r?.rows || [] });
});

app.get('/health', (_, res) => res.json({ ok: true, db: !!pool }));
app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log('🍕 rodando na porta', PORT));
// já completo acima
