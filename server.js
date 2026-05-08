const https = require('https');
const PORT  = process.env.PORT || 3000;
const TOKEN = 'b98e63d4a1ab4076934272af225c1b2e';

function buscarPedidos() {
  const hoje = new Date().toISOString().slice(0, 10);
  const url  = 'https://app.foodydelivery.com/rest/1.2/orders?startDate=' + hoje + 'T00:00:00-03:00&endDate=' + hoje + 'T23:59:59-03:00';

  console.log('--- buscando pedidos ---');
  console.log('url:', url);

  https.get(url, { headers: { Authorization: TOKEN, 'Content-Type': 'application/json' } }, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('status HTTP:', res.statusCode);
      console.log('resposta:', body.slice(0, 500));
    });
  }).on('error', err => {
    console.log('ERRO:', err.message);
  });
}

// busca na inicialização e a cada 60 segundos
buscarPedidos();
setInterval(buscarPedidos, 60000);

// servidor mínimo só para o Railway não derrubar o processo
require('http').createServer((_, res) => res.end('ok')).listen(PORT, () => {
  console.log('servidor rodando na porta', PORT);
});
