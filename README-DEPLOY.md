# Backend separado

Este backend roda como um servidor Node.js (Render, Railway, VPS etc.).

## Variáveis de ambiente

- `PORT=3000`
- `TOKEN_ENCRYPTION_KEY=` — 64 caracteres hexadecimais (32 bytes)
- `ADMIN_PASSWORD=` — senha forte do painel
- `NIX_API_BASE=https://salas.nixbot.vip`
- `FRONTEND_URL=https://SEU-SITE.netlify.app`

## Deploy

Comandos:

```bash
npm install
npm start
```

Não coloque `TOKEN_ENCRYPTION_KEY`, `ADMIN_PASSWORD` ou o token da Nix no código do frontend.

## Banco

O SQLite é criado em `data/secrets.db`. Faça backup desse arquivo junto com a `TOKEN_ENCRYPTION_KEY`, porque perder a chave impede a descriptografia do token salvo.
