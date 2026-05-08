const https = require('https');
const PORT  = process.env.PORT || 3000;
const TOKEN = 'b98e63d4a1ab4076934272af225c1b2e';

function hojeNoBrasil() {
  // Pega a data atual no fuso de Brasília (UTC-3)
  const agora = new Date();
  agora.setHours(agora.getHours() - 3);
  return agora.toISOString().slice(0, 10);
}

function buscarPedidos() {
  const hoje = hojeNoBrasil();
  const url  = 'https://app.foodydelivery.com/rest/1.2/orders?startDate=' + hoje + 'T00:00:00-03:00&endDate=' + hoje + 'T23:59:59-03:00';

  console.log('--- buscando pedidos ---');
  console.log('data brasil:', hoje);
  console.log('url:', url);

  https.get(url, { headers: { Authorization: TOKEN, 'Content-Type': 'application/json' } }, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('status HTTP:', res.statusCode);
      try {
        const pedidos = JSON.parse(body);
        console.log('total de pedidos:', pedidos.length);
        pedidos.forEach((p, i) => {
          console.log(`pedido ${i+1}: #${p.id} | ${p.status} | R$ ${p.orderTotal} | entregador: ${p.courier ? p.courier.courierName : 'sem entregador'}`);
        });
      } catch(e) {
        console.log('resposta raw:', body.slice(0, 300));
      }
    });
  }).on('error', err => {
    console.log('ERRO:', err.message);
  });
}

buscarPedidos();
setInterval(buscarPedidos, 60000);

require('http').createServer((_, res) => res.end('ok')).listen(PORT, () => {
  console.log('servidor rodando na porta', PORT);
});
