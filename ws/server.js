import "dotenv/config";
import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { logger } from "./logger.js";

// --- Configuración base ---
const app = express();
app.use(express.json());

// Usuarios simulados (pueden venir de una base o archivo)
const USERS = new Map([
  ["alice", { password: "alice123" }],
  ["bob", { password: "bob123" }],
]);

// --- Endpoint de autenticación ---
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Validación
  const user = USERS.get(username);
  if (!user || user.password !== password) {
    logger.warn("LOGIN_FAIL", { username });
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  // Crear token JWT válido por 2 horas
  const token = jwt.sign({ sub: username }, process.env.JWT_SECRET, {
    expiresIn: "2h",
  });
  logger.info("LOGIN_OK", { username });
  res.json({ token });
});

// --- Servir el cliente web ---
app.use(express.static("public"));

// --- Crear servidor HTTP + WS ---
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// --- Mapa de clientes conectados ---
const clients = new Map();

// --- Validar token antes de aceptar la conexión WS ---
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

// --- Evento de conexión WS ---
wss.on("connection", (ws, req) => {
  const id = uuid();
  const username = req.user.username;
  clients.set(ws, { id, username });

  logger.info("WS_CONNECT", { username });
  broadcast({ type: "system", text: `${username} se unió al chat.` });

  ws.on("message", (data) => {
    const msg = data.toString();
    logger.info("WS_MSG", { from: username, text: msg });
    broadcast({ type: "chat", from: username, text: msg });
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
  console.log(`Servidor WebSocket+JWT en http://localhost:${PORT}`);
});
