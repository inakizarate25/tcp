import net from "net";
import readline from "readline";

// Interfaz para leer del teclado
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Conectamos al servidor local (puerto 5000)
const socket = net.createConnection({ port: 5000, host: "127.0.0.1" });

socket.on("connect", () => {
  console.log("Conectado al chat TCP. Comandos: /nick, /lista, /salir");
});

// Todo lo que llega del servidor, lo mostramos en consola
socket.on("data", (buf) => process.stdout.write(buf.toString()));

// Cada línea que tipeás, se envía al servidor
rl.on("line", (line) => {
  socket.write(line + "\n");
  if (line.trim() === "/salir") rl.close(); // opcional: cerrar la UI local
});

socket.on("close", () => {
  console.log("\nDesconectado.");
  rl.close();
});
