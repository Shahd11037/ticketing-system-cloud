import { useState, useEffect } from "react";

// ── API base URLs ──────────────────────────────────────────────────────────
const API = {
  tickets:      "http://localhost:5001",
  support:      "http://localhost:5002",
  reporting:    "http://localhost:5003",
  notification: "http://localhost:5004",
};

// ── Minimal hardcoded users (no auth service yet) ──────────────────────────
const MOCK_USERS = [
  { id: 1, email: "customer@demo.com", password: "demo", role: "customer", name: "Alex Johnson" },
  { id: 2, email: "agent@demo.com",    password: "demo", role: "agent",    name: "Sara Williams" },
  { id: 3, email: "admin@demo.com",    password: "demo", role: "admin",    name: "Omar Hassan" },
];

// ── Styles injected once ───────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Lato:wght@300;400;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --coral:    #FF385C;
    --coral-dk: #E31C5F;
    --charcoal: #222222;
    --mid:      #717171;
    --border:   #DDDDDD;
    --bg:       #F7F7F7;
    --white:    #FFFFFF;
    --success:  #008A05;
    --warn:     #C13515;
    --radius:   16px;
    --shadow:   0 2px 16px rgba(0,0,0,0.10);
    --shadow-hover: 0 4px 28px rgba(0,0,0,0.16);
    --font-head: 'Plus Jakarta Sans', sans-serif;
    --font-body: 'Lato', sans-serif;
    --transition: 0.22s cubic-bezier(0.4,0,0.2,1);
  }

  html, body, #root {
    height: 100%;
    background: var(--bg);
    font-family: var(--font-body);
    color: var(--charcoal);
    -webkit-font-smoothing: antialiased;
  }

  /* ── scrollbar ── */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

  /* ── reusable card ── */
  .card {
    background: var(--white);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    transition: box-shadow var(--transition);
  }
  .card:hover { box-shadow: var(--shadow-hover); }

  /* ── button primary (coral) ── */
  .btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: linear-gradient(to right, #FF385C, #E31C5F);
    color: #fff; border: none; border-radius: 10px;
    font-family: var(--font-head); font-weight: 600; font-size: 15px;
    padding: 13px 24px; cursor: pointer;
    transition: opacity var(--transition), transform var(--transition), box-shadow var(--transition);
    box-shadow: 0 2px 12px rgba(255,56,92,0.25);
  }
  .btn-primary:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,56,92,0.35); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── button ghost ── */
  .btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    background: transparent; color: var(--charcoal);
    border: 1.5px solid var(--border); border-radius: 10px;
    font-family: var(--font-head); font-weight: 600; font-size: 14px;
    padding: 10px 20px; cursor: pointer;
    transition: border-color var(--transition), background var(--transition);
  }
  .btn-ghost:hover { border-color: var(--charcoal); background: var(--bg); }

  /* ── button danger ── */
  .btn-danger {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    background: transparent; color: var(--warn);
    border: 1.5px solid var(--warn); border-radius: 10px;
    font-family: var(--font-head); font-weight: 600; font-size: 13px;
    padding: 8px 16px; cursor: pointer;
    transition: background var(--transition), color var(--transition);
  }
  .btn-danger:hover { background: var(--warn); color: #fff; }

  /* ── button success ── */
  .btn-success {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    background: transparent; color: var(--success);
    border: 1.5px solid var(--success); border-radius: 10px;
    font-family: var(--font-head); font-weight: 600; font-size: 13px;
    padding: 8px 16px; cursor: pointer;
    transition: background var(--transition), color var(--transition);
  }
  .btn-success:hover { background: var(--success); color: #fff; }

  /* ── input ── */
  .input {
    width: 100%; padding: 13px 16px;
    border: 1.5px solid var(--border); border-radius: 10px;
    font-family: var(--font-body); font-size: 15px; color: var(--charcoal);
    background: var(--white); outline: none;
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .input:focus { border-color: var(--charcoal); box-shadow: 0 0 0 3px rgba(34,34,34,0.08); }
  .input::placeholder { color: #AAAAAA; }

  /* ── textarea ── */
  textarea.input { resize: vertical; min-height: 100px; }

  /* ── status badge ── */
  .badge {
    display: inline-block; padding: 4px 12px; border-radius: 99px;
    font-family: var(--font-head); font-size: 12px; font-weight: 700; letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .badge-open       { background: #FFF0F2; color: #FF385C; }
  .badge-in_progress{ background: #FFF7E6; color: #C47D00; }
  .badge-resolved   { background: #EDFAF0; color: #008A05; }
  .badge-closed     { background: #F2F2F2; color: #717171; }

  /* ── label ── */
  .label {
    display: block; margin-bottom: 6px;
    font-family: var(--font-head); font-size: 13px; font-weight: 700;
    color: var(--charcoal); letter-spacing: 0.1px;
  }

  /* ── fade-in animation ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.45s cubic-bezier(0.4,0,0.2,1) both; }
  .fade-up-2 { animation: fadeUp 0.45s 0.08s cubic-bezier(0.4,0,0.2,1) both; }
  .fade-up-3 { animation: fadeUp 0.45s 0.16s cubic-bezier(0.4,0,0.2,1) both; }
  .fade-up-4 { animation: fadeUp 0.45s 0.24s cubic-bezier(0.4,0,0.2,1) both; }

  /* ── toast ── */
  .toast-wrap {
    position: fixed; bottom: 28px; right: 28px; z-index: 999;
    display: flex; flex-direction: column; gap: 10px; pointer-events: none;
  }
  .toast {
    padding: 14px 20px; border-radius: 12px;
    font-family: var(--font-head); font-size: 14px; font-weight: 600;
    box-shadow: 0 4px 24px rgba(0,0,0,0.14);
    animation: fadeUp 0.3s ease both;
    pointer-events: all;
  }
  .toast-success { background: #222; color: #fff; }
  .toast-error   { background: var(--warn); color: #fff; }

  /* ── navbar ── */
  .navbar {
    position: sticky; top: 0; z-index: 100;
    background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 40px; height: 72px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .navbar-logo {
    font-family: var(--font-head); font-size: 22px; font-weight: 800;
    color: var(--coral); letter-spacing: -0.5px;
  }
  .navbar-logo span { color: var(--charcoal); }
  .navbar-user {
    display: flex; align-items: center; gap: 12px;
  }
  .navbar-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: linear-gradient(135deg, #FF385C, #E31C5F);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-head); font-weight: 700; font-size: 15px; color: #fff;
  }
  .navbar-name {
    font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--charcoal);
  }
  .navbar-role {
    font-size: 12px; color: var(--mid); font-family: var(--font-body);
  }

  /* ── tabs ── */
  .tabs { display: flex; gap: 4px; border-bottom: 1.5px solid var(--border); margin-bottom: 28px; }
  .tab {
    padding: 12px 20px; cursor: pointer;
    font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--mid);
    border-bottom: 2.5px solid transparent; margin-bottom: -1.5px;
    transition: color var(--transition), border-color var(--transition);
  }
  .tab:hover { color: var(--charcoal); }
  .tab.active { color: var(--charcoal); border-bottom-color: var(--charcoal); }

  /* ── page wrapper ── */
  .page { max-width: 1120px; margin: 0 auto; padding: 40px 24px 80px; }

  /* ── section title ── */
  .section-title {
    font-family: var(--font-head); font-size: 26px; font-weight: 800;
    color: var(--charcoal); letter-spacing: -0.5px; margin-bottom: 6px;
  }
  .section-sub {
    font-size: 15px; color: var(--mid); margin-bottom: 28px;
  }

  /* ── grid ── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  @media (max-width: 768px) {
    .grid-2, .grid-3 { grid-template-columns: 1fr; }
    .navbar { padding: 0 20px; }
    .page { padding: 28px 16px 60px; }
  }

  /* ── ticket card ── */
  .ticket-card { padding: 22px 24px; }
  .ticket-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .ticket-title { font-family: var(--font-head); font-size: 16px; font-weight: 700; color: var(--charcoal); }
  .ticket-desc  { font-size: 14px; color: var(--mid); line-height: 1.55; margin-bottom: 16px; }
  .ticket-meta  { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  .ticket-meta-item { font-size: 13px; color: var(--mid); display: flex; align-items: center; gap: 5px; }

  /* ── stat card ── */
  .stat-card { padding: 28px 24px; }
  .stat-value { font-family: var(--font-head); font-size: 42px; font-weight: 800; color: var(--charcoal); letter-spacing: -1px; line-height: 1; margin-bottom: 6px; }
  .stat-label { font-size: 14px; color: var(--mid); font-family: var(--font-head); font-weight: 500; }

  /* ── form card ── */
  .form-card { padding: 32px 28px; }
  .form-group { margin-bottom: 20px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  /* ── notification item ── */
  .notif-item { padding: 16px 20px; border-bottom: 1px solid var(--bg); display: flex; gap: 14px; align-items: flex-start; }
  .notif-item:last-child { border-bottom: none; }
  .notif-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--coral); margin-top: 5px; flex-shrink: 0; }
  .notif-msg  { font-size: 14px; color: var(--charcoal); line-height: 1.5; }
  .notif-time { font-size: 12px; color: var(--mid); margin-top: 3px; }

  /* ── empty state ── */
  .empty { text-align: center; padding: 60px 24px; }
  .empty-icon { font-size: 48px; margin-bottom: 14px; }
  .empty-title { font-family: var(--font-head); font-weight: 700; font-size: 18px; color: var(--charcoal); margin-bottom: 6px; }
  .empty-sub   { font-size: 14px; color: var(--mid); }

  /* ── login page ── */
  .login-page {
    min-height: 100vh; display: flex;
    background: linear-gradient(135deg, #fff5f6 0%, #fff 50%, #f0f4ff 100%);
  }
  .login-left {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 48px;
  }
  .login-right {
    flex: 1; background: linear-gradient(160deg, #FF385C 0%, #bd1e51 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 48px; position: relative; overflow: hidden;
  }
  .login-right::before {
    content: ''; position: absolute; inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .login-card { width: 100%; max-width: 400px; }
  .login-logo { font-family: var(--font-head); font-size: 28px; font-weight: 800; color: var(--coral); margin-bottom: 6px; }
  .login-logo span { color: var(--charcoal); }
  .login-tagline { font-size: 14px; color: var(--mid); margin-bottom: 40px; }
  .login-title { font-family: var(--font-head); font-size: 26px; font-weight: 800; color: var(--charcoal); margin-bottom: 28px; }
  .login-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
  .login-divider-line { flex: 1; height: 1px; background: var(--border); }
  .login-divider-text { font-size: 13px; color: var(--mid); white-space: nowrap; }
  .login-quick { display: flex; flex-direction: column; gap: 10px; }
  .login-quick-btn {
    padding: 12px 16px; border-radius: 10px; border: 1.5px solid var(--border);
    background: var(--white); cursor: pointer; display: flex; align-items: center; gap: 12px;
    font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--charcoal);
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .login-quick-btn:hover { border-color: var(--coral); box-shadow: 0 2px 12px rgba(255,56,92,0.12); }
  .login-quick-role { font-size: 12px; color: var(--mid); font-weight: 400; margin-left: auto; }
  .login-right-title { font-family: var(--font-head); font-size: 36px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 20px; position: relative; z-index: 1; }
  .login-right-sub { font-size: 16px; color: rgba(255,255,255,0.8); line-height: 1.6; position: relative; z-index: 1; }
  .login-right-dots { display: flex; gap: 8px; margin-top: 40px; position: relative; z-index: 1; }
  .login-right-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.4); }
  .login-right-dot.active { background: #fff; width: 24px; border-radius: 4px; }
  @media (max-width: 768px) {
    .login-page { flex-direction: column; }
    .login-right { display: none; }
  }
`;

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Toast system ───────────────────────────────────────────────────────────
let toastSetters = [];
function useToast() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => { toastSetters.push(setToasts); return () => { toastSetters = toastSetters.filter(s => s !== setToasts); }; }, []);
  return toasts;
}
function toast(msg, type = "success") {
  const id = Date.now();
  toastSetters.forEach(s => s(prev => [...prev, { id, msg, type }]));
  setTimeout(() => toastSetters.forEach(s => s(prev => prev.filter(t => t.id !== id))), 3500);
}

// ── Components ─────────────────────────────────────────────────────────────
function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-logo">support<span>desk</span></div>
      <div className="navbar-user">
        <div>
          <div className="navbar-name">{user.name}</div>
          <div className="navbar-role">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</div>
        </div>
        <div className="navbar-avatar">{initials(user.name)}</div>
        <button className="btn-ghost" style={{ marginLeft: 8 }} onClick={onLogout}>Sign out</button>
      </div>
    </nav>
  );
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status?.replace("_", " ")}</span>;
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  );
}

// ── Login Page ─────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    setTimeout(() => {
      const user = MOCK_USERS.find(u => u.email === email && u.password === password);
      if (user) { onLogin(user); }
      else { setError("Invalid email or password. Try the quick-login buttons below."); }
      setLoading(false);
    }, 600);
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-card fade-up">
          <div className="login-logo">support<span>desk</span></div>
          <div className="login-tagline">Customer support, beautifully managed.</div>
          <div className="login-title">Welcome back</div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label">Email address</label>
              <input className="input" type="email" placeholder="you@company.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 16, fontFamily: "var(--font-head)", fontWeight: 600 }}>{error}</div>}
            <button className="btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="login-divider">
            <div className="login-divider-line" />
            <div className="login-divider-text">or quick demo login</div>
            <div className="login-divider-line" />
          </div>

          <div className="login-quick">
            {MOCK_USERS.map(u => (
              <button key={u.id} className="login-quick-btn" onClick={() => onLogin(u)}>
                <div className="navbar-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{initials(u.name)}</div>
                <div>
                  <div>{u.name}</div>
                  <div style={{ fontSize: 12, color: "var(--mid)", fontWeight: 400 }}>{u.email}</div>
                </div>
                <div className="login-quick-role">{u.role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-title">Support that<br />feels human.</div>
        <div className="login-right-sub">Track every ticket from submission to resolution — with the transparency your customers deserve.</div>
        <div className="login-right-dots">
          <div className="login-right-dot active" />
          <div className="login-right-dot" />
          <div className="login-right-dot" />
        </div>
      </div>
    </div>
  );
}

// ── Customer Dashboard ─────────────────────────────────────────────────────
function CustomerDashboard({ user }) {
  const [tab, setTab] = useState("tickets");
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchTickets(); fetchNotifications(); }, []);

  async function fetchTickets() {
    setLoading(true);
    try {
      const r = await fetch(`${API.tickets}/tickets?created_by=${user.id}`);
      if (r.ok) setTickets(await r.json());
    } catch { toast("Could not reach ticket service", "error"); }
    setLoading(false);
  }

  async function fetchNotifications() {
    try {
      const r = await fetch(`${API.notification}/notifications`);
      if (r.ok) {
        const all = await r.json();
        setNotifications(all.filter(n => n.user_id === user.id));
      }
    } catch {}
  }

  async function handleSubmit() {
    if (!form.title.trim()) return toast("Title is required", "error");
    setSubmitting(true);
    try {
      const r = await fetch(`${API.tickets}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description, created_by: user.id }),
      });
      if (r.ok) {
        toast("Ticket submitted successfully ✓");
        setForm({ title: "", description: "" });
        fetchTickets();
      } else {
        const err = await r.json();
        toast(err.detail || "Failed to submit", "error");
      }
    } catch { toast("Could not reach ticket service", "error"); }
    setSubmitting(false);
  }

  const open = tickets.filter(t => t.status === "open").length;
  const inProg = tickets.filter(t => t.status === "in_progress").length;
  const resolved = tickets.filter(t => ["resolved","closed"].includes(t.status)).length;

  return (
    <div className="page">
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <div className="section-title">Hello, {user.name.split(" ")[0]} 👋</div>
        <div className="section-sub">Here's an overview of your support requests.</div>
        <div className="grid-3" style={{ marginTop: 20 }}>
          {[
            { label: "Open Tickets", value: open, color: "#FF385C" },
            { label: "In Progress", value: inProg, color: "#C47D00" },
            { label: "Resolved", value: resolved, color: "#008A05" },
          ].map((s, i) => (
            <div key={i} className={`card stat-card fade-up-${i+2}`}>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tabs fade-up-2">
        {["tickets", "new", "notifications"].map(t => (
          <div key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "tickets" ? `My Tickets (${tickets.length})` : t === "new" ? "New Ticket" : `Notifications (${notifications.length})`}
          </div>
        ))}
      </div>

      {tab === "tickets" && (
        loading ? <div style={{ color: "var(--mid)", fontFamily: "var(--font-head)" }}>Loading…</div>
        : tickets.length === 0
          ? <EmptyState icon="🎫" title="No tickets yet" sub="Submit your first support request below." />
          : <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {tickets.map(t => (
                <div key={t.id} className="card ticket-card fade-up">
                  <div className="ticket-card-top">
                    <div className="ticket-title">{t.title}</div>
                    <StatusBadge status={t.status} />
                  </div>
                  {t.description && <div className="ticket-desc">{t.description}</div>}
                  <div className="ticket-meta">
                    <span className="ticket-meta-item">🎫 #{t.id}</span>
                    <span className="ticket-meta-item">📅 {formatDate(t.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
      )}

      {tab === "new" && (
        <div className="card form-card fade-up" style={{ maxWidth: 580 }}>
          <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 18, marginBottom: 22 }}>Submit a new ticket</div>
          <div className="form-group">
            <label className="label">Subject</label>
            <input className="input" placeholder="Briefly describe your issue…"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Details <span style={{ color: "var(--mid)", fontWeight: 400 }}>(optional)</span></label>
            <textarea className="input" placeholder="Provide more context so our team can help faster…"
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit ticket"}
          </button>
        </div>
      )}

      {tab === "notifications" && (
        notifications.length === 0
          ? <EmptyState icon="🔔" title="All caught up" sub="You'll see ticket updates here." />
          : <div className="card fade-up" style={{ padding: 0, overflow: "hidden" }}>
              {notifications.map(n => (
                <div key={n.id} className="notif-item">
                  <div className="notif-dot" />
                  <div>
                    <div className="notif-msg">{n.message}</div>
                    <div className="notif-time">{formatDate(n.sent_at)}</div>
                  </div>
                </div>
              ))}
            </div>
      )}
    </div>
  );
}

// ── Agent / Admin Dashboard ────────────────────────────────────────────────
function AgentDashboard({ user }) {
  const [tab, setTab] = useState("all");
  const [tickets, setTickets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [resolveForm, setResolveForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [tr, ar] = await Promise.all([
        fetch(`${API.tickets}/tickets`),
        fetch(`${API.support}/assignments`),
      ]);
      if (tr.ok) setTickets(await tr.json());
      if (ar.ok) setAssignments(await ar.json());
    } catch { toast("Could not reach services", "error"); }
    setLoading(false);
  }

  async function assignTicket(ticketId) {
    setActionLoading(ticketId + "-assign");
    try {
      const r = await fetch(`${API.support}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId, agent_id: user.id }),
      });
      if (r.ok) { toast("Ticket assigned to you ✓"); fetchAll(); }
      else { const e = await r.json(); toast(e.detail || "Failed", "error"); }
    } catch { toast("Service unreachable", "error"); }
    setActionLoading(null);
  }

  async function resolveTicket(ticketId) {
    const notes = resolveForm[ticketId] || "";
    if (!notes.trim()) return toast("Please enter resolution notes", "error");
    setActionLoading(ticketId + "-resolve");
    try {
      const r = await fetch(`${API.support}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId, notes }),
      });
      if (r.ok) { toast("Ticket resolved ✓"); fetchAll(); }
      else { const e = await r.json(); toast(e.detail || "Failed", "error"); }
    } catch { toast("Service unreachable", "error"); }
    setActionLoading(null);
  }

  async function closeTicket(ticketId) {
    setActionLoading(ticketId + "-close");
    try {
      const r = await fetch(`${API.support}/assignments/${ticketId}/close`, { method: "POST" });
      if (r.ok) { toast("Ticket closed ✓"); fetchAll(); }
      else { const e = await r.json(); toast(e.detail || "Failed", "error"); }
    } catch { toast("Service unreachable", "error"); }
    setActionLoading(null);
  }

  async function deleteTicket(ticketId) {
    setActionLoading(ticketId + "-delete");
    try {
      const r = await fetch(`${API.tickets}/tickets/${ticketId}`, { method: "DELETE" });
      if (r.status === 204) { toast("Ticket deleted"); fetchAll(); }
      else { const e = await r.json(); toast(e.detail || "Failed", "error"); }
    } catch { toast("Service unreachable", "error"); }
    setActionLoading(null);
  }

  const myAssigned = assignments.filter(a => a.agent_id === user.id);
  const openTickets = tickets.filter(t => t.status === "open");
  const assignedIds = new Set(assignments.map(a => a.ticket_id));

  return (
    <div className="page">
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <div className="section-title">Agent Dashboard</div>
        <div className="section-sub">Manage and resolve customer tickets.</div>
        <div className="grid-3" style={{ marginTop: 20 }}>
          {[
            { label: "Open Tickets", value: openTickets.length, color: "#FF385C" },
            { label: "My Assignments", value: myAssigned.length, color: "#C47D00" },
            { label: "Total Tickets", value: tickets.length, color: "#222" },
          ].map((s, i) => (
            <div key={i} className={`card stat-card fade-up-${i + 2}`}>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tabs fade-up-2">
        {[
          { key: "all", label: `All Tickets (${tickets.length})` },
          { key: "mine", label: `My Assignments (${myAssigned.length})` },
          { key: "open", label: `Unassigned (${openTickets.filter(t => !assignedIds.has(t.id)).length})` },
        ].map(t => (
          <div key={t.key} className={`tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</div>
        ))}
      </div>

      {loading ? <div style={{ color: "var(--mid)", fontFamily: "var(--font-head)" }}>Loading…</div> : (() => {
        let list = tab === "mine"
          ? tickets.filter(t => myAssigned.some(a => a.ticket_id === t.id))
          : tab === "open"
            ? openTickets.filter(t => !assignedIds.has(t.id))
            : tickets;

        if (!list.length) return <EmptyState icon="✅" title="Nothing here" sub="All clear!" />;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {list.map(t => {
              const assigned = assignedIds.has(t.id);
              const al = actionLoading;
              return (
                <div key={t.id} className="card ticket-card fade-up">
                  <div className="ticket-card-top">
                    <div>
                      <div className="ticket-title">{t.title}</div>
                      <div className="ticket-meta" style={{ marginTop: 6 }}>
                        <span className="ticket-meta-item">🎫 #{t.id}</span>
                        <span className="ticket-meta-item">👤 User #{t.created_by}</span>
                        <span className="ticket-meta-item">📅 {formatDate(t.created_at)}</span>
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  {t.description && <div className="ticket-desc">{t.description}</div>}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "flex-end" }}>
                    {t.status === "open" && !assigned && (
                      <button className="btn-success" onClick={() => assignTicket(t.id)} disabled={al === t.id + "-assign"}>
                        {al === t.id + "-assign" ? "Assigning…" : "✓ Assign to me"}
                      </button>
                    )}
                    {t.status === "in_progress" && (
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", flex: 1 }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <input className="input" placeholder="Resolution notes…"
                            value={resolveForm[t.id] || ""}
                            onChange={e => setResolveForm({ ...resolveForm, [t.id]: e.target.value })}
                            style={{ fontSize: 13 }} />
                        </div>
                        <button className="btn-success" onClick={() => resolveTicket(t.id)} disabled={al === t.id + "-resolve"}>
                          {al === t.id + "-resolve" ? "Resolving…" : "✓ Resolve"}
                        </button>
                      </div>
                    )}
                    {t.status === "resolved" && (
                      <button className="btn-ghost" onClick={() => closeTicket(t.id)} disabled={al === t.id + "-close"}>
                        {al === t.id + "-close" ? "Closing…" : "Close ticket"}
                      </button>
                    )}
                    {user.role === "admin" && (
                      <button className="btn-danger" onClick={() => deleteTicket(t.id)} disabled={al === t.id + "-delete"}>
                        {al === t.id + "-delete" ? "Deleting…" : "🗑 Delete"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ── Reports Page ───────────────────────────────────────────────────────────
function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API.reporting}/reports/summary`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setReport(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusColors = { open: "#FF385C", in_progress: "#C47D00", resolved: "#008A05", closed: "#717171" };

  return (
    <div className="page">
      <div className="fade-up">
        <div className="section-title">Reports & Analytics</div>
        <div className="section-sub">Live performance metrics from the reporting service.</div>
      </div>

      {loading && <div style={{ color: "var(--mid)", fontFamily: "var(--font-head)" }}>Loading report…</div>}

      {!loading && !report && (
        <EmptyState icon="📊" title="Report unavailable" sub="The reporting service may be offline. Make sure it's running on port 5003." />
      )}

      {report && (
        <>
          <div className="card stat-card fade-up-2" style={{ maxWidth: 320, marginBottom: 28 }}>
            <div className="stat-value">{Math.round(report.average_response_time_minutes)}<span style={{ fontSize: 20, fontWeight: 600 }}>m</span></div>
            <div className="stat-label">Avg. Response Time</div>
          </div>

          <div className="fade-up-3">
            <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Tickets by Status</div>
            <div className="grid-3">
              {Object.entries(report.total_tickets_by_status).map(([status, count]) => (
                <div key={status} className="card stat-card">
                  <div className="stat-value" style={{ color: statusColors[status] || "#222" }}>{count}</div>
                  <div className="stat-label">{status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("main");
  const toasts = useToast();

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  if (!user) return <LoginPage onLogin={setUser} />;

  const isAgent = user.role === "agent" || user.role === "admin";

  return (
    <>
      <Navbar user={user} onLogout={() => { setUser(null); setPage("main"); }} />

      {isAgent && (
        <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "0 40px", display: "flex", gap: 4 }}>
          {[{ key: "main", label: "Dashboard" }, { key: "reports", label: "Reports" }].map(p => (
            <div key={p.key} className={`tab${page === p.key ? " active" : ""}`} onClick={() => setPage(p.key)}>{p.label}</div>
          ))}
        </div>
      )}

      {page === "reports" ? <ReportsPage /> : isAgent ? <AgentDashboard user={user} /> : <CustomerDashboard user={user} />}

      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}