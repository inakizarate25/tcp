import net from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, "..", "logs", "tcp.log");

const clients = new Map();
let anonCount = 1;

const log = (line) => {
  const row = `[${new Date().toISOString()}] ${line}\n`;
  try {
    fs.appendFileSync(LOG_FILE, row, "utf8");
  } catch (err) {
    console.error("Error escribiendo log:", err.message);
  }
  console.log(line);
};

const server = net.createServer((socket) => {
  const nick = `user${anonCount++}`;
  clients.set(socket, nick);
  log(`CONNECT ${nick} from ${socket.remoteAddress}:${socket.remotePort}`);

  socket.write(`Bienvenido ${nick}! Usa /nick NOMBRE para cambiar tu nick.\n`);

  // --- timeout de inactividad (5 min) ---
  socket.setTimeout(5 * 60 * 1000);
  socket.on("timeout", () => {
    log(`TIMEOUT ${clients.get(socket)}`);
    socket.end("⏳ Tiempo de inactividad, desconectado.\n");
  });

  socket.on("data", (buf) => {
    let msg;
    try {
      msg = buf.toString().trim();
    } catch (err) {
      log(`ERROR decodificando datos: ${err.message}`);
      return;
    }
    if (!msg) return;

    // --- comando: cambiar nick ---
    if (msg.startsWith("/nick ")) {
      const newNick = msg.split(" ").slice(1).join(" ").trim();
      if (!newNick) {
        socket.write("⚠️ El nick no puede estar vacío.\n");
        return;
      }
      if ([...clients.values()].includes(newNick)) {
        socket.write("⚠️ Ese nick ya está en uso.\n");
        return;
      }
      const old = clients.get(socket);
      clients.set(socket, newNick);
      broadcast(`* ${old} es ahora ${newNick}`);
      log(`NICK ${old} -> ${newNick}`);
      return;
    }

    // --- comando: lista ---
    if (msg === "/lista") {
      const list = [...clients.values()].join(", ");
      socket.write(`Conectados: ${list}\n`);
      return;
    }

    // --- comando: salir ---
    if (msg === "/salir") {
      socket.end();
      return;
    }

    // --- mensaje normal ---
    const from = clients.get(socket);
    broadcast(`[${from}] ${msg}`, socket);
    log(`MSG ${from}: ${msg}`);
  });

  socket.on("close", () => {
    const nick = clients.get(socket);
    clients.delete(socket);
    broadcast(`* ${nick} se desconectó`);
    log(`DISCONNECT ${nick}`);
  });

  socket.on("error", (err) => {
    log(`ERROR socket (${clients.get(socket)}): ${err.message}`);
  });
});

// --- errores globales del server ---
server.on("error", (err) => {
  log(`SERVER_ERROR: ${err.message}`);
});

function broadcast(text, except) {
  for (const [sock] of clients) {
    if (sock !== except) {
      try {
        sock.write(text + "\n");
      } catch (err) {
        log(`ERROR broadcast a ${clients.get(sock)}: ${err.message}`);
      }
    }
  }
}

server.listen(5000, () => {
  console.log("TCP chat server escuchando en puerto 5000");
});
