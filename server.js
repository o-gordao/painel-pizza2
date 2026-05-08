const express = require('express');
const https   = require('https');
const app     = express();
const PORT    = process.env.PORT || 3000;

const TOKEN = 'b98e63d4a1ab4076934272af225c1b2e';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: TOKEN } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

app.get('/', async (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const url  = 'https://app.foodydelivery.com/rest/1.2/orders?startDate=' + hoje + 'T00:00:00-03:00&endDate=' + hoje + 'T23:59:59-03:00';
  console.log('buscando:', url);
  try {
    const data = await get(url);
    console.log('resposta recebida, tamanho:', data.length);
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (e) {
    console.error('erro:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

app.listen(PORT, () => console.log('rodando na porta', PORT));
