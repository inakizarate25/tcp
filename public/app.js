let token = null;
let ws = null;

const user = document.getElementById("user");
const pass = document.getElementById("pass");
const btnLogin = document.getElementById("btnLogin");
const loginSection = document.getElementById("login");
const chatSection = document.getElementById("chat");
const messages = document.getElementById("messages");
const msgInput = document.getElementById("msg");
const sendBtn = document.getElementById("send");

// --- Login ---
btnLogin.onclick = async () => {
  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.value, password: pass.value }),
  });

  const data = await res.json();
  if (!data.token) {
    alert("Login incorrecto");
    return;
  }

  token = data.token;
  loginSection.style.display = "none";
  chatSection.style.display = "block";
  connectWS();
};

// --- Conexión WS ---
function connectWS() {
  ws = new WebSocket(`ws://${location.host}?token=${token}`);

  ws.onopen = () => append("🟢 Conectado al chat");
  ws.onclose = () => append("🔴 Desconectado");
  ws.onerror = (e) => append("⚠️ Error de conexión");

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "system") append(`💬 ${msg.text}`);
    else append(`${msg.from}: ${msg.text}`);
  };
}

// --- Enviar mensaje ---
sendBtn.onclick = () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(msgInput.value);
    msgInput.value = "";
  }
};

// --- Mostrar mensajes ---
function append(text) {
  const div = document.createElement("div");
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
