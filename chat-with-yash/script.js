const API_BASE = "https://chat-with-yash.onrender.com";

const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const chatError = document.getElementById("chat-error");

let messages = [];

function addBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role === "user" ? "user" : "bot"}`;
  const p = document.createElement("p");
  p.textContent = text;
  bubble.appendChild(p);
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

function showLoading() {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble loading";
  bubble.innerHTML = "<span></span><span></span><span></span>";
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

function showError(text) {
  chatError.textContent = text;
  chatError.hidden = false;
}

function clearError() {
  chatError.hidden = true;
  chatError.textContent = "";
}

async function sendMessage(text) {
  messages.push({ role: "user", content: text });
  addBubble("user", text);
  clearError();

  chatInput.disabled = true;
  chatSend.disabled = true;
  const loadingBubble = showLoading();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_err) {
      data = null;
    }

    loadingBubble.remove();

    if (!res.ok) {
      const message = (data && data.error) || "Something went wrong. Please try again.";
      showError(message);
      messages.pop();
      return;
    }

    const reply = data && data.reply ? data.reply : "";
    messages.push({ role: "assistant", content: reply });
    addBubble("assistant", reply);
  } catch (_err) {
    loadingBubble.remove();
    showError("Couldn't reach the chat server. Check your connection and try again.");
    messages.pop();
  } finally {
    chatInput.disabled = false;
    chatSend.disabled = false;
    chatInput.focus();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  sendMessage(text);
});
