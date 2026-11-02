// Funciones de ayuda compartidas entre la página de reservas y el panel.
(function () {
  const pad = (n) => String(n).padStart(2, "0");

  const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function toMin(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  // "00:00" como hora de cierre significa medianoche (fin del día).
  function closeMin(hhmm) {
    const m = toMin(hhmm);
    return m === 0 ? 1440 : m;
  }

  function fromMin(min) {
    return pad(Math.floor(min / 60) % 24) + ":" + pad(min % 60);
  }

  function dateKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseDay(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function formatDayLong(s) {
    const d = parseDay(s);
    return DAY_NAMES[d.getDay()] + " " + d.getDate() + " de " + MONTHS[d.getMonth()];
  }

  function monthLabel(year, month) {
    return MONTHS[month][0].toUpperCase() + MONTHS[month].slice(1) + " " + year;
  }

  function money(n) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "";
    return "$" + Number(n).toLocaleString("es-AR");
  }

  // Agrega el código de país si el número no lo tiene (ej: 11 2233 4455 → 5491122334455).
  function normPhone(phone, countryCode) {
    let d = String(phone || "").replace(/\D/g, "");
    const cc = String(countryCode || "").replace(/\D/g, "");
    if (!cc || d.startsWith(cc)) return d;
    return cc + d.replace(/^0/, "");
  }

  function waLink(phone, text, countryCode) {
    return "https://wa.me/" + normPhone(phone, countryCode) + "?text=" + encodeURIComponent(text);
  }

  // Crea un elemento DOM sin usar innerHTML (evita inyectar HTML con datos del usuario).
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (k in node && typeof v !== "string") node[k] = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }


  window.Utils = {
    pad, toMin, fromMin, dateKey, parseDay, addDays, formatDayLong, monthLabel, money,
    normPhone, waLink, el, DAY_NAMES, DAY_SHORT, MONTHS
  };
})();
