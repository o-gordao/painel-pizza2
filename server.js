const express = require('express');
const https   = require('https');
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

// ── API routes ────────────────────────────────────────────────
app.get('/api/foody', async (req, res) => {
  const hoje = req.query.date || hojeNoBrasil();
  const url  = `https://app.foodydelivery.com/rest/1.2/orders?startDate=${hoje}T00:00:00-03:00&endDate=${hoje}T23:59:59-03:00`;
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
  const url  = `https://integracao.cardapioweb.com/api/partner/v1/orders/history?start_date=${hoje}T00:00:00-03:00&end_date=${hoje}T23:59:59-03:00`;
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

// ── dashboard ─────────────────────────────────────────────────
app.get('/', (_, res) => res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fechamento — Disck Pizza Hollywood</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<style>
:root{--bg:#0f0f0f;--bg2:#181818;--bg3:#222;--border:#2a2a2a;--border2:#333;--text:#f0f0f0;--muted:#888;--accent:#e8452c;--green:#2ecc71;--yellow:#f1c40f;--blue:#3498db}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);font-size:14px}
.hdr{background:var(--bg2);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;flex-wrap:wrap;gap:8px}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:34px;height:34px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:17px}
.logo-text{font-size:15px;font-weight:600}
.logo-sub{font-size:11px;color:var(--muted);font-family:'DM Mono',monospace}
.hdr-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.badge{font-size:11px;padding:3px 9px;border-radius:20px;font-family:'DM Mono',monospace}
.bg{background:rgba(46,204,113,.15);color:var(--green);border:1px solid rgba(46,204,113,.3)}
.br{background:rgba(232,69,44,.15);color:#ff6b4a;border:1px solid rgba(232,69,44,.3)}
.by{background:rgba(241,196,15,.15);color:var(--yellow);border:1px solid rgba(241,196,15,.3)}
.btn{padding:7px 13px;border-radius:6px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;display:inline-flex;align-items:center;gap:5px;transition:background .15s}
.btn:hover{background:#2a2a2a}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-a{background:var(--accent);border-color:var(--accent);color:#fff}
.spin{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.main{padding:24px;max-width:1400px;margin:0 auto}
.topbar{display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;margin-bottom:20px;flex-wrap:wrap;gap:8px}
.tb-info{font-size:12px;color:var(--muted)}
.tb-info strong{color:var(--text)}
.cd{font-family:'DM Mono',monospace;font-size:11px;color:var(--muted)}
.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:24px}
.metric{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px}
.ml{font-size:11px;color:var(--muted);margin-bottom:5px}
.mv{font-size:21px;font-weight:600}
.ms{font-size:11px;color:var(--muted);margin-top:2px;font-family:'DM Mono',monospace}
.ma{border-color:rgba(232,69,44,.4)}
.ma .mv{color:#ff6b4a}
.tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:20px;overflow-x:auto}
.tab{padding:9px 16px;cursor:pointer;font-size:13px;color:var(--muted);border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;white-space:nowrap;transition:all .15s}
.tab.on{color:var(--text);border-bottom-color:var(--accent)}
.panel{display:none}
.panel.on{display:block}
.cg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.cc{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px}
.cc-h{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;flex-shrink:0}
.cn{font-size:13px;font-weight:500}
.co{font-size:11px;color:var(--muted);font-family:'DM Mono',monospace}
.cs2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sb{background:var(--bg3);border-radius:6px;padding:9px 11px}
.sl{font-size:10px;color:var(--muted);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px}
.sv{font-size:14px;font-weight:600;font-family:'DM Mono',monospace}
.sv.g{color:var(--green)}
.sv.y{color:var(--yellow)}
.fb{margin-top:9px}
.fbl{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:2px}
.fbt{background:var(--bg3);border-radius:3px;height:4px}
.fbf{height:4px;border-radius:3px}
.tw{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.th{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:8px 12px;font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;letter-spacing:.5px;text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--bg3)}
td{padding:10px 12px;font-size:12px;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}
.mn{font-family:'DM Mono',monospace}
.p{font-size:10px;padding:2px 6px;border-radius:20px;display:inline-block}
.pg{background:rgba(46,204,113,.12);color:var(--green)}
.pr{background:rgba(232,69,44,.12);color:#ff6b4a}
.pb{background:rgba(52,152,219,.12);color:var(--blue)}
.py{background:rgba(241,196,15,.12);color:var(--yellow)}
.pgr{background:rgba(255,255,255,.06);color:var(--muted)}
.si{background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:6px 9px;border-radius:6px;font-size:12px;font-family:'DM Sans',sans-serif;outline:none;width:170px}
.cg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.chc{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px}
.cht{font-size:11px;color:var(--muted);margin-bottom:12px;font-family:'DM Mono',monospace}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.sc{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px}
.sr{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px}
.sr:last-child{border-bottom:none}
.sr .lb{color:var(--muted)}
.sr .vl{font-family:'DM Mono',monospace;font-weight:500}
.stot{display:flex;justify-content:space-between;align-items:center;padding:9px 0 0;font-size:15px;font-weight:600}
hr.d{border:none;border-top:1px solid var(--border);margin:5px 0}
.cbr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px}
.fg{display:flex;gap:6px;align-items:center}
.fl2{font-size:12px;color:var(--muted)}
.fb2{padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:var(--bg3);color:var(--muted);cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;transition:all .15s}
.fb2.on{background:var(--accent);border-color:var(--accent);color:#fff}
.fb2:hover:not(.on){border-color:#555;color:var(--text)}
.bp{padding:7px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:7px}
.bp:hover{background:#2a2a2a}
.bc{background:var(--accent);color:#fff;border-radius:20px;padding:2px 7px;font-size:11px;font-weight:600}
.cst{display:flex;gap:16px;padding:9px 16px;border-bottom:1px solid var(--border);background:var(--bg3);flex-wrap:wrap}
.css{font-size:12px;color:var(--muted)}
.css strong{color:var(--text);font-family:'DM Mono',monospace}
.chk{width:19px;height:19px;border-radius:4px;border:2px solid var(--border2);background:var(--bg3);cursor:pointer;appearance:none;transition:all .15s;display:block;margin:0 auto;position:relative}
.chk:checked{background:var(--green);border-color:var(--green)}
.chk:checked::after{content:'✓';color:#fff;font-size:11px;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}
.okr td{background:rgba(46,204,113,.07)!important}
.okr:hover td{background:rgba(46,204,113,.12)!important}
.ppill{font-size:11px;padding:3px 7px;border-radius:20px;display:inline-flex;align-items:center}
.ppo{background:rgba(52,152,219,.15);color:#3498db;border:1px solid rgba(52,152,219,.3)}
.ppc{background:rgba(241,196,15,.15);color:#f1c40f;border:1px solid rgba(241,196,15,.3)}
.ppm{background:rgba(46,204,113,.15);color:#2ecc71;border:1px solid rgba(46,204,113,.3)}
.ep{background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:2px 4px;border-radius:4px}
.ep:hover{color:var(--text);background:var(--bg3)}
.hid{display:none!important}
.modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.75);z-index:999;display:flex;align-items:center;justify-content:center}
.mb{background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:22px;max-width:500px;width:90%;max-height:70vh;overflow-y:auto}
.mt2{font-size:15px;font-weight:600;margin-bottom:4px}
.msub{font-size:12px;color:var(--muted);margin-bottom:12px}
.pi{padding:9px 11px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;font-size:12px}
.pit{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
.pid{font-family:'DM Mono',monospace;font-weight:600}
.piv{font-family:'DM Mono',monospace;color:#ff6b4a;font-weight:600}
.pii{color:var(--muted)}
.mf{display:flex;gap:8px;margin-top:12px}
.loader{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,15,15,.9);z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.loader-txt{font-size:15px}
.loader-sub{font-size:12px;color:var(--muted)}
</style>
</head>
<body>

<div id="loader" class="loader">
  <div style="font-size:36px">🍕</div>
  <div class="loader-txt"><span class="spin"></span> Carregando dados...</div>
  <div class="loader-sub" id="loader-sub">Conectando às APIs</div>
</div>

<div class="hdr">
  <div class="logo">
    <div class="logo-icon">🍕</div>
    <div>
      <div class="logo-text">Disck Pizza Hollywood</div>
      <div class="logo-sub" id="logo-sub">fechamento de caixa</div>
    </div>
  </div>
  <div class="hdr-right">
    <span class="badge bg">● foody delivery</span>
    <span class="badge br">● cardápio web</span>
    <span class="badge by" id="badge-att">⏳ carregando</span>
    <button class="btn" id="btn-ref" onclick="carregar(true)">🔄 atualizar</button>
    <button class="btn" onclick="exportCSV()">⬇ CSV</button>
    <button class="btn btn-a" onclick="window.print()">🖨 imprimir</button>
  </div>
</div>

<div class="main">
  <div class="topbar">
    <div class="tb-info">Próxima atualização em <strong><span id="cd">60</span>s</strong> · automático a cada 60s</div>
    <div class="tb-info" id="tb-status">aguardando...</div>
  </div>

  <div class="metrics" id="mbox"></div>

  <div class="tabs">
    <button class="tab on" onclick="T('entregadores',this)">por entregador</button>
    <button class="tab" onclick="T('pedidos',this)">pedidos detalhados</button>
    <button class="tab" onclick="T('graficos',this)">gráficos</button>
    <button class="tab" onclick="T('fechamento',this)">fechamento final</button>
    <button class="tab" onclick="T('conferencia',this)">✓ conferência</button>
  </div>

  <div id="panel-entregadores" class="panel on"><div class="cg" id="cgrid"></div></div>

  <div id="panel-pedidos" class="panel">
    <div class="tw">
      <div class="th">
        <span style="font-size:13px;font-weight:500" id="tot-lbl">carregando...</span>
        <input class="si" type="text" placeholder="buscar..." oninput="filterT(this.value)">
      </div>
      <table><thead><tr>
        <th>pedido</th><th>cliente</th><th>item</th><th>entregador</th>
        <th>canal</th><th>pgto</th><th>taxa entregador</th><th>frete</th><th>total</th>
      </tr></thead><tbody id="otb"></tbody></table>
    </div>
  </div>

  <div id="panel-graficos" class="panel">
    <div class="cg2">
      <div class="chc"><div class="cht">vendas por entregador (R$)</div><div style="position:relative;height:240px"><canvas id="c1"></canvas></div></div>
      <div class="chc"><div class="cht">taxa por entregador (R$)</div><div style="position:relative;height:240px"><canvas id="c2"></canvas></div></div>
      <div class="chc"><div class="cht">forma de pagamento</div><div style="position:relative;height:240px"><canvas id="c3"></canvas></div></div>
      <div class="chc"><div class="cht">pedidos por entregador</div><div style="position:relative;height:240px"><canvas id="c4"></canvas></div></div>
    </div>
  </div>

  <div id="panel-fechamento" class="panel">
    <div class="sg">
      <div class="sc">
        <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">receita</div>
        <div class="sr"><span class="lb">total bruto pedidos</span><span class="vl" id="sb"></span></div>
        <div class="sr"><span class="lb">frete cobrado dos clientes</span><span class="vl" id="sf"></span></div>
        <hr class="d"><div class="stot"><span>total entrada</span><span id="se" style="color:var(--green)"></span></div>
      </div>
      <div class="sc">
        <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">saídas — entregadores</div>
        <div id="scr"></div>
        <hr class="d"><div class="stot"><span>total taxas</span><span id="stf" style="color:#ff6b4a"></span></div>
      </div>
    </div>
    <div class="sc">
      <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">fechamento</div>
      <div class="sr"><span class="lb">total vendas (bruto)</span><span class="vl" id="fv"></span></div>
      <div class="sr"><span class="lb">(-) taxas entregadores</span><span class="vl" id="ff" style="color:#ff6b4a"></span></div>
      <div class="sr"><span class="lb">pedidos finalizados</span><span class="vl" id="fp"></span></div>
      <div class="sr"><span class="lb">ticket médio</span><span class="vl" id="ft"></span></div>
      <div class="sr"><span class="lb">maior pedido</span><span class="vl" id="fm"></span></div>
      <div class="sr"><span class="lb">pedidos online</span><span class="vl" id="fo"></span></div>
      <div class="sr"><span class="lb">pedidos cartão</span><span class="vl" id="fc"></span></div>
      <div class="sr"><span class="lb">pedidos dinheiro</span><span class="vl" id="fd"></span></div>
      <hr class="d"><div class="stot" style="font-size:17px"><span>resultado líquido estimado</span><span id="fl" style="color:var(--green)"></span></div>
    </div>
  </div>

  <div id="panel-conferencia" class="panel">
    <div class="cbr">
      <div class="fg">
        <span class="fl2">filtrar:</span>
        <button class="fb2" onclick="filtC('card',this)">Cartão</button>
        <button class="fb2" onclick="filtC('money',this)">Dinheiro</button>
        <button class="fb2" onclick="filtC('online',this)">Pg. Online</button>
      </div>
      <button class="bp" onclick="openM()">📋 Pendências <span class="bc" id="pcnt">0</span></button>
    </div>
    <div class="tw">
      <div class="cst">
        <div class="css">Total: <strong id="cst2"></strong></div>
        <div class="css">Conferidos: <strong id="cok" style="color:var(--green)"></strong></div>
        <div class="css">Pendentes: <strong id="cpd" style="color:#ff6b4a"></strong></div>
        <div class="css">Valor total: <strong id="cvl"></strong></div>
        <div class="css">Recebido: <strong id="crec" style="color:var(--green)"></strong></div>
        <div class="css">Pendente R$: <strong id="cpv" style="color:#ff6b4a"></strong></div>
      </div>
      <table><thead><tr>
        <th style="width:80px">pedido</th><th style="width:100px">status</th>
        <th style="width:130px">horário</th><th>entregador</th>
        <th style="width:155px">pagamento</th><th style="width:90px">valor</th>
        <th style="width:75px">troco</th><th style="width:45px;text-align:center">✓</th>
      </tr></thead><tbody id="ctb"></tbody></table>
    </div>
  </div>
</div>

<div class="modal hid" id="mpend" onclick="if(event.target===this)closeM()">
  <div class="mb">
    <div class="mt2">📋 Pendências de recebimento</div>
    <div class="msub" id="msub"></div>
    <div id="mitems"></div>
    <div class="mf">
      <button class="btn btn-a" onclick="copyM()">📋 copiar</button>
      <button class="btn" onclick="closeM()">fechar</button>
    </div>
  </div>
</div>

<div style="text-align:center;padding:18px;font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;border-top:1px solid var(--border);margin-top:24px">
  disck pizza hollywood · foody delivery + cardápio web · atualização automática
</div>

<script>
const R=v=>'R$ '+v.toFixed(2).replace('.',',');
const pct=(v,t)=>Math.round(v/t*100);
const COLS=['#e8452c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#e74c3c','#34495e'];
const pgtoMap={online:'online',card:'card',money:'money',pix:'online',e_wallet:'online',on_credit:'card'};

let PD=[], CS=[], CF=null, charts={}, cdVal=60, cdTimer=null;

function hojeNoBrasil(){
  const d=new Date(); d.setHours(d.getHours()-3); return d.toISOString().slice(0,10);
}

function startCD(){
  clearInterval(cdTimer); cdVal=60;
  document.getElementById('cd').textContent=cdVal;
  cdTimer=setInterval(()=>{
    cdVal--;
    document.getElementById('cd').textContent=cdVal;
    if(cdVal<=0){clearInterval(cdTimer);carregar(false);}
  },1000);
}

async function carregar(manual=false){
  const btn=document.getElementById('btn-ref');
  btn.disabled=true; btn.innerHTML='<span class="spin"></span> buscando...';
  document.getElementById('tb-status').innerHTML='<span class="spin"></span> atualizando...';
  const hoje=hojeNoBrasil();
  try{
    const [fRes,cRes]=await Promise.all([
      fetch('/api/foody?date='+hoje).then(r=>r.json()),
      fetch('/api/cardapio?date='+hoje).then(r=>r.json())
    ]);
    const foodyArr=Array.isArray(fRes)?fRes:[];
    const cwArr=Array.isArray(cRes?.orders)?cRes.orders:Array.isArray(cRes)?cRes:[];
    processar(foodyArr,cwArr,hoje);
    const agora=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    document.getElementById('badge-att').textContent='✓ '+agora;
    document.getElementById('logo-sub').textContent='fechamento · '+hoje.split('-').reverse().join('/');
    document.getElementById('tb-status').textContent='✓ '+PD.length+' pedidos · '+agora;
  }catch(e){
    document.getElementById('tb-status').textContent='⚠ erro: '+e.message;
  }
  btn.disabled=false; btn.innerHTML='🔄 atualizar';
  document.getElementById('loader').style.display='none';
  startCD();
}

function processar(foodyArr,cwArr,hoje){
  const novos=[];
  foodyArr.forEach(p=>{
    if(!['closed','delivered'].includes(p.status))return;
    const dt=p.date||p.creationDate||'';
    const hora=dt.length>=16?dt.substring(11,16):'--:--';
    let canal='ifood';
    for(const cw of cwArr){
      try{if(Math.abs(new Date(cw.created_at)-new Date(dt))/1000<90){canal=cw.sales_channel||'ifood';break;}}catch(e){}
    }
    novos.push({
      id:String(p.id),hora,status:p.status,
      dFee:+p.deliveryFee||0,
      pgto:pgtoMap[p.paymentMethod]||'online',
      cFee:+p.courierFee||0,
      tot:+p.orderTotal||0,
      courier:p.courier?.courierName||'Desconhecido',
      client:p.customer?.customerName||'—',
      item:p.orderDetails?(p.orderDetails.split('\\n')[0]):'—',
      canal,
    });
  });
  PD=novos;
  const confMap={};
  CS.forEach(p=>{if(p.conf)confMap[p.id]=true;});
  CS=PD.map(p=>({...p,conf:!!confMap[p.id],pgtoE:null}));
  render();
}

function render(){
  const TV=PD.reduce((a,p)=>a+p.tot,0);
  const TF=PD.reduce((a,p)=>a+p.cFee,0);
  const TFr=PD.reduce((a,p)=>a+p.dFee,0);
  const TM=PD.length?TV/PD.length:0;
  const MX=PD.length?Math.max(...PD.map(p=>p.tot)):0;
  const LQ=TV-TF;

  document.getElementById('mbox').innerHTML=[
    {l:'total pedidos',v:PD.length,s:'finalizados hoje',a:false},
    {l:'faturamento bruto',v:R(TV),s:'todos os pedidos',a:true},
    {l:'taxas entregadores',v:R(TF),s:'custo operacional',a:false},
    {l:'resultado líquido',v:R(LQ),s:'bruto - taxas',a:true},
    {l:'ticket médio',v:R(TM),s:'por pedido',a:false},
    {l:'maior pedido',v:R(MX),s:'valor unitário',a:false},
  ].map(m=>\`<div class="metric\${m.a?' ma':''}">\<div class="ml">\${m.l}</div><div class="mv">\${m.v}</div><div class="ms">\${m.s}</div></div>\`).join('');

  const CR={};
  PD.forEach(p=>{if(!CR[p.courier])CR[p.courier]={n:0,f:0,v:0};CR[p.courier].n++;CR[p.courier].f+=p.cFee;CR[p.courier].v+=p.tot;});
  const CL=Object.entries(CR).sort((a,b)=>b[1].f-a[1].f);
  const MF=CL.length?Math.max(...CL.map(([,d])=>d.f)):1;

  document.getElementById('cgrid').innerHTML=CL.map(([name,d],i)=>{
    const ini=name.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
    return \`<div class="cc"><div class="cc-h"><div class="av" style="background:\${COLS[i%COLS.length]}">\${ini}</div><div><div class="cn">\${name}</div><div class="co">\${d.n} pedido\${d.n>1?'s':''}</div></div></div><div class="cs2"><div class="sb"><div class="sl">taxa total</div><div class="sv y">\${R(d.f)}</div></div><div class="sb"><div class="sl">vendas</div><div class="sv g">\${R(d.v)}</div></div></div><div class="fb"><div class="fbl"><span>participação taxas</span><span>\${pct(d.f,TF||1)}%</span></div><div class="fbt"><div class="fbf" style="width:\${Math.round(d.f/(MF||1)*100)}%;background:\${COLS[i%COLS.length]}"></div></div></div></div>\`;
  }).join('');

  const cp=c=>({ifood:'<span class="p pr">iFood</span>',catalog:'<span class="p pb">Catálogo</span>',whatsapp_extension:'<span class="p pg">WhatsApp</span>'}[c]||\`<span class="p pgr">\${c}</span>\`);
  const pp=p=>({online:'<span class="p pb">online</span>',card:'<span class="p py">cartão</span>',money:'<span class="p pg">dinheiro</span>'}[p]||\`<span class="p pgr">\${p}</span>\`);
  document.getElementById('tot-lbl').textContent=PD.length+' pedidos finalizados';
  document.getElementById('otb').innerHTML=PD.map(p=>\`<tr><td class="mn" style="color:var(--muted)">#\${p.id}</td><td>\${p.client}</td><td style="color:var(--muted);max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${p.item}</td><td>\${p.courier.split(' ')[0]}</td><td>\${cp(p.canal)}</td><td>\${pp(p.pgto)}</td><td class="mn" style="color:var(--yellow)">\${R(p.cFee)}</td><td class="mn" style="color:var(--muted)">\${p.dFee>0?R(p.dFee):'—'}</td><td class="mn" style="font-weight:600">\${R(p.tot)}</td></tr>\`).join('');

  ['c1','c2','c3','c4'].forEach(id=>{if(charts[id]){charts[id].destroy();delete charts[id];}});
  const gN=CL.map(([n])=>n.split(' ')[0]);
  const gO=(cb)=>({responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#888',font:{size:10}}},y:{ticks:{color:'#888',font:{size:10},callback:cb},grid:{color:'#222'}}}});
  charts.c1=new Chart(document.getElementById('c1'),{type:'bar',data:{labels:gN,datasets:[{data:CL.map(([,d])=>+d.v.toFixed(2)),backgroundColor:CL.map((_,i)=>COLS[i%COLS.length]),borderRadius:4,borderWidth:0}]},options:gO(v=>'R$'+v)});
  charts.c2=new Chart(document.getElementById('c2'),{type:'bar',data:{labels:gN,datasets:[{data:CL.map(([,d])=>+d.f.toFixed(2)),backgroundColor:'#e8452c',borderRadius:4,borderWidth:0}]},options:gO(v=>'R$'+v)});
  const PC={online:0,card:0,money:0};PD.forEach(p=>{if(PC[p.pgto]!==undefined)PC[p.pgto]++;});
  charts.c3=new Chart(document.getElementById('c3'),{type:'doughnut',data:{labels:['Online','Cartão','Dinheiro'],datasets:[{data:Object.values(PC),backgroundColor:['#3498db','#f1c40f','#2ecc71'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#888',font:{size:11},boxWidth:10,padding:8}}}}});
  charts.c4=new Chart(document.getElementById('c4'),{type:'bar',data:{labels:gN,datasets:[{data:CL.map(([,d])=>d.n),backgroundColor:CL.map((_,i)=>COLS[i%COLS.length]),borderRadius:4,borderWidth:0}]},options:gO()});

  document.getElementById('sb').textContent=R(TV);document.getElementById('sf').textContent=R(TFr);document.getElementById('se').textContent=R(TV+TFr);
  document.getElementById('scr').innerHTML=CL.map(([n,d])=>\`<div class="sr"><span class="lb">\${n.split(' ')[0]} (\${d.n} ped.)</span><span class="vl" style="color:#ff6b4a">\${R(d.f)}</span></div>\`).join('');
  document.getElementById('stf').textContent=R(TF);
  document.getElementById('fv').textContent=R(TV);document.getElementById('ff').textContent='- '+R(TF);
  document.getElementById('fp').textContent=PD.length+' pedidos';document.getElementById('ft').textContent=R(TM);document.getElementById('fm').textContent=R(MX);
  document.getElementById('fo').textContent=PC.online+' pedidos';document.getElementById('fc').textContent=PC.card+' pedidos';document.getElementById('fd').textContent=PC.money+' pedidos';
  document.getElementById('fl').textContent=R(LQ);
  buildC();
}

function filterT(q){document.querySelectorAll('#otb tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';});}

const PL=p=>({online:'Pg. Online',card:'Cartão',money:'Dinheiro'}[p]||p);
const PC2=p=>({online:'ppo',card:'ppc',money:'ppm'}[p]||'ppo');
function buildC(){
  document.getElementById('ctb').innerHTML=CS.map((p,i)=>{
    const pg=p.pgtoE||p.pgto,hide=CF&&pg!==CF;
    return \`<tr id="cr\${i}" class="\${p.conf?'okr':''}\${hide?' hid':''}"><td class="mn" style="font-weight:600">#\${p.id}</td><td><span class="p \${p.status==='closed'?'pgr':'pg'}">\${p.status==='closed'?'Finalizado':'Entregue'}</span></td><td class="mn" style="font-size:11px;color:var(--muted)">\${p.hora}</td><td style="font-size:12px">\${p.courier}</td><td><div style="display:flex;align-items:center;gap:5px"><span class="ppill \${PC2(pg)}" id="pp\${i}">\${PL(pg)}</span><button class="ep" onclick="eP(\${i})">✏</button></div></td><td class="mn" style="font-weight:600">\${R(p.tot)}</td><td style="color:var(--muted)">—</td><td style="text-align:center"><input type="checkbox" class="chk" \${p.conf?'checked':''} onchange="tC(\${i},this)"></td></tr>\`;
  }).join('');upC();
}
function tC(i,el){CS[i].conf=el.checked;document.getElementById('cr'+i).classList.toggle('okr',el.checked);upC();}
function eP(i){const o=['online','card','money'],c=CS[i].pgtoE||CS[i].pgto;CS[i].pgtoE=o[(o.indexOf(c)+1)%o.length];const pg=CS[i].pgtoE,el=document.getElementById('pp'+i);el.textContent=PL(pg);el.className='ppill '+PC2(pg);upC();}
function filtC(t,btn){document.querySelectorAll('.fb2').forEach(b=>b.classList.remove('on'));CF=CF===t?null:t;if(CF)btn.classList.add('on');CS.forEach((_,i)=>{const pg=CS[i].pgtoE||CS[i].pgto,r=document.getElementById('cr'+i);if(r)r.classList.toggle('hid',!!(CF&&pg!==CF));});upC();}
function upC(){const vis=CS.filter((_,i)=>{const pg=CS[i].pgtoE||CS[i].pgto;return!CF||pg===CF;});const ok=vis.filter(p=>p.conf),pend=vis.filter(p=>!p.conf);const tv=vis.reduce((a,p)=>a+p.tot,0),ov=ok.reduce((a,p)=>a+p.tot,0),pv=pend.reduce((a,p)=>a+p.tot,0);document.getElementById('cst2').textContent=vis.length;document.getElementById('cok').textContent=ok.length;document.getElementById('cpd').textContent=pend.length;document.getElementById('cvl').textContent=R(tv);document.getElementById('crec').textContent=R(ov);document.getElementById('cpv').textContent=R(pv);document.getElementById('pcnt').textContent=CS.filter(p=>!p.conf).length;}
function openM(){const pend=CS.filter(p=>!p.conf),tv=pend.reduce((a,p)=>a+p.tot,0);document.getElementById('msub').textContent=pend.length+' entregas não conferidas · total '+R(tv);document.getElementById('mitems').innerHTML=pend.map(p=>\`<div class="pi"><div class="pit"><span class="pid">#\${p.id} — \${p.courier.split(' ')[0]}</span><span class="piv">\${R(p.tot)}</span></div><div class="pii">\${p.item} · \${PL(p.pgtoE||p.pgto)}</div></div>\`).join('')+\`<div style="margin-top:8px;padding:9px;background:var(--bg3);border-radius:7px;font-size:12px;font-weight:600">Total pendente: \${R(tv)}</div>\`;document.getElementById('mpend').classList.remove('hid');}
function closeM(){document.getElementById('mpend').classList.add('hid');}
function copyM(){const pend=CS.filter(p=>!p.conf),tv=pend.reduce((a,p)=>a+p.tot,0);navigator.clipboard.writeText('PENDÊNCIAS\\n\\n'+pend.map(p=>'#'+p.id+' | '+p.courier.split(' ')[0]+' | '+R(p.tot)+' | '+PL(p.pgtoE||p.pgto)).join('\\n')+'\\n\\nTotal: '+R(tv)).then(()=>{const b=document.querySelector('.mf .btn-a');b.textContent='✓ copiado!';setTimeout(()=>b.textContent='📋 copiar',2000);});}
function T(id,el){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));document.getElementById('panel-'+id).classList.add('on');el.classList.add('on');}
function exportCSV(){const h=['id','cliente','item','entregador','canal','pagamento','taxa','frete','total'];const rows=PD.map(p=>[p.id,p.client,p.item,p.courier,p.canal,p.pgto,p.cFee,p.dFee,p.tot].join(','));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([[h.join(','),...rows].join('\\n')],{type:'text/csv'}));a.download='fechamento.csv';a.click();}

carregar(false);
</script>
</body>
</html>`));

app.listen(PORT, () => console.log('🍕 Rodando na porta', PORT));
