// Control de cuotas: quién pagó, quién debe, recordatorios por WhatsApp y socios.
(async function () {
  const U = window.Utils;
  const S = window.Store;
  const $ = (s) => document.querySelector(s);
  const el = U.el;

  const state = { settings: null, members: [], payments: [], month: null, filter: "all", query: "", paying: null, editing: null };

  const STATUS_TEXT = { paid: "Pagó", pending: "Pendiente", late: "Vencida" };

  function toast(msg) {
    const t = el("div", { class: "toast", role: "status" }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2200);
  }

  function period() {
    return state.month.getFullYear() + "-" + U.pad(state.month.getMonth() + 1);
  }

  function shortDate(s) {
    const [y, m, d] = s.split("-");
    return Number(d) + "/" + Number(m) + (y !== String(new Date().getFullYear()) ? "/" + y : "");
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || "")[0] || "").concat((parts[1] || "")[0] || "").toUpperCase() || "?";
  }

  const planOf = (m) => state.settings.plans.find((p) => p.id === m.planId);
  const planName = (m) => (planOf(m) || { name: "Sin plan" }).name;
  const priceOf = (m) => Number((planOf(m) || {}).price) || 0;

  // ---------- Login ----------
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#login-error");
    err.hidden = true;
    try {
      await S.signIn($("#email").value.trim(), $("#password").value);
      await showApp();
    } catch (ex) {
      err.textContent = "Email o contraseña incorrectos.";
      err.hidden = false;
    }
  });

  $("#logout").addEventListener("click", async () => {
    await S.signOut();
    location.reload();
  });

  // ---------- Pestañas ----------
  const TABS = { month: "#tab-month", members: "#tab-members", settings: "#tab-settings" };
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      for (const [name, sel] of Object.entries(TABS)) $(sel).hidden = tab.dataset.tab !== name;
    });
  });

  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()));

  // ---------- Cuotas del mes ----------
  function monthRows() {
    const y = state.month.getFullYear(), mo = state.month.getMonth();
    const lastDay = U.dateKey(new Date(y, mo + 1, 0));
    const due = period() + "-" + U.pad(Math.min(28, Math.max(1, Number(state.settings.dueDay) || 10)));
    const today = U.dateKey(new Date());
    const paidBy = new Map(state.payments.map((p) => [p.memberId, p]));

    return state.members
      .filter((m) => paidBy.has(m.id) || (m.active !== false && (!m.since || m.since <= lastDay)))
      .map((m) => {
        const pay = paidBy.get(m.id);
        return {
          member: m, pay, due,
          amount: pay ? pay.amount : priceOf(m),
          status: pay ? "paid" : today > due ? "late" : "pending"
        };
      });
  }

  function reminderText(row) {
    const s = state.settings;
    const [, mm, dd] = row.due.split("-");
    const first = row.member.name.split(" ")[0];
    return "Hola " + first + "! Te recordamos que la cuota de " +
      U.monthLabel(state.month.getFullYear(), state.month.getMonth()) + " en " + s.businessName +
      " (" + U.money(row.amount) + ") " + (row.status === "late" ? "venció" : "vence") + " el " +
      Number(dd) + "/" + Number(mm) + "." + (s.alias ? " Podés transferir al alias " + s.alias + "." : "") + " ¡Gracias!";
  }

  function renderMonth() {
    $("#month-label").textContent = U.monthLabel(state.month.getFullYear(), state.month.getMonth());
    const rows = monthRows();
    const paid = rows.filter((r) => r.status === "paid");
    const late = rows.filter((r) => r.status === "late").length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const pct = rows.length ? Math.round((paid.length / rows.length) * 100) : 0;
    $("#st-paid").textContent = U.money(paid.reduce((n, r) => n + r.amount, 0)) || "$0";
    $("#st-due").textContent = U.money(rows.filter((r) => r.status !== "paid").reduce((n, r) => n + r.amount, 0)) || "$0";
    $("#st-count").textContent = paid.length + " de " + rows.length;
    $("#st-pct").textContent = pct + "%";
    $("#st-bar").style.width = pct + "%";
    $("#st-bar").parentElement.setAttribute("aria-valuenow", String(pct));
    $("#st-late").textContent = [
      late && late + (late === 1 ? " vencida" : " vencidas"),
      pending && pending + (pending === 1 ? " pendiente" : " pendientes")
    ].filter(Boolean).join(" · ") || "¡Todos al día!";

    const q = state.query.toLowerCase();
    const visible = rows
      .filter((r) => state.filter === "all" || (state.filter === "paid" ? r.status === "paid" : r.status !== "paid"))
      .filter((r) => !q || r.member.name.toLowerCase().includes(q))
      .sort((a, b) => ({ late: 0, pending: 1, paid: 2 }[a.status] - { late: 0, pending: 1, paid: 2 }[b.status]) ||
        a.member.name.localeCompare(b.member.name, "es"));

    const box = $("#month-list");
    if (!state.members.length) {
      box.replaceChildren(el("p", { class: "empty" }, "Todavía no cargaste socios. Andá a la pestaña Socios."));
      return;
    }
    if (!visible.length) {
      box.replaceChildren(el("p", { class: "empty" }, "No hay socios con este filtro."));
      return;
    }

    box.replaceChildren(...visible.map((r) => {
      const m = r.member;
      const status = r.status === "paid"
        ? [el("span", { class: "stamp" }, "Pagado"),
          el("span", { class: "note" }, shortDate(r.pay.paidOn) + " · " + r.pay.method)]
        : r.status === "late"
          ? [el("span", { class: "late" }, "Vencida"), el("span", { class: "note" }, "el " + shortDate(r.due))]
          : el("span", { class: "note" }, "Vence el " + shortDate(r.due));
      return el("div", { class: "row " + r.status },
        el("div", { class: "who" },
          el("strong", {}, m.name),
          m.phone && el("span", { class: "note" }, m.phone)
        ),
        el("span", { class: "plan" }, planName(m)),
        el("span", { class: "num" }, U.money(r.amount) || "$0"),
        el("div", { class: "status" }, status),
        el("div", { class: "acts" },
          r.status === "paid"
            ? el("button", {
              class: "btn danger sm", type: "button",
              onclick: async () => {
                if (!confirm("¿Anular el pago de " + m.name + "?")) return;
                await S.deletePayment(r.pay.id);
                await loadMonth();
                toast("Pago anulado");
              }
            }, "Anular")
            : [
              m.phone && el("a", {
                class: "btn ghost sm", target: "_blank", rel: "noopener",
                href: U.waLink(m.phone, reminderText(r), state.settings.countryCode)
              }, "Recordar"),
              el("button", { class: "btn sm", type: "button", onclick: () => openPay(r) }, "Cobrar")
            ]
        )
      );
    }));
  }

  async function loadMonth() {
    state.payments = await S.listPayments(period());
    renderMonth();
  }

  function changeMonth(delta) {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1);
    loadMonth();
  }
  $("#prev-month").addEventListener("click", () => changeMonth(-1));
  $("#next-month").addEventListener("click", () => changeMonth(1));

  $("#search").addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    renderMonth();
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      state.filter = chip.dataset.filter;
      renderMonth();
    });
  });

  $("#export").addEventListener("click", () => {
    const cell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const lines = [["Socio", "Plan", "Teléfono", "Monto", "Estado", "Fecha de pago", "Medio"].map(cell).join(";")];
    monthRows().forEach((r) => lines.push([
      r.member.name, planName(r.member), r.member.phone, r.amount, STATUS_TEXT[r.status],
      r.pay ? r.pay.paidOn : "", r.pay ? r.pay.method : ""
    ].map(cell).join(";")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "cuotas-" + period() + ".csv" });
    document.body.append(a);
    a.click();
    a.remove();
  });

  // ---------- Registrar pago ----------
  function openPay(row) {
    state.paying = row;
    $("#pay-title").textContent = "Cobrar a " + row.member.name;
    $("#p-amount").value = String(row.amount || "");
    $("#p-date").value = U.dateKey(new Date());
    $("#pay-error").hidden = true;
    $("#pay-dialog").showModal();
  }

  $("#pay-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#pay-error");
    const amount = Number($("#p-amount").value);
    try {
      if (!(amount > 0)) throw new Error("Poné el monto.");
      if (!$("#p-date").value) throw new Error("Poné la fecha.");
      await S.addPayment({
        memberId: state.paying.member.id, period: period(), amount,
        method: $("#p-method").value, paidOn: $("#p-date").value
      });
      $("#pay-dialog").close();
      await loadMonth();
      toast("Pago registrado");
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  // ---------- Socios ----------
  function renderMembers() {
    const box = $("#members-list");
    if (!state.members.length) {
      box.replaceChildren(
        el("p", { class: "empty" }, "Todavía no hay socios."),
        !S.isRemote && el("button", { class: "btn ghost sm", type: "button", onclick: loadSample }, "Cargar socios de ejemplo")
      );
      return;
    }
    const list = [...state.members].sort((a, b) =>
      (a.active === false) - (b.active === false) || a.name.localeCompare(b.name, "es"));
    box.replaceChildren(...list.map((m) => el("div", { class: "row" + (m.active === false ? " inactive" : "") },
      el("div", { class: "who" },
        el("strong", {}, m.name),
        el("span", { class: "note" }, [m.phone, m.notes].filter(Boolean).join(" · "))
      ),
      el("span", { class: "plan" }, planName(m)),
      el("span", { class: "num" }, U.money(priceOf(m))),
      el("div", { class: "status" },
        m.active === false
          ? el("span", { class: "late" }, "De baja")
          : el("span", { class: "note" }, m.since ? "Desde " + shortDate(m.since) : "")),
      el("div", { class: "acts" },
        el("button", { class: "btn ghost sm", type: "button", onclick: () => openMember(m) }, "Editar"),
        el("button", {
          class: "btn " + (m.active === false ? "ghost" : "danger") + " sm", type: "button",
          onclick: async () => {
            if (m.active !== false && !confirm("¿Dar de baja a " + m.name + "? Deja de aparecer en las cuotas.")) return;
            await S.saveMember(Object.assign({}, m, { active: m.active === false }));
            await reloadMembers();
          }
        }, m.active === false ? "Reactivar" : "Dar de baja")
      )
    )));
  }

  async function reloadMembers() {
    state.members = await S.listMembers();
    renderMembers();
    renderMonth();
  }

  function openMember(m) {
    state.editing = m || null;
    $("#member-title").textContent = m ? "Editar socio" : "Nuevo socio";
    $("#m-plan").replaceChildren(...state.settings.plans.map((p) =>
      el("option", { value: p.id }, p.name + " · " + U.money(p.price))));
    $("#m-name").value = m ? m.name : "";
    $("#m-phone").value = m ? m.phone || "" : "";
    $("#m-plan").value = m && m.planId ? m.planId : (state.settings.plans[0] || {}).id || "";
    $("#m-since").value = m && m.since ? m.since : U.dateKey(new Date());
    $("#m-notes").value = m ? m.notes || "" : "";
    $("#member-error").hidden = true;
    $("#member-dialog").showModal();
    $("#m-name").focus();
  }

  $("#new-member").addEventListener("click", () => openMember(null));

  $("#member-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#member-error");
    const name = $("#m-name").value.trim();
    try {
      if (name.length < 2) throw new Error("Escribí el nombre.");
      await S.saveMember(Object.assign({}, state.editing || { active: true }, {
        name,
        phone: $("#m-phone").value.trim(),
        planId: $("#m-plan").value,
        since: $("#m-since").value,
        notes: $("#m-notes").value.trim()
      }));
      $("#member-dialog").close();
      await reloadMembers();
      toast("Socio guardado");
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  async function loadSample() {
    const plans = state.settings.plans.map((p) => p.id);
    const since = U.dateKey(new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1));
    const names = [
      ["Lucía Fernández", "11 2345 6789"], ["Martín Gómez", "11 3456 7890"], ["Sofía Romero", "11 4567 8901"],
      ["Diego Álvarez", "11 5678 9012"], ["Valentina Torres", "11 6789 0123"], ["Tomás Ruiz", "11 7890 1234"]
    ];
    const saved = [];
    for (const [i, [name, phone]] of names.entries()) {
      saved.push(await S.saveMember({ name, phone, planId: plans[i % plans.length], since, notes: "", active: true }));
    }
    for (const m of saved.slice(0, 2)) {
      await S.addPayment({ memberId: m.id, period: period(), amount: priceOf(m), method: "Efectivo", paidOn: U.dateKey(new Date()) });
    }
    await reloadMembers();
    await loadMonth();
  }

  // ---------- Configuración ----------
  function planRow(p) {
    const row = el("div", { class: "plan-row", "data-id": p.id },
      el("input", { type: "text", "data-field": "name", value: p.name, maxlength: "40", "aria-label": "Nombre del plan" }),
      el("input", { type: "number", "data-field": "price", value: p.price != null ? String(p.price) : "", min: "0", "aria-label": "Precio por mes" }),
      el("button", { class: "btn danger sm", type: "button", onclick: () => row.remove(), "aria-label": "Quitar plan" }, "✕")
    );
    return row;
  }

  function renderSettings() {
    const s = state.settings;
    $("#s-name").value = s.businessName;
    $("#s-due").value = String(s.dueDay);
    $("#s-alias").value = s.alias || "";
    $("#s-cc").value = s.countryCode || "";
    $("#plans-edit").replaceChildren(...s.plans.map(planRow));
  }

  $("#add-plan").addEventListener("click", () => {
    const row = planRow({ id: "p" + Date.now(), name: "", price: "" });
    $("#plans-edit").append(row);
    row.querySelector("input").focus();
  });

  $("#tab-settings").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#save-error");
    err.hidden = true;
    try {
      const plans = [...document.querySelectorAll(".plan-row[data-id]")].map((row) => ({
        id: row.dataset.id,
        name: row.querySelector('[data-field="name"]').value.trim(),
        price: Number(row.querySelector('[data-field="price"]').value) || 0
      })).filter((p) => p.name);
      if (!plans.length) throw new Error("Cargá al menos un plan.");
      const name = $("#s-name").value.trim();
      if (!name) throw new Error("Poné el nombre de tu negocio.");
      const next = {
        businessName: name,
        dueDay: Math.min(28, Math.max(1, Number($("#s-due").value) || 10)),
        alias: $("#s-alias").value.trim(),
        countryCode: $("#s-cc").value.replace(/\D/g, ""),
        plans
      };
      await S.saveSettings(next);
      state.settings = next;
      $("#title").textContent = next.businessName;
      $("#logo").textContent = initials(next.businessName);
      renderMonth();
      renderMembers();
      toast("Cambios guardados");
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  // ---------- Inicio ----------
  async function showApp() {
    $("#login").hidden = true;
    $("#app").hidden = false;
    $("#logout").hidden = !S.isRemote;
    $("#mode").textContent = S.isRemote ? "Conectado a la base de datos" : "Modo demo · datos guardados en este navegador";
    state.settings = await S.getSettings();
    $("#title").textContent = state.settings.businessName;
    $("#logo").textContent = initials(state.settings.businessName);
    document.title = "Cuotas · " + state.settings.businessName;
    const today = new Date();
    state.month = new Date(today.getFullYear(), today.getMonth(), 1);
    state.members = await S.listMembers();
    renderSettings();
    renderMembers();
    await loadMonth();
  }

  const session = await S.getSession().catch(() => null);
  if (session) await showApp();
  else $("#login").hidden = false;
})();
