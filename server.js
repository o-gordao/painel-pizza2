const https = require('https');
const PORT  = process.env.PORT || 3000;

const FOODY_TOKEN = 'b98e63d4a1ab4076934272af225c1b2e';
const CW_TOKEN    = 'bhpnfiscTLCLeA7NDA8NP1pKcV8Lo8Wxyg5pAivu';

function hojeNoBrasil() {
  const agora = new Date();
  agora.setHours(agora.getHours() - 3);
  return agora.toISOString().slice(0, 10);
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

async function buscar() {
  const hoje = hojeNoBrasil();
  console.log('\n========== buscando dados ==========');
  console.log('data brasil:', hoje);

  // --- FOODY ---
  try {
    const url = 'https://app.foodydelivery.com/rest/1.2/orders?startDate=' + hoje + 'T00:00:00-03:00&endDate=' + hoje + 'T23:59:59-03:00';
    const r   = await httpGet(url, { Authorization: FOODY_TOKEN, 'Content-Type': 'application/json' });
    const dados = JSON.parse(r.body);
    console.log('[FOODY] status:', r.status, '| pedidos:', dados.length);
    dados.slice(0, 3).forEach(p => console.log('  #' + p.id, p.status, 'R$' + p.orderTotal, p.courier?.courierName || ''));
  } catch(e) {
    console.log('[FOODY] ERRO:', e.message);
  }

  // --- CARDÁPIO WEB ---
  try {
    const url = 'https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date=' + hoje + 'T00:00:00-03:00&end_date=' + hoje + 'T23:59:59-03:00';
    const r   = await httpGet(url, { 'X-API-KEY': CW_TOKEN, Accept: 'application/json' });
    const dados = JSON.parse(r.body);
    const pedidos = dados.orders || dados;
    console.log('[CARDAPIO WEB] status:', r.status, '| pedidos:', Array.isArray(pedidos) ? pedidos.length : JSON.stringify(dados).slice(0,100));
    if (Array.isArray(pedidos)) {
      pedidos.slice(0, 3).forEach(p => console.log('  #' + p.id, p.status, p.sales_channel));
    }
  } catch(e) {
    console.log('[CARDAPIO WEB] ERRO:', e.message);
  }

  console.log('=====================================');
}

buscar();
setInterval(buscar, 60000);

require('http').createServer((_, res) => res.end('ok')).listen(PORT, () => {
  console.log('servidor rodando na porta', PORT);
});
