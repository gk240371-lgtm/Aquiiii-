require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 3000);
const BASE = (process.env.NIX_API_BASE || "https://salas.nixbot.vip").replace(/\/+$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY;
const ALLOWED_ORIGIN = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");

if (!ADMIN_PASSWORD || !KEY_HEX || !/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
  throw new Error("Configure ADMIN_PASSWORD e TOKEN_ENCRYPTION_KEY (64 caracteres hexadecimais).");
}

const KEY = Buffer.from(KEY_HEX, "hex");

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (!ALLOWED_ORIGIN || origin === ALLOWED_ORIGIN)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(express.json({ limit: "32kb" }));

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "secrets.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS secrets (
  id INTEGER PRIMARY KEY CHECK(id=1),
  iv BLOB NOT NULL,
  tag BLOB NOT NULL,
  ciphertext BLOB NOT NULL,
  updated_at TEXT NOT NULL
)`);

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function decrypt(row) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, row.iv);
  decipher.setAuthTag(row.tag);
  return Buffer.concat([
    decipher.update(row.ciphertext),
    decipher.final()
  ]).toString("utf8");
}

function getToken() {
  const row = db.prepare(
    "SELECT iv, tag, ciphertext FROM secrets WHERE id=1"
  ).get();
  return row ? decrypt(row) : null;
}

function saveToken(token) {
  const e = encrypt(token);
  db.prepare(`
    INSERT INTO secrets(id,iv,tag,ciphertext,updated_at)
    VALUES(1,@iv,@tag,@ciphertext,@updated_at)
    ON CONFLICT(id) DO UPDATE SET
      iv=@iv, tag=@tag, ciphertext=@ciphertext, updated_at=@updated_at
  `).run({ ...e, updated_at: new Date().toISOString() });
}

const loginAttempts = new Map();

function rateLimitLogin(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const current = loginAttempts.get(ip) || { count: 0, since: now };

  if (now - current.since >= 15 * 60 * 1000) {
    current.count = 0;
    current.since = now;
  }

  current.count++;
  loginAttempts.set(ip, current);

  if (current.count > 10) {
    return res.status(429).json({
      error: "Muitas tentativas. Aguarde 15 minutos."
    });
  }

  next();
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const received = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!received || received !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  next();
}

async function nix(pathname, options = {}) {
  const token = getToken();

  if (!token) {
    const e = new Error("Token da Nix API ainda não configurado.");
    e.status = 400;
    throw e;
  }

  const response = await fetch(BASE + pathname, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { detail: text };
  }

  if (!response.ok) {
    const e = new Error(body.detail || body.error || `Nix API HTTP ${response.status}`);
    e.status = response.status;
    e.body = body;
    throw e;
  }

  return body;
}

function sendError(res, e) {
  const status = Number(e.status) || 500;
  res.status(status).json(e.body || { error: e.message || "Erro interno." });
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "nix-salas-backend" });
});

app.post("/api/login", rateLimitLogin, (req, res) => {
  if (req.body?.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Senha inválida" });
  }
  res.json({ ok: true, token: ADMIN_PASSWORD });
});

app.get("/api/token/status", auth, (req, res) => {
  res.json({ configured: !!getToken() });
});

app.post("/api/token", auth, (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token || token.length > 500) {
    return res.status(422).json({ error: "Token inválido." });
  }
  saveToken(token);
  res.json({ ok: true });
});

app.get("/api/balance", auth, async (req, res) => {
  try { res.json(await nix("/balance")); } catch (e) { sendError(res, e); }
});

app.post("/api/rooms", auth, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.password || !body.start_delay_minutes || !body.config_type) {
      return res.status(422).json({
        error: "password, start_delay_minutes e config_type são obrigatórios"
      });
    }
    res.json(await nix("/rooms", {
      method: "POST",
      body: JSON.stringify(body)
    }));
  } catch (e) { sendError(res, e); }
});

app.get("/api/rooms/:id", auth, async (req, res) => {
  try { res.json(await nix(`/rooms/${encodeURIComponent(req.params.id)}`)); }
  catch (e) { sendError(res, e); }
});

app.get("/api/rooms/:id/members", auth, async (req, res) => {
  try {
    const q = req.query.include_loadout === "true"
      ? "?include_loadout=true" : "";
    res.json(await nix(`/rooms/${encodeURIComponent(req.params.id)}/members${q}`));
  } catch (e) { sendError(res, e); }
});

app.post("/api/rooms/:id/kick", auth, async (req, res) => {
  try {
    res.json(await nix(`/rooms/${encodeURIComponent(req.params.id)}/kick`, {
      method: "POST",
      body: JSON.stringify({
        player_uid: String(req.body?.player_uid || "")
      })
    }));
  } catch (e) { sendError(res, e); }
});

app.post("/api/rooms/:id/start", auth, async (req, res) => {
  try {
    res.json(await nix(`/rooms/${encodeURIComponent(req.params.id)}/start`, {
      method: "POST"
    }));
  } catch (e) { sendError(res, e); }
});

app.post("/api/rooms/:id/release", auth, async (req, res) => {
  try {
    res.json(await nix(`/rooms/${encodeURIComponent(req.params.id)}/release`, {
      method: "POST"
    }));
  } catch (e) { sendError(res, e); }
});

app.get("/api/rooms/:id/result", auth, async (req, res) => {
  try { res.json(await nix(`/rooms/${encodeURIComponent(req.params.id)}/result`)); }
  catch (e) { sendError(res, e); }
});

app.get("/api/stats/tc", auth, async (req, res) => {
  try {
    const ids = String(req.query.ids || "").replace(/[^0-9,]/g, "");
    if (!ids) return res.status(422).json({ error: "Informe IDs." });
    res.json(await nix(`/stats/tc?ids=${encodeURIComponent(ids)}`));
  } catch (e) { sendError(res, e); }
});

app.listen(PORT, () => {
  console.log(`Nix Salas FF backend ativo na porta ${PORT}`);
});
