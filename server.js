const express = require('express');
const https   = require('https');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

const FOODY_TOKEN = process.env.FOODY_TOKEN || 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = process.env.CW_TOKEN    || 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';

// ── helpers ──────────────────────────────────────────────────
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Foody: lista do dia ───────────────────────────────────────
app.get('/api/foody', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  const url  = 'https://app.foodydelivery.com/rest/1.2/orders?startDate=' + hoje + 'T00:00:00-03:00&endDate=' + hoje + 'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { Authorization: FOODY_TOKEN, 'Content-Type': 'application/json' });
    console.log('[FOODY] status:', r.status, hoje);
    res.setHeader('Content-Type', 'application/json');
    res.send(r.body);
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── Cardápio Web: histórico do dia ───────────────────────────
app.get('/api/cardapio', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  const url  = 'https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date=' + hoje + 'T00:00:00-03:00&end_date=' + hoje + 'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' });
    console.log('[CW] status:', r.status, hoje);
    res.setHeader('Content-Type', 'application/json');
    res.send(r.body);
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── Cardápio Web: detalhes com rate limit 5 req/min ──────────
// Busca detalhes de uma lista de IDs em lotes de 4, com delay de 65s entre lotes
app.get('/api/cardapio/detalhes', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (!ids.length) return res.json({ ok: true, pedidos: [] });

  console.log('[CW-DET] buscando detalhes de', ids.length, 'pedidos');

  const pedidos = [];
  const LOTE = 4;          // 4 req por vez
  const DELAY = 65 * 1000; // 65s entre lotes (respeitando 5/min)

  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);

    // busca o lote em paralelo
    const resultados = await Promise.all(lote.map(async id => {
      try {
        const url = 'https://integracao.cardapioweb.com/api/partner/v1/orders/' + id;
        const r   = await httpGet(url, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' });
        if (r.status === 200) {
          const data = JSON.parse(r.body);
          console.log('[CW-DET] #' + id, 'ok — delivered_by:', data.delivered_by);
          return data;
        }
        console.log('[CW-DET] #' + id, 'status:', r.status);
        return null;
      } catch(e) {
        console.log('[CW-DET] #' + id, 'erro:', e.message);
        return null;
      }
    }));

    pedidos.push(...resultados.filter(Boolean));

    // delay entre lotes (exceto no último)
    if (i + LOTE < ids.length) {
      console.log('[CW-DET] aguardando 65s antes do próximo lote...');
      await sleep(DELAY);
    }
  }

  console.log('[CW-DET] concluído:', pedidos.length, '/', ids.length, 'pedidos');
  res.json({ ok: true, pedidos });
});

app.get('/health', (_, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log('🍕 rodando na porta', PORT));
