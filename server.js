const express = require('express');
const https   = require('https');
const app     = express();
const PORT    = process.env.PORT || 3000;

const FOODY_TOKEN = process.env.FOODY_TOKEN || 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = process.env.CW_TOKEN    || 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { ...headers, 'User-Agent': 'Mozilla/5.0' },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: null, raw: body.slice(0,300) }); }
      });
    });
    req.on('error', e => reject(e));
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

app.get('/api/foody', async (req, res) => {
  const date  = req.query.date || new Date().toISOString().slice(0,10);
  const start = encodeURIComponent(date + 'T00:00:00-03:00');
  const end   = encodeURIComponent(date + 'T23:59:59-03:00');
  const url   = `https://app.foodydelivery.com/rest/1.2/orders?startDate=${start}&endDate=${end}`;
  console.log('[FOODY] GET', url);
  try {
    const r = await httpGet(url, { 'Authorization': FOODY_TOKEN, 'Content-Type': 'application/json;charset=UTF-8' });
    console.log('[FOODY] status', r.status, 'items', Array.isArray(r.data) ? r.data.length : typeof r.data);
    res.json({ ok: r.status === 200, data: r.data, status: r.status });
  } catch(e) {
    console.error('[FOODY] erro:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/cardapio', async (req, res) => {
  const date  = req.query.date || new Date().toISOString().slice(0,10);
  const start = encodeURIComponent(date + 'T00:00:00-03:00');
  const end   = encodeURIComponent(date + 'T23:59:59-03:00');
  const url   = `https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date=${start}&end_date=${end}`;
  console.log('[CW] GET', url);
  try {
    const r = await httpGet(url, { 'X-API-KEY': CW_TOKEN, 'Accept': 'application/json' });
    console.log('[CW] status', r.status);
    res.json({ ok: r.status === 200, data: r.data, status: r.status });
  } catch(e) {
    console.error('[CW] erro:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use(express.static(__dirname + '/public'));

app.listen(PORT, () => console.log('🍕 Rodando na porta', PORT));
