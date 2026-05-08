const express = require('express');
const https   = require('https');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const FOODY_TOKEN = process.env.FOODY_TOKEN || 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = process.env.CW_TOKEN    || 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';

app.use(express.static(path.join(__dirname, 'public')));

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: 'GET',
      headers: { ...headers, 'User-Agent': 'painel-pizza/1.0' },
      timeout: 25000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON inválido: ' + body.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout na requisição')); });
    req.end();
  });
}

app.get('/api/foody', async (req, res) => {
  const hoje  = req.query.date || new Date().toISOString().slice(0, 10);
  const start = encodeURIComponent(`${hoje}T00:00:00-03:00`);
  const end   = encodeURIComponent(`${hoje}T23:59:59-03:00`);
  const url   = `https://app.foodydelivery.com/rest/1.2/orders?startDate=${start}&endDate=${end}`;
  try {
    const data = await httpGet(url, { 'Authorization': FOODY_TOKEN, 'Content-Type': 'application/json;charset=UTF-8' });
    res.json({ ok: true, data });
  } catch (e) {
    console.error('[Foody] Erro:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/cardapio', async (req, res) => {
  const hoje  = req.query.date || new Date().toISOString().slice(0, 10);
  const start = encodeURIComponent(`${hoje}T00:00:00-03:00`);
  const end   = encodeURIComponent(`${hoje}T23:59:59-03:00`);
  const url   = `https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date=${start}&end_date=${end}`;
  try {
    const data = await httpGet(url, { 'X-API-KEY': CW_TOKEN, 'Accept': 'application/json' });
    res.json({ ok: true, data });
  } catch (e) {
    console.error('[CW] Erro:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🍕 Painel Pizza Hollywood rodando na porta ${PORT}`));
