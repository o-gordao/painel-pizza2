const express = require('express');
const https   = require('https');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

const FOODY_TOKEN = process.env.FOODY_TOKEN || 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = process.env.CW_TOKEN    || 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';

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

app.get('/api/foody', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  const url  = 'https://app.foodydelivery.com/rest/1.2/orders?startDate=' + hoje + 'T00:00:00-03:00&endDate=' + hoje + 'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { Authorization: FOODY_TOKEN, 'Content-Type': 'application/json' });
    console.log('[FOODY]', r.status, hoje);
    res.setHeader('Content-Type', 'application/json');
    res.send(r.body);
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/cardapio', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  const url  = 'https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date=' + hoje + 'T00:00:00-03:00&end_date=' + hoje + 'T23:59:59-03:00';
  try {
    const r = await httpGet(url, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' });
    console.log('[CW]', r.status, hoje);
    res.setHeader('Content-Type', 'application/json');
    res.send(r.body);
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log('rodando na porta', PORT));
