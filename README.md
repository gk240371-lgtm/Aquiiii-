# Nix Salas FF — painel completo

Painel web + backend para consumir a API `https://salas.nixbot.vip`.

## Segurança do token

O token da Nix API **não fica no frontend**. Ele é enviado apenas para o backend e armazenado no SQLite em `data/secrets.db`, criptografado com **AES-256-GCM**. A chave de criptografia fica somente em `TOKEN_ENCRYPTION_KEY` no `.env`.

Nunca publique `.env`, `data/secrets.db` ou a chave de criptografia no GitHub.

## Requisitos

- Node.js 18+ (Node 20+ recomendado)
- Token válido da Nix API

## Instalação

```bash
npm install
cp .env.example .env
```

Gere a chave:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole o resultado em `TOKEN_ENCRYPTION_KEY` no `.env` e altere `ADMIN_PASSWORD`.

Depois:

```bash
npm start
```

Abra `http://localhost:3000`.

## Produção

Coloque o site atrás de HTTPS (Nginx, Cloudflare ou outro proxy), use uma senha forte e não exponha a porta diretamente. Faça backup seguro de `data/secrets.db` **junto com a mesma TOKEN_ENCRYPTION_KEY**; sem a chave, o banco criptografado não pode ser descriptografado.

O backend também mantém o token fora das respostas HTTP: o navegador nunca recebe o token da Nix API, apenas uma sessão lógica de acesso ao painel baseada na senha configurada.

## Limites

O frontend não faz polling agressivo por padrão. Ao implementar atualização automática, respeite os limites documentados pela API e o `Retry-After` em HTTP 429.
