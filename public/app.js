let token = null;
let ws = null;

// --- Referencias DOM ---
const loginSection = document.getElementById("loginSection");
const registerSection = document.getElementById("registerSection");
const chatSection = document.getElementById("chat");
const messages = document.getElementById("messages");

const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const regUser = document.getElementById("regUser");
const regPass = document.getElementById("regPass");

const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const goRegister = document.getElementById("goRegister");
const goLogin = document.getElementById("goLogin");
const sendBtn = document.getElementById("send");
const msgInput = document.getElementById("msg");
const logoutBtn = document.getElementById("logout");

// --- Cambiar entre login y registro ---
goRegister.onclick = () => {
  loginSection.classList.add("hidden");
  registerSection.classList.remove("hidden");
};

goLogin.onclick = () => {
  registerSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
};

// --- Registrar usuario ---
btnRegister.onclick = async () => {
  const username = regUser.value.trim();
  const password = regPass.value.trim();

  if (!username || !password) {
    alert("⚠️ Complete todos los campos.");
    return;
  }

  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  if (res.ok) {
    alert("✅ Registro exitoso. Ahora podés iniciar sesión.");
    regUser.value = regPass.value = "";
    registerSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
  } else {
    alert("⚠️ " + (data.error || "Error al registrar."));
  }
};

// --- Login de usuario ---
btnLogin.onclick = async () => {
  const username = loginUser.value.trim();
  const password = loginPass.value.trim();

  if (!username || !password) {
    alert("⚠️ Complete todos los campos.");
    return;
  }

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  if (!data.token) {
    alert(data.error || "Error de inicio de sesión.");
    return;
  }

  token = data.token;

  loginSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
  connectWS(username);
};

// --- Conexión WebSocket ---
function connectWS(username) {
  ws = new WebSocket(`ws://${location.host}?token=${token}`);

  ws.onopen = () => append({ type: "system", text: "🟢 Conectado al chat" });
  ws.onclose = () =>
    append({ type: "system", text: "🔴 Desconectado del servidor" });
  ws.onerror = () => append({ type: "system", text: "⚠️ Error de conexión" });

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "history") msg.messages.forEach((m) => append(m));
    else append(msg);
  };

  sendBtn.onclick = () => {
    if (ws.readyState === WebSocket.OPEN && msgInput.value.trim() !== "") {
      ws.send(msgInput.value);
      msgInput.value = "";
    }
  };

  function append(msg) {
    const div = document.createElement("div");

    if (msg.type === "system") {
      div.className = "text-center text-sm text-slate-400 italic";
      div.textContent = msg.text;
    } else if (msg.type === "chat") {
      const isMine = msg.from === username;
      div.className = isMine
        ? "bg-cyan-500 text-slate-900 px-3 py-2 rounded-lg w-fit ml-auto"
        : "bg-white/10 text-slate-100 px-3 py-2 rounded-lg w-fit mr-auto";
      div.textContent = `${msg.from}: ${msg.text}`;
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
}

// --- Cerrar sesión (Salir del chat) ---
logoutBtn.onclick = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }

  token = null;
  messages.innerHTML = ""; // limpiar historial visual
  chatSection.classList.add("hidden");
  loginSection.classList.remove("hidden");

  loginUser.value = "";
  loginPass.value = "";
  alert("👋 Sesión cerrada correctamente.");
};
