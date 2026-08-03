// api/send-telegram.js
//
// Vercel Serverless Function (Node.js runtime).
// Принимает POST с формы (script.js) и пересылает заявку в Telegram-бота.
//
// Токен и chat_id НЕ хранятся в коде — они берутся из
// Vercel → Project → Settings → Environment Variables (обычная пара ключ-значение):
//
//   TELEGRAM_BOT_TOKEN = 123456:AAExample...
//   TELEGRAM_CHAT_ID   = 123456789
//
// Локально для разработки создай файл .env (см. .env.example) и
// используй `vercel dev`, чтобы переменные подхватились так же, как на проде.

const TELEGRAM_API = "https://api.telegram.org";

// Простая защита от спама: не даём слать чаще, чем раз в 15 сек с одного IP.
// (In-memory — сбрасывается при "холодном" старте функции, это не замена
// полноценному рейт-лимитеру, но отсекает ботов-однострочников.)
const lastRequestByIp = new Map();
const RATE_LIMIT_MS = 15_000;

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isValidName(name) {
  return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 80;
}

function isValidPhone(phone) {
  if (typeof phone !== "string") return false;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 7 && digits.length <= 20;
}

function isValidMessage(message) {
  if (message === undefined || message === null) return true; // поле необязательное
  return typeof message === "string" && message.length <= 1000;
}

function formatTime() {
  return new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

module.exports = async function handler(req, res) {
  // CORS — на случай если форма и функция когда-то окажутся на разных доменах.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Метод не поддерживается" });
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("Не заданы TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID в переменных окружения Vercel");
    return res.status(500).json({ ok: false, error: "Сервис временно недоступен" });
  }

  // Rate limit по IP
  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .toString()
    .split(",")[0]
    .trim();
  const now = Date.now();
  const last = lastRequestByIp.get(ip);
  if (last && now - last < RATE_LIMIT_MS) {
    return res.status(429).json({ ok: false, error: "Слишком много запросов, попробуйте чуть позже" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: "Некорректный формат данных" });
    }
  }

  const { name, phone, message, website, source, page } = body || {};

  // Honeypot: скрытое поле "website" в форме — если оно заполнено, это бот.
  if (website) {
    return res.status(200).json({ ok: true }); // молча "успех" для бота
  }

  if (!isValidName(name)) {
    return res.status(400).json({ ok: false, error: "Укажите имя (от 2 символов)" });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ ok: false, error: "Укажите корректный номер телефона" });
  }
  if (!isValidMessage(message)) {
    return res.status(400).json({ ok: false, error: "Сообщение слишком длинное" });
  }

  lastRequestByIp.set(ip, now);

  const text = [
    "🔥 <b>Новая заявка с сайта</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(name.trim())}`,
    `<b>Телефон:</b> ${escapeHtml(phone.trim())}`,
    message ? `<b>Сообщение:</b> ${escapeHtml(message.trim())}` : null,
    source ? `<b>Источник:</b> ${escapeHtml(source)}` : null,
    page ? `<b>Страница:</b> ${escapeHtml(page)}` : null,
    "",
    `<b>Время:</b> ${formatTime()}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const tgRes = await fetch(`${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await tgRes.json();

    if (!tgRes.ok || !data.ok) {
      console.error("Telegram API error:", data);
      return res.status(502).json({ ok: false, error: "Не удалось отправить заявку, попробуйте позже" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Ошибка запроса к Telegram:", err);
    return res.status(500).json({ ok: false, error: "Не удалось отправить заявку, попробуйте позже" });
  }
};
