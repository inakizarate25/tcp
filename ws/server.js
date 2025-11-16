import "dotenv/config";
import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import fs from "fs";
import { logger } from "./logger.js";
import { initDB } from "./db.js";

// --- Inicializar Express y DB ---
const app = express();
app.use(express.json());
const db = await initDB();

// --- Persistencia de mensajes (como antes) ---
const DATA_FILE = "./data/messages.json";
let messages = [];
if (fs.existsSync(DATA_FILE)) {
  messages = JSON.parse(fs.readFileSync(DATA_FILE, "utf8") || "[]");
}
function saveMessage(msg) {
  messages.push(msg);
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
}

// --- REGISTRO DE USUARIO ---
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Faltan datos" });

  try {
    await db.run("INSERT INTO users (username, password) VALUES (?, ?)", [
      username,
      password,
    ]);
    logger.info("REGISTER_OK", { username });
    res.json({ message: "Usuario registrado correctamente" });
  } catch (err) {
    logger.error("REGISTER_FAIL", { username, error: err.message });
    if (err.message.includes("UNIQUE"))
      return res.status(400).json({ error: "Usuario ya existe" });
    res.status(500).json({ error: "Error interno" });
  }
});

// --- LOGIN DE USUARIO ---
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Faltan datos" });

  const user = await db.get("SELECT * FROM users WHERE username = ?", [
    username,
  ]);
  if (!user || user.password !== password) {
    logger.warn("LOGIN_FAIL", { username });
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = jwt.sign({ sub: username }, process.env.JWT_SECRET, {
    expiresIn: "2h",
  });
  logger.info("LOGIN_OK", { username });
  res.json({ token });
});

// --- Servir el cliente web ---
app.use(express.static("public"));

// --- Configuración WebSocket ---
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const clients = new Map();

// --- Autenticación antes del upgrade ---
server.on("upgrade", (req, socket, head) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const token = params.get("token");

  if (!token) {
    socket.destroy();
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { username: payload.sub };
  } catch (err) {
    logger.error("JWT_ERROR", { message: err.message });
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

// --- Nueva conexión WebSocket ---
wss.on("connection", (ws, req) => {
  const username = req.user.username;
  clients.set(ws, { username });

  logger.info("WS_CONNECT", { username });
  broadcast({ type: "system", text: `${username} se unió al chat.` });

  // Enviar historial solo al nuevo usuario
  ws.send(JSON.stringify({ type: "history", messages }));

  ws.on("message", (data) => {
    const text = data.toString().trim();
    if (!text) return;

    const msg = {
      type: "chat",
      from: username,
      text,
      ts: new Date().toISOString(),
    };
    saveMessage(msg);
    logger.info("WS_MSG", msg);
    broadcast(msg);
  });

  ws.on("close", () => {
    clients.delete(ws);
    logger.info("WS_DISCONNECT", { username });
    broadcast({ type: "system", text: `${username} se desconectó.` });
  });

  ws.on("error", (err) => {
    logger.error("WS_ERROR", { username, message: err.message });
  });
});

// --- Broadcast a todos los clientes ---
function broadcast(obj) {
  const json = JSON.stringify(obj);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(json);
  }
}

// --- Iniciar servidor ---
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(
    `Servidor con registro/login JWT+SQLite en http://localhost:${PORT}`
  );
});
