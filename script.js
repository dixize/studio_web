// script.js
// Чистый JS, без зависимостей. Отвечает за:
//  1) поведение навбара при скролле + мобильное меню
//  2) reveal-анимации при появлении блоков в viewport
//  3) плавный скролл к форме по кнопкам "Оставить заявку"
//  4) валидацию и отправку LeadForm на серверлесс-функцию /api/send-telegram

document.addEventListener("DOMContentLoaded", () => {
  initYear();
  initNavbar();
  initMobileMenu();
  initRevealAnimations();
  initSmoothAnchors();
  initLeadForm();
});

/* ---------------------------------------------------------
   Год в футере
--------------------------------------------------------- */
function initYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
}

/* ---------------------------------------------------------
   Навбар: фон/тень при скролле
--------------------------------------------------------- */
function initNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const onScroll = () => {
    navbar.classList.toggle("is-scrolled", window.scrollY > 20);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* ---------------------------------------------------------
   Мобильное меню (простое раскрытие ссылок)
--------------------------------------------------------- */
function initMobileMenu() {
  const toggle = document.getElementById("navToggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    links.style.cssText = isOpen
      ? "display:flex;flex-direction:column;position:fixed;top:70px;left:16px;right:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;gap:16px;box-shadow:var(--shadow);"
      : "";
  });

  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("is-open");
      links.style.cssText = "";
    })
  );
}

/* ---------------------------------------------------------
   Reveal-анимации через IntersectionObserver
--------------------------------------------------------- */
function initRevealAnimations() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

/* ---------------------------------------------------------
   Плавный скролл для якорных ссылок / кнопок "Оставить заявку"
--------------------------------------------------------- */
function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });

      // если ведём к форме — после скролла ставим фокус в первое поле
      if (targetId === "#contact") {
        const nameInput = document.getElementById("name");
        setTimeout(() => nameInput?.focus({ preventScroll: true }), 600);
      }
    });
  });
}

/* ---------------------------------------------------------
   LeadForm: валидация + отправка на /api/send-telegram
--------------------------------------------------------- */
function initLeadForm() {
  const form = document.getElementById("leadForm");
  if (!form) return;

  const formWrap = document.getElementById("leadFormWrap");
  const statusBox = document.getElementById("formStatus");

  const fields = {
    name: form.querySelector("#name"),
    phone: form.querySelector("#phone"),
    message: form.querySelector("#message"),
  };

  const validators = {
    name: (v) => {
      if (!v.trim()) return "Укажите имя";
      if (v.trim().length < 2) return "Имя слишком короткое";
      return "";
    },
    phone: (v) => {
      const digits = v.replace(/[^\d+]/g, "");
      if (!v.trim()) return "Укажите телефон";
      if (digits.length < 7) return "Проверьте номер телефона";
      return "";
    },
    message: () => "", // необязательное поле
  };

  // Живая валидация при потере фокуса
  Object.entries(fields).forEach(([key, input]) => {
    if (!input) return;
    input.addEventListener("blur", () => showFieldError(key, validators[key](input.value)));
    input.addEventListener("input", () => clearFieldError(key));
  });

  function showFieldError(key, message) {
    const row = form.querySelector(`[data-field="${key}"]`);
    if (!row) return;
    const errorEl = row.querySelector(".field-error");
    row.classList.toggle("has-error", Boolean(message));
    if (errorEl) errorEl.textContent = message || "";
  }

  function clearFieldError(key) {
    const row = form.querySelector(`[data-field="${key}"]`);
    if (!row) return;
    row.classList.remove("has-error");
    const errorEl = row.querySelector(".field-error");
    if (errorEl) errorEl.textContent = "";
  }

  function setStatus(type, message) {
    if (!statusBox) return;
    statusBox.className = `form-status show ${type}`;
    statusBox.textContent = message;
  }

  function hideStatus() {
    if (!statusBox) return;
    statusBox.className = "form-status";
    statusBox.textContent = "";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideStatus();

    // Валидируем все поля
    let hasError = false;
    Object.entries(fields).forEach(([key, input]) => {
      if (!input) return;
      const error = validators[key](input.value);
      showFieldError(key, error);
      if (error) hasError = true;
    });
    if (hasError) return;

    const payload = {
      name: fields.name.value.trim(),
      phone: fields.phone.value.trim(),
      message: fields.message.value.trim(),
      website: form.querySelector("#website")?.value || "", // honeypot
      source: document.title,
      page: window.location.href,
    };

    formWrap?.classList.add("is-loading");

    try {
      const res = await fetch("/api/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Не удалось отправить заявку");
      }

      setStatus("success", "Спасибо! Заявка отправлена, мы скоро свяжемся с вами.");
      form.reset();

      // аналитика (опционально): раскомментируй, если подключишь GA4 / Я.Метрику
      // window.gtag?.("event", "lead_submit");
      // window.ym?.(0, "reachGoal", "lead_submit");
    } catch (err) {
      setStatus("error", err.message || "Что-то пошло не так. Попробуйте ещё раз или позвоните нам.");
    } finally {
      formWrap?.classList.remove("is-loading");
    }
  });
}
