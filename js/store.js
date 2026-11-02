// Capa de datos: usa Supabase si está configurado, si no guarda en el navegador (modo demo).
(function () {
  const cfg = window.APP_CONFIG || {};

  const DEFAULT_SETTINGS = {
    businessName: "Mi Gimnasio",
    dueDay: 10,
    alias: "",
    countryCode: "549",
    plans: [
      { id: "libre", name: "Pase libre", price: 30000 },
      { id: "3x", name: "3 veces por semana", price: 24000 },
      { id: "2x", name: "2 veces por semana", price: 18000 }
    ]
  };

  const withDefaults = (data) => Object.assign({}, DEFAULT_SETTINGS, data || {});
  const byName = (a, b) => a.name.localeCompare(b.name, "es");

  // ---------- Modo demo (localStorage) ----------
  const LS_SETTINGS = "cuotas.settings";
  const LS_MEMBERS = "cuotas.members";
  const LS_PAYMENTS = "cuotas.payments";

  function lsGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new Error("No se pudo guardar en este navegador.");
    }
  }

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const localStore = {
    isRemote: false,
    async getSettings() { return withDefaults(lsGet(LS_SETTINGS, null)); },
    async saveSettings(s) { lsSet(LS_SETTINGS, s); },
    async listMembers() { return lsGet(LS_MEMBERS, []).sort(byName); },
    async saveMember(m) {
      const all = lsGet(LS_MEMBERS, []);
      const member = Object.assign({ active: true }, m, { id: m.id || newId() });
      const i = all.findIndex((x) => x.id === member.id);
      if (i >= 0) all[i] = member;
      else all.push(member);
      lsSet(LS_MEMBERS, all);
      return member;
    },
    async listPayments(period) {
      return lsGet(LS_PAYMENTS, []).filter((p) => p.period === period);
    },
    async addPayment(p) {
      const all = lsGet(LS_PAYMENTS, []);
      if (all.some((x) => x.memberId === p.memberId && x.period === p.period)) throw new Error("Ese mes ya está pagado.");
      all.push(Object.assign({ id: newId() }, p));
      lsSet(LS_PAYMENTS, all);
    },
    async deletePayment(id) {
      lsSet(LS_PAYMENTS, lsGet(LS_PAYMENTS, []).filter((p) => p.id !== id));
    },
    async getSession() { return { local: true }; },
    async signIn() {},
    async signOut() {}
  };

  // ---------- Supabase ----------
  function makeRemoteStore() {
    const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const check = ({ data, error }) => {
      if (error) throw new Error(error.code === "23505" ? "Ese mes ya está pagado." : error.message);
      return data;
    };
    const toMember = (r) => ({
      id: r.id, name: r.name, phone: r.phone, planId: r.plan_id, since: r.since, notes: r.notes, active: r.active
    });
    const toPayment = (r) => ({
      id: r.id, memberId: r.member_id, period: r.period, amount: Number(r.amount), method: r.method, paidOn: r.paid_on
    });

    return {
      isRemote: true,
      async getSettings() {
        const row = check(await db.from("settings").select("data").eq("id", 1).maybeSingle());
        return withDefaults(row && row.data);
      },
      async saveSettings(s) {
        check(await db.from("settings").upsert({ id: 1, data: s }));
      },
      async listMembers() {
        return check(await db.from("members").select("*").order("name")).map(toMember);
      },
      async saveMember(m) {
        const row = { name: m.name, phone: m.phone, plan_id: m.planId, since: m.since, notes: m.notes, active: m.active !== false };
        if (m.id) row.id = m.id;
        return toMember(check(await db.from("members").upsert(row).select().single()));
      },
      async listPayments(period) {
        return check(await db.from("payments").select("*").eq("period", period)).map(toPayment);
      },
      async addPayment(p) {
        check(await db.from("payments").insert({
          member_id: p.memberId, period: p.period, amount: p.amount, method: p.method, paid_on: p.paidOn
        }));
      },
      async deletePayment(id) {
        check(await db.from("payments").delete().eq("id", id));
      },
      async getSession() {
        return check(await db.auth.getSession()).session;
      },
      async signIn(email, password) {
        check(await db.auth.signInWithPassword({ email, password }));
      },
      async signOut() {
        await db.auth.signOut();
      }
    };
  }

  const useRemote = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase;
  window.Store = useRemote ? makeRemoteStore() : localStore;
})();
