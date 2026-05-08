# 🍕 Painel Pizza Hollywood — Railway

Painel de fechamento de caixa com dados em tempo real da Foody Delivery e Cardápio Web.

## Como publicar no Railway

1. Crie uma conta em **railway.app**
2. Clique em **New Project → Deploy from GitHub repo**
3. Faça upload desta pasta (ou conecte ao GitHub)
4. O Railway detecta Node.js automaticamente e faz o deploy

## Variáveis de ambiente (opcional)

No painel do Railway, vá em **Variables** e adicione:

```
FOODY_TOKEN=seu_token_aqui
CW_TOKEN=seu_token_aqui
```

## Endpoints

- `GET /` → painel principal
- `GET /api/foody?date=2026-05-07` → dados da Foody
- `GET /api/cardapio?date=2026-05-07` → dados do Cardápio Web
- `GET /health` → status do servidor
