# Nix Salas FF — Netlify + Backend separado

## Arquitetura

- `netlify/site/` = frontend publicado no Netlify
- `backend/` = API Node.js que guarda o token Nix criptografado
- O navegador nunca recebe o token da Nix.

## 1. Publique o backend primeiro

Use Render, Railway ou uma VPS.

Configure:
- `ADMIN_PASSWORD`
- `TOKEN_ENCRYPTION_KEY`
- `NIX_API_BASE=https://salas.nixbot.vip`
- `FRONTEND_URL=https://SEU-SITE.netlify.app`

Gere a chave com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois copie a URL pública do backend, por exemplo:
`https://seu-backend.exemplo.com`

## 2. Publique o frontend no Netlify

Este projeto já possui `netlify.toml`.

No Netlify:
- conecte este repositório OU envie a pasta do projeto;
- o build será executado automaticamente;
- em Environment Variables, defina `BACKEND_URL` com a URL pública do backend.

Exemplo:
`BACKEND_URL=https://seu-backend.exemplo.com`

## 3. Teste

Abra o endereço do Netlify e faça login.

Se o navegador mostrar erro de CORS, confirme que `FRONTEND_URL` no backend é exatamente o domínio do Netlify.

## Segurança

Não coloque o token da Nix, `ADMIN_PASSWORD` ou `TOKEN_ENCRYPTION_KEY` em arquivos do frontend ou em variáveis públicas do Netlify.
