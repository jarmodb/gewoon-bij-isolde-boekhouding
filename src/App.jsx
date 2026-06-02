import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { loadAll, saveAll, subscribeToChanges } from "./storage.js";
import { uploadNaarNAS, getBewijsstukUrl } from "./webdav.js";

// ── Constants ────────────────────────────────────────────────────────────────
const TREATMENTS = [
  { naam: "Manicure (gewoon)", prijs: 0 },
  { naam: "Manicure + Gelvernis", prijs: 0 },
  { naam: "Pedicure (gewoon)", prijs: 0 },
  { naam: "Pedicure + Gelvernis", prijs: 0 },
  { naam: "Acryl nagels (set)", prijs: 0 },
  { naam: "Acryl bijwerken", prijs: 0 },
  { naam: "Gel nagels (set)", prijs: 0 },
  { naam: "Gel bijwerken", prijs: 0 },
  { naam: "Nagelverlenging", prijs: 0 },
  { naam: "Nail art (eenvoudig)", prijs: 0 },
  { naam: "Nail art (uitgebreid)", prijs: 0 },
  { naam: "Nagels verwijderen", prijs: 0 },
  { naam: "Cuticula behandeling", prijs: 0 },
  { naam: "Paraffine bad handen", prijs: 0 },
  { naam: "Paraffine bad voeten", prijs: 0 },
];

const CATEGORIES = [
  "Materialen & producten","Huur & ruimte","Verzekering",
  "Marketing & reclame","Apparatuur & gereedschap","Opleiding & cursussen",
  "Administratie & software","Telefoon & internet","Energie & water",
  "Vervoer","Overig",
];

const BETAALWIJZE = ["Pin","Contant","Tikkie","Overschrijving","Cadeau"];
const KLEUR_TYPES = ["Gelvernis","Gewone lak","Acryl","Builder gel","Polygel","Top coat","Base coat","Overig"];
const KLEUR_MERKEN = ["OPI","Essie","CND Shellac","Gelish","IBD","Orly","Sally Hansen","Depend","Kinetics","Morgan Taylor","Semilac","The Gel Bottle"];
const BEOORDELINGEN = ["⭐⭐⭐⭐⭐ Uitstekend","⭐⭐⭐⭐ Goed","⭐⭐⭐ Matig","⭐⭐ Slecht","❌ Niet meer bestellen"];

const TODAY = new Date().toISOString().slice(0, 10);
const fmt = (n) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "—";
const uid = () => Math.random().toString(36).slice(2, 9);

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0d0020",
  card: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.12)",
  purple: "#a855f7",
  pink: "#e879f9",
  green: "#22c55e",
  red: "#f87171",
  orange: "#fb923c",
  text: "#fff",
  muted: "rgba(255,255,255,0.4)",
  label: "#c8a8e9",
};

// ── UI primitives ─────────────────────────────────────────────────────────────
const Badge = ({ color, children }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`,
    borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{
    background: C.card, backdropFilter: "blur(12px)", borderRadius: 20,
    border: `1px solid ${C.border}`, padding: 18, marginBottom: 12,
    cursor: onClick ? "pointer" : "default", ...style,
  }}>{children}</div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 800, color: C.label, letterSpacing: 1.5,
    textTransform: "uppercase", marginBottom: 12, marginTop: 4 }}>{children}</div>
);

const EmptyState = ({ icon, text }) => (
  <div style={{ textAlign: "center", padding: "50px 20px", color: C.muted }}>
    <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 14 }}>{text}</div>
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 12, color: C.label, marginBottom: 5, fontWeight: 700, letterSpacing: 0.4 }}>{children}</div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <Label>{label}</Label>}
    {children}
  </div>
);

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)",
  borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 15,
  outline: "none", fontFamily: "inherit",
};

const Input = ({ label, ...props }) => (
  <Field label={label}>
    <input {...props} style={{ ...inputStyle, ...props.style }}
      onFocus={e => e.target.style.borderColor = C.pink}
      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"} />
  </Field>
);

const Textarea = ({ label, ...props }) => (
  <Field label={label}>
    <textarea {...props} rows={3} style={{ ...inputStyle, resize: "vertical", ...props.style }}
      onFocus={e => e.target.style.borderColor = C.pink}
      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"} />
  </Field>
);

const Select = ({ label, options, placeholder = "— Kies —", ...props }) => (
  <Field label={label}>
    <select {...props} style={{
      ...inputStyle, background: "#1a0635", appearance: "none",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c8a8e9' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center",
    }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  </Field>
);

const Btn = ({ children, onClick, variant = "primary", small, style, disabled, fullWidth }) => {
  const variants = {
    primary: { background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, color: "#fff" },
    secondary: { background: "rgba(255,255,255,0.09)", color: "#e2d0f8", border: "1px solid rgba(255,255,255,0.15)" },
    danger: { background: "rgba(239,68,68,0.15)", color: C.red, border: "1px solid rgba(239,68,68,0.25)" },
    success: { background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff" },
    ghost: { background: "none", color: C.muted, border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...variants[variant], borderRadius: 12,
      padding: small ? "8px 16px" : "13px 22px",
      fontSize: small ? 13 : 15, fontWeight: 700, border: "none",
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
      opacity: disabled ? 0.5 : 1, width: fullWidth ? "100%" : "auto",
      transition: "opacity 0.15s, transform 0.1s", ...style,
    }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >{children}</button>
  );
};

// ── Modal (bottom sheet) ──────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      zIndex: 100, display: "flex", alignItems: "flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg,#1a0635,#2d1547)",
        borderRadius: "24px 24px 0 0", width: "100%", maxHeight: "94vh",
        overflowY: "auto", border: "1px solid rgba(255,255,255,0.1)",
        paddingBottom: "env(safe-area-inset-bottom, 20px)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0,
          background: "linear-gradient(160deg,#1a0635,#2d1547)", zIndex: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{title}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none",
            color: "#fff", cursor: "pointer", width: 32, height: 32, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: "20px 20px 0" }}>{children}</div>
      </div>
    </div>
  );
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type = "success" }) => msg ? (
  <div style={{
    position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
    background: type === "error" ? "#ef4444" : "#22c55e",
    color: "#fff", borderRadius: 14, padding: "10px 22px",
    fontSize: 14, fontWeight: 700, zIndex: 300,
    boxShadow: "0 4px 24px rgba(0,0,0,0.5)", whiteSpace: "nowrap",
    animation: "fadeIn 0.2s ease",
  }}>{msg}</div>
) : null;

// ── Sync status indicator ─────────────────────────────────────────────────────
const SyncDot = ({ status }) => {
  const colors = { idle: "#4ade80", saving: "#facc15", error: "#f87171" };
  const labels = { idle: "Gesynchroniseerd", saving: "Opslaan...", error: "Sync mislukt" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: colors[status],
        boxShadow: `0 0 6px ${colors[status]}`,
        animation: status === "saving" ? "pulse 1s infinite" : "none",
      }} />
      <span style={{ fontSize: 10, color: colors[status] }}>{labels[status]}</span>
    </div>
  );
};

// ── Search bar ────────────────────────────────────────────────────────────────
const SearchBar = ({ value, onChange, placeholder }) => (
  <div style={{ position: "relative", marginBottom: 14 }}>
    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
      fontSize: 16, color: C.muted }}>🔍</span>
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder || "Zoeken..."}
      style={{ ...inputStyle, paddingLeft: 38, fontSize: 14 }} />
  </div>
);


// ── Bevestigingsdialoog ───────────────────────────────────────────────────────
function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 24px",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg,#1a0635,#2d1547)",
        borderRadius: 20, padding: "28px 24px", maxWidth: 360, width: "100%",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: 8 }}>
          Weet je het zeker?
        </div>
        <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.07)", color: "#e2d0f8", fontWeight: 700,
            fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>Annuleren</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", fontWeight: 700,
            fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>Verwijderen</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function Dashboard({ inkomsten, uitgaven, kleuren }) {
  const now = new Date();
  const thisMonthInc = inkomsten
    .filter(x => { const d = new Date(x.datum); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((s, x) => s + (parseFloat(x.prijs) || 0), 0);
  const thisMonthExp = uitgaven
    .filter(x => { const d = new Date(x.datum); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((s, x) => s + (parseFloat(x.bedragIncl) || 0), 0);
  const winst = thisMonthInc - thisMonthExp;
  const allInc = inkomsten.reduce((s, x) => s + (parseFloat(x.prijs) || 0), 0);
  const allExp = uitgaven.reduce((s, x) => s + (parseFloat(x.bedragIncl) || 0), 0);

  const behandelingCount = {};
  inkomsten.forEach(x => { if (x.behandeling) behandelingCount[x.behandeling] = (behandelingCount[x.behandeling] || 0) + 1; });
  const topBeh = Object.entries(behandelingCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const maandNaam = now.toLocaleDateString("nl-NL", { month: "long" });
  const nognietBeoordeeld = kleuren.filter(k => !k.beoordeling).length;

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 2 }}>Hoi! 💅</div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 22 }}>
        {now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
      </div>

      {/* Maand stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[
          { label: "Inkomsten", value: thisMonthInc, color: C.green, icon: "↑" },
          { label: "Uitgaven", value: thisMonthExp, color: C.red, icon: "↓" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: `${color}18`, border: `1px solid ${color}30`,
            borderRadius: 18, padding: "16px 14px" }}>
            <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 4 }}>{icon} {label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{fmt(value)}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{maandNaam}</div>
          </div>
        ))}
      </div>

      {/* Winst */}
      <Card style={{
        background: winst >= 0 ? "linear-gradient(135deg,#a855f718,#e879f910)" : "linear-gradient(135deg,#f8717118,#dc262610)",
        border: `1px solid ${winst >= 0 ? "#a855f740" : "#f8717140"}`,
      }}>
        <div style={{ fontSize: 12, color: winst >= 0 ? C.purple : C.red, fontWeight: 700, marginBottom: 4 }}>
          {winst >= 0 ? "✨ Winst deze maand" : "⚠️ Verlies deze maand"}
        </div>
        <div style={{ fontSize: 34, fontWeight: 900, color: "#fff" }}>{fmt(winst)}</div>
      </Card>

      {/* Jaar totaal */}
      <Card>
        <SectionTitle>Jaaroverzicht {now.getFullYear()}</SectionTitle>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {[
            { label: "Inkomsten", value: allInc, color: C.green },
            { label: "Uitgaven", value: allExp, color: C.red },
            { label: "Winst", value: allInc - allExp, color: C.purple },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color }}>{fmt(value)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Top behandelingen */}
      {topBeh.length > 0 && (
        <Card>
          <SectionTitle>Populairste behandelingen</SectionTitle>
          {topBeh.map(([naam, count], i) => (
            <div key={naam} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, fontSize: 13, fontWeight: 900,
                background: ["#e879f920","#a855f720","#7c3aed20"][i],
                color: ["#e879f9","#a855f7","#c4b5fd"][i],
                display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ flex: 1, fontSize: 14, color: "#e2d0f8" }}>{naam}</div>
              <Badge color={C.purple}>{count}×</Badge>
            </div>
          ))}
        </Card>
      )}

      {/* Kleuren hint */}
      {nognietBeoordeeld > 0 && (
        <Card style={{ background: "#fb923c18", border: "1px solid #fb923c30" }}>
          <div style={{ fontSize: 13, color: C.orange }}>
            🎨 {nognietBeoordeeld} kleur{nognietBeoordeeld > 1 ? "en" : ""} nog niet beoordeeld
          </div>
        </Card>
      )}

      {/* Recente inkomsten */}
      {inkomsten.length > 0 && (
        <Card>
          <SectionTitle>Recente inkomsten</SectionTitle>
          {[...inkomsten].sort((a, b) => new Date(b.datum) - new Date(a.datum)).slice(0, 3).map(x => (
            <div key={x.id} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{x.behandeling}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(x.datum)}{x.klant ? ` · ${x.klant}` : ""}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.green }}>{fmt(x.prijs)}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// INKOMSTEN
// ════════════════════════════════════════════════════════════════════════════
// ── Bon upload knop (gedeeld door Inkomsten en Uitgaven) ─────────────────────
function BonUpload({ onUploaded, datum, bedrag, type, uploading, setUploading }) {
  const fileRef = useRef(null);

  const handleBestand = async (bestand) => {
    if (!bestand) return;
    setUploading(true);
    try {
      const pad = await uploadNaarNAS(bestand, type, datum, bedrag);
      onUploaded(pad);
    } catch (e) {
      alert("Upload mislukt: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.label, marginBottom: 5, fontWeight: 700 }}>Bewijsstuk (optioneel)</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1.5px dashed rgba(255,255,255,0.2)",
            borderRadius: 12, padding: "12px", color: C.muted, cursor: "pointer",
            fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {uploading ? "⏳ Uploaden..." : "📎 Foto of PDF kiezen"}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment"
          style={{ display: "none" }}
          onChange={e => handleBestand(e.target.files?.[0])} />
      </div>
    </div>
  );
}

function Inkomsten({ data, prijslijst, klanten, onAdd, onDelete, onEdit }) {
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const LEEG_INC = { datum: TODAY, behandeling: "", klant: "", betaalwijze: "", prijs: "", bonPad: "" };
  const [form, setForm] = useState(LEEG_INC);
  const [btwModus, setBtwModus] = useState("incl"); // "incl" of "excl"

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Bereken altijd de drie waarden vanuit het ingevoerde bedrag + modus
  const berekenBtw = (invoer, modus) => {
    const n = parseFloat(invoer) || 0;
    if (modus === "excl") {
      return { prijs: +(n * 1.21).toFixed(2), btw: +(n * 0.21).toFixed(2), exclBtw: n };
    }
    return { prijs: n, btw: +(n / 1.21 * 0.21).toFixed(2), exclBtw: +(n / 1.21).toFixed(2) };
  };

  const openEdit = (item) => {
    setEditItem(item);
    setBtwModus("incl");
    setForm({ datum: item.datum, behandeling: item.behandeling, klant: item.klant || "",
      betaalwijze: item.betaalwijze || "", prijs: item.prijs, bonPad: item.bonPad || "" });
    setModal(true);
  };

  const handleBeh = (naam) => {
    const p = prijslijst.find(x => x.naam === naam);
    set("behandeling", naam);
    if (p?.prijs && !editItem) {
      setBtwModus("incl");
      set("prijs", p.prijs);
    }
  };

  const submit = () => {
    if (!form.behandeling || !form.prijs || !form.datum) return;
    const { prijs, btw, exclBtw } = berekenBtw(form.prijs, btwModus);
    const item = { datum: form.datum, behandeling: form.behandeling,
      klant: form.klant, betaalwijze: form.betaalwijze, bonPad: form.bonPad,
      prijs, btw, exclBtw };
    if (editItem) { onEdit({ ...editItem, ...item }); }
    else { onAdd({ id: uid(), ...item }); }
    setModal(false); setEditItem(null); setForm(LEEG_INC); setBtwModus("incl");
  };

  const filtered = [...data]
    .sort((a, b) => new Date(b.datum) - new Date(a.datum))
    .filter(x => !search || x.behandeling?.toLowerCase().includes(search.toLowerCase())
      || x.klant?.toLowerCase().includes(search.toLowerCase()));

  const totaal = filtered.reduce((s, x) => s + (parseFloat(x.prijs) || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Inkomsten</div>
        <Btn onClick={() => { setEditItem(null); setForm(LEEG_INC); setModal(true); }} small>+ Toevoegen</Btn>
      </div>

      {data.length > 0 && (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder="Zoek op behandeling of klant..." />
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
            {filtered.length} boeking{filtered.length !== 1 ? "en" : ""} · totaal {fmt(totaal)}
          </div>
        </>
      )}

      {filtered.length === 0
        ? <EmptyState icon="💰" text="Nog geen inkomsten geregistreerd" />
        : filtered.map(item => (
          <Card key={item.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{item.behandeling}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                  {fmtDate(item.datum)}{item.klant ? ` · ${item.klant}` : ""}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {item.betaalwijze && <Badge color="#6366f1">{item.betaalwijze}</Badge>}
                  <Badge color="#84cc16">excl. {fmt(item.exclBtw)}</Badge>
                  {item.bonPad && (
                    <span onClick={() => { const u = getBewijsstukUrl(item.bonPad); if (u) window.open(u, "_blank"); }}
                      style={{ cursor: "pointer" }}>
                      <Badge color="#22c55e">📎 bon</Badge>
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.green }}>{fmt(item.prijs)}</div>
                <div style={{ fontSize: 10, color: C.muted }}>BTW {fmt(item.btw)}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
                  <button onClick={() => openEdit(item)}
                    style={{ background: "none", border: "none", color: "rgba(200,168,233,0.6)", cursor: "pointer", fontSize: 15 }}>✏️</button>
                  <button onClick={() => setConfirmId(item.id)}
                    style={{ background: "none", border: "none", color: "rgba(248,113,113,0.5)", cursor: "pointer", fontSize: 15 }}>🗑</button>
                </div>
              </div>
            </div>
          </Card>
        ))
      }

      <ConfirmDialog open={!!confirmId} message="Dit inkomen wordt permanent verwijderd."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { onDelete("inkomsten", confirmId); setConfirmId(null); }} />
      <Modal open={modal} onClose={() => { setModal(false); setEditItem(null); }} title={editItem ? "Inkomen bewerken" : "Inkomen toevoegen"}>
        <Input label="Datum" type="date" value={form.datum} onChange={e => set("datum", e.target.value)} />
        <Select label="Behandeling" value={form.behandeling} onChange={e => handleBeh(e.target.value)}
          options={prijslijst.filter(p => p.naam).map(p => ({
            value: p.naam, label: p.naam + (p.prijs ? ` — ${fmt(p.prijs)}` : ""),
          }))} />
        <Field label={`Prijs ${btwModus === "incl" ? "incl." : "excl."} BTW (€)`}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" step="0.01" min="0" value={form.prijs}
              onChange={e => set("prijs", e.target.value)} placeholder="0.00"
              style={{ ...inputStyle, flex: 1 }}
              onFocus={e => e.target.style.borderColor = C.pink}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"} />
            <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.15)", flexShrink: 0 }}>
              {["incl", "excl"].map(m => (
                <button key={m} onClick={() => setBtwModus(m)} type="button" style={{
                  padding: "8px 12px", fontSize: 12, fontWeight: 700, border: "none",
                  cursor: "pointer", fontFamily: "inherit",
                  background: btwModus === m ? `linear-gradient(135deg,${C.pink},${C.purple})` : "rgba(255,255,255,0.07)",
                  color: btwModus === m ? "#fff" : C.muted,
                }}>{m}</button>
              ))}
            </div>
          </div>
        </Field>
        {form.prijs > 0 && (() => {
          const { prijs, btw, exclBtw } = berekenBtw(form.prijs, btwModus);
          return (
            <div style={{ fontSize: 12, color: C.muted, marginTop: -10, marginBottom: 14, display: "flex", gap: 12 }}>
              <span>Incl.: <span style={{ color: C.green, fontWeight: 700 }}>{fmt(prijs)}</span></span>
              <span>Excl.: {fmt(exclBtw)}</span>
              <span>BTW: {fmt(btw)}</span>
            </div>
          );
        })()}
        <Select label="Klant (optioneel)" value={form.klant} onChange={e => set("klant", e.target.value)}
          options={klanten.map(k => ({ value: `${k.voornaam} ${k.achternaam}`.trim(), label: `${k.voornaam} ${k.achternaam}`.trim() }))} />
        <Select label="Betaalwijze" value={form.betaalwijze} onChange={e => set("betaalwijze", e.target.value)}
          options={BETAALWIJZE} />
        <BonUpload type="inkomen" datum={form.datum} bedrag={form.prijs}
          uploading={uploading} setUploading={setUploading}
          onUploaded={pad => set("bonPad", pad)} />
        {form.bonPad && (
          <div style={{ fontSize: 12, color: C.green, marginBottom: 14 }}>
            ✓ Bewijsstuk opgeslagen op NAS
          </div>
        )}
        <Btn onClick={submit} fullWidth disabled={!form.behandeling || !form.prijs || uploading} style={{ marginTop: 4 }}>
          Opslaan
        </Btn>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// UITGAVEN
// ════════════════════════════════════════════════════════════════════════════
function Uitgaven({ data, leveranciers, onAdd, onDelete, onEdit }) {
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const LEEG_UIT = { datum: TODAY, categorie: "", omschrijving: "", leverancier: "", betaalwijze: "", bedrag: "", bonPad: "" };
  const [form, setForm] = useState(LEEG_UIT);
  const [btwModus, setBtwModus] = useState("excl");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const berekenUit = (invoer, modus) => {
    const n = parseFloat(invoer) || 0;
    if (modus === "incl") {
      return { bedragExcl: +(n / 1.21).toFixed(2), bedragIncl: n };
    }
    return { bedragExcl: n, bedragIncl: +(n * 1.21).toFixed(2) };
  };

  const openEdit = (item) => {
    setEditItem(item);
    setBtwModus("excl");
    setForm({ datum: item.datum, categorie: item.categorie, omschrijving: item.omschrijving || "",
      leverancier: item.leverancier || "", betaalwijze: item.betaalwijze || "",
      bedrag: item.bedragExcl, bonPad: item.bonPad || "" });
    setModal(true);
  };

  const submit = () => {
    if (!form.categorie || !form.bedrag || !form.datum) return;
    const { bedragExcl, bedragIncl } = berekenUit(form.bedrag, btwModus);
    const item = { datum: form.datum, categorie: form.categorie, omschrijving: form.omschrijving,
      leverancier: form.leverancier, betaalwijze: form.betaalwijze, bonPad: form.bonPad,
      bedragExcl, bedragIncl };
    if (editItem) { onEdit({ ...editItem, ...item }); }
    else { onAdd({ id: uid(), ...item }); }
    setModal(false); setEditItem(null); setForm(LEEG_UIT); setBtwModus("excl");
  };

  const filtered = [...data]
    .sort((a, b) => new Date(b.datum) - new Date(a.datum))
    .filter(x => !search || x.categorie?.toLowerCase().includes(search.toLowerCase())
      || x.omschrijving?.toLowerCase().includes(search.toLowerCase())
      || x.leverancier?.toLowerCase().includes(search.toLowerCase()));

  const totaal = filtered.reduce((s, x) => s + (parseFloat(x.bedragIncl) || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Uitgaven</div>
        <Btn onClick={() => { setEditItem(null); setForm(LEEG_UIT); setModal(true); }} small>+ Toevoegen</Btn>
      </div>

      {data.length > 0 && (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder="Zoek op categorie, omschrijving..." />
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
            {filtered.length} uitgave{filtered.length !== 1 ? "n" : ""} · totaal {fmt(totaal)}
          </div>
        </>
      )}

      {filtered.length === 0
        ? <EmptyState icon="🧾" text="Nog geen uitgaven geregistreerd" />
        : filtered.map(item => (
          <Card key={item.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 3 }}>
                  {item.omschrijving || item.categorie}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                  {fmtDate(item.datum)}{item.leverancier ? ` · ${item.leverancier}` : ""}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge color={C.orange}>{item.categorie}</Badge>
                  {item.betaalwijze && <Badge color="#6366f1">{item.betaalwijze}</Badge>}
                  {item.bonPad && (
                    <span onClick={() => { const u = getBewijsstukUrl(item.bonPad); if (u) window.open(u, "_blank"); }}
                      style={{ cursor: "pointer" }}>
                      <Badge color="#22c55e">📎 bon</Badge>
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.red }}>{fmt(item.bedragIncl)}</div>
                <div style={{ fontSize: 10, color: C.muted }}>excl. {fmt(item.bedragExcl)}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
                  <button onClick={() => openEdit(item)}
                    style={{ background: "none", border: "none", color: "rgba(200,168,233,0.6)", cursor: "pointer", fontSize: 15 }}>✏️</button>
                  <button onClick={() => setConfirmId(item.id)}
                    style={{ background: "none", border: "none", color: "rgba(248,113,113,0.5)", cursor: "pointer", fontSize: 15 }}>🗑</button>
                </div>
              </div>
            </div>
          </Card>
        ))
      }

      <ConfirmDialog open={!!confirmId} message="Deze uitgave wordt permanent verwijderd."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { onDelete("uitgaven", confirmId); setConfirmId(null); }} />
      <Modal open={modal} onClose={() => { setModal(false); setEditItem(null); }} title={editItem ? "Uitgave bewerken" : "Uitgave toevoegen"}>
        <Input label="Datum" type="date" value={form.datum} onChange={e => set("datum", e.target.value)} />
        <Select label="Categorie" value={form.categorie} onChange={e => set("categorie", e.target.value)} options={CATEGORIES} />
        <Input label="Omschrijving" value={form.omschrijving} onChange={e => set("omschrijving", e.target.value)} placeholder="Bijv. OPI gels besteld" />
        <Field label={`Bedrag ${btwModus === "incl" ? "incl." : "excl."} BTW (€)`}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" step="0.01" min="0" value={form.bedrag}
              onChange={e => set("bedrag", e.target.value)} placeholder="0.00"
              style={{ ...inputStyle, flex: 1 }}
              onFocus={e => e.target.style.borderColor = C.pink}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"} />
            <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.15)", flexShrink: 0 }}>
              {["incl", "excl"].map(m => (
                <button key={m} onClick={() => setBtwModus(m)} type="button" style={{
                  padding: "8px 12px", fontSize: 12, fontWeight: 700, border: "none",
                  cursor: "pointer", fontFamily: "inherit",
                  background: btwModus === m ? `linear-gradient(135deg,${C.pink},${C.purple})` : "rgba(255,255,255,0.07)",
                  color: btwModus === m ? "#fff" : C.muted,
                }}>{m}</button>
              ))}
            </div>
          </div>
        </Field>
        {form.bedrag > 0 && (() => {
          const { bedragExcl, bedragIncl } = berekenUit(form.bedrag, btwModus);
          return (
            <div style={{ fontSize: 12, color: C.muted, marginTop: -10, marginBottom: 14, display: "flex", gap: 12 }}>
              <span>Incl.: <span style={{ color: C.red, fontWeight: 700 }}>{fmt(bedragIncl)}</span></span>
              <span>Excl.: {fmt(bedragExcl)}</span>
              <span>BTW: {fmt(bedragIncl - bedragExcl)}</span>
            </div>
          );
        })()}
        <Select label="Leverancier" value={form.leverancier} onChange={e => set("leverancier", e.target.value)}
          options={leveranciers.map(l => ({ value: l.bedrijf, label: l.bedrijf }))} />
        <Select label="Betaalwijze" value={form.betaalwijze} onChange={e => set("betaalwijze", e.target.value)} options={BETAALWIJZE} />
        <BonUpload type="uitgave" datum={form.datum} bedrag={form.bedrag}
          uploading={uploading} setUploading={setUploading}
          onUploaded={pad => set("bonPad", pad)} />
        {form.bonPad && (
          <div style={{ fontSize: 12, color: C.green, marginBottom: 14 }}>
            ✓ Bewijsstuk opgeslagen op NAS
          </div>
        )}
        <Btn onClick={submit} fullWidth disabled={!form.categorie || !form.bedrag || uploading} style={{ marginTop: 4 }}>
          Opslaan
        </Btn>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RELATIES (klanten + leveranciers)
// ════════════════════════════════════════════════════════════════════════════
function Relaties({ klanten, leveranciers, prijslijst, onAddKlant, onDeleteKlant, onEditKlant, onAddLeverancier, onDeleteLeverancier }) {
  const [tab, setTab] = useState("klanten");
  const [modal, setModal] = useState(null);
  const [editKlant, setEditKlant] = useState(null);
  const [confirmKlantId, setConfirmKlantId] = useState(null);
  const [confirmLevId, setConfirmLevId] = useState(null);
  const [search, setSearch] = useState("");
  const LEEG_K = { voornaam: "", achternaam: "", telefoon: "", email: "", vasteBeh: "", notities: "" };
  const LEEG_L = { bedrijf: "", contact: "", telefoon: "", email: "", categorie: "", notities: "" };
  const [kForm, setKForm] = useState(LEEG_K);
  const [lForm, setLForm] = useState(LEEG_L);

  const openEditKlant = (k) => {
    setEditKlant(k);
    setKForm({ voornaam: k.voornaam, achternaam: k.achternaam || "", telefoon: k.telefoon || "",
      email: k.email || "", vasteBeh: k.vasteBeh || "", notities: k.notities || "" });
    setModal("klant");
  };

  const submitKlant = () => {
    if (!kForm.voornaam) return;
    if (editKlant) { onEditKlant({ ...editKlant, ...kForm }); }
    else { onAddKlant({ id: uid(), ...kForm }); }
    setModal(null); setEditKlant(null); setKForm(LEEG_K);
  };

  const submitLev = () => {
    if (!lForm.bedrijf) return;
    onAddLeverancier({ id: uid(), ...lForm });
    setModal(null);
    setLForm(LEEG_L);
  };

  const filteredK = klanten.filter(k => !search ||
    `${k.voornaam} ${k.achternaam}`.toLowerCase().includes(search.toLowerCase()) ||
    k.telefoon?.includes(search));
  const filteredL = leveranciers.filter(l => !search ||
    l.bedrijf?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
          {tab === "klanten" ? "Klanten" : "Leveranciers"}
        </div>
        <Btn small onClick={() => setModal(tab === "klanten" ? "klant" : "leverancier")}>+ Toevoegen</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["klanten","👤 Klanten"], ["leveranciers","🚚 Leveranciers"]].map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setSearch(""); }} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 700, fontSize: 13,
            border: "none", cursor: "pointer", fontFamily: "inherit",
            background: tab === k ? `linear-gradient(135deg,${C.pink},${C.purple})` : "rgba(255,255,255,0.07)",
            color: tab === k ? "#fff" : C.muted,
          }}>{l}</button>
        ))}
      </div>

      <SearchBar value={search} onChange={setSearch}
        placeholder={tab === "klanten" ? "Zoek op naam of telefoon..." : "Zoek op bedrijfsnaam..."} />

      {tab === "klanten" && (
        filteredK.length === 0 ? <EmptyState icon="👤" text="Nog geen klanten toegevoegd" /> :
        filteredK.map(k => (
          <Card key={k.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{k.voornaam} {k.achternaam}</div>
                {k.telefoon && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>📞 {k.telefoon}</div>}
                {k.email && <div style={{ fontSize: 12, color: C.muted }}>✉️ {k.email}</div>}
                {k.vasteBeh && <div style={{ marginTop: 7 }}><Badge color={C.purple}>{k.vasteBeh}</Badge></div>}
                {k.notities && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontStyle: "italic" }}>{k.notities}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEditKlant(k)}
                  style={{ background: "none", border: "none", color: "rgba(200,168,233,0.6)", cursor: "pointer", fontSize: 16 }}>✏️</button>
                <button onClick={() => setConfirmKlantId(k.id)}
                  style={{ background: "none", border: "none", color: "rgba(248,113,113,0.4)", cursor: "pointer", fontSize: 16 }}>🗑</button>
              </div>
            </div>
          </Card>
        ))
      )}

      {tab === "leveranciers" && (
        filteredL.length === 0 ? <EmptyState icon="🚚" text="Nog geen leveranciers toegevoegd" /> :
        filteredL.map(l => (
          <Card key={l.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{l.bedrijf}</div>
                {l.contact && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{l.contact}</div>}
                {l.telefoon && <div style={{ fontSize: 12, color: C.muted }}>📞 {l.telefoon}</div>}
                {l.email && <div style={{ fontSize: 12, color: C.muted }}>✉️ {l.email}</div>}
                {l.categorie && <div style={{ marginTop: 7 }}><Badge color={C.orange}>{l.categorie}</Badge></div>}
                {l.notities && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontStyle: "italic" }}>{l.notities}</div>}
              </div>
              <button onClick={() => setConfirmLevId(l.id)}
                style={{ background: "none", border: "none", color: "rgba(248,113,113,0.4)", cursor: "pointer", fontSize: 18, alignSelf: "flex-start" }}>🗑</button>
            </div>
          </Card>
        ))
      )}

      <ConfirmDialog open={!!confirmKlantId} message="Deze klant wordt permanent verwijderd."
        onCancel={() => setConfirmKlantId(null)}
        onConfirm={() => { onDeleteKlant(confirmKlantId); setConfirmKlantId(null); }} />
      <ConfirmDialog open={!!confirmLevId} message="Deze leverancier wordt permanent verwijderd."
        onCancel={() => setConfirmLevId(null)}
        onConfirm={() => { onDeleteLeverancier(confirmLevId); setConfirmLevId(null); }} />
      <Modal open={modal === "klant"} onClose={() => { setModal(null); setEditKlant(null); }} title={editKlant ? "Klant bewerken" : "Klant toevoegen"}>
        <Input label="Voornaam *" value={kForm.voornaam} onChange={e => setKForm(f => ({ ...f, voornaam: e.target.value }))} />
        <Input label="Achternaam" value={kForm.achternaam} onChange={e => setKForm(f => ({ ...f, achternaam: e.target.value }))} />
        <Input label="Telefoon" type="tel" value={kForm.telefoon} onChange={e => setKForm(f => ({ ...f, telefoon: e.target.value }))} />
        <Input label="E-mail" type="email" value={kForm.email} onChange={e => setKForm(f => ({ ...f, email: e.target.value }))} />
        <Select label="Vaste behandeling" value={kForm.vasteBeh} onChange={e => setKForm(f => ({ ...f, vasteBeh: e.target.value }))}
          options={prijslijst.filter(p => p.naam).map(p => p.naam)} />
        <Textarea label="Notities / allergieën" value={kForm.notities} onChange={e => setKForm(f => ({ ...f, notities: e.target.value }))} />
        <Btn onClick={submitKlant} fullWidth disabled={!kForm.voornaam} style={{ marginTop: 4 }}>Opslaan</Btn>
      </Modal>

      <Modal open={modal === "leverancier"} onClose={() => setModal(null)} title="Leverancier toevoegen">
        <Input label="Bedrijfsnaam *" value={lForm.bedrijf} onChange={e => setLForm(f => ({ ...f, bedrijf: e.target.value }))} />
        <Input label="Contactpersoon" value={lForm.contact} onChange={e => setLForm(f => ({ ...f, contact: e.target.value }))} />
        <Input label="Telefoon" type="tel" value={lForm.telefoon} onChange={e => setLForm(f => ({ ...f, telefoon: e.target.value }))} />
        <Input label="E-mail" type="email" value={lForm.email} onChange={e => setLForm(f => ({ ...f, email: e.target.value }))} />
        <Select label="Categorie" value={lForm.categorie} onChange={e => setLForm(f => ({ ...f, categorie: e.target.value }))} options={CATEGORIES} />
        <Textarea label="Notities" value={lForm.notities} onChange={e => setLForm(f => ({ ...f, notities: e.target.value }))} />
        <Btn onClick={submitLev} fullWidth disabled={!lForm.bedrijf} style={{ marginTop: 4 }}>Opslaan</Btn>
      </Modal>
    </div>
  );
}

// ── Merk invoer met geheugen (datalist suggesties) ───────────────────────────
function MerkInput({ value, onChange, bekendeMerken }) {
  const listId = "merken-lijst";
  return (
    <Field label="Merk *">
      <div style={{ position: "relative" }}>
        <input value={value} onChange={e => onChange(e.target.value)}
          list={listId} placeholder="Bijv. OPI, Essie, CND..."
          style={{ ...inputStyle }}
          onFocus={e => e.target.style.borderColor = C.pink}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"} />
        <datalist id={listId}>
          {bekendeMerken.map(m => <option key={m} value={m} />)}
        </datalist>
      </div>
    </Field>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KLEUREN ARCHIEF
// ════════════════════════════════════════════════════════════════════════════
function KleurenArchief({ data, onAdd, onDelete, onEdit }) {
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [filter, setFilter] = useState({ search: "", merk: "", type: "", beoordeling: "" });
  const [form, setForm] = useState({
    merk: "", kleurnaam: "", kleurnummer: "", type: "",
    aankoopdatum: TODAY, prijs: "", link: "", beoordeling: "", opmerking: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Unieke merken uit bestaande data als suggesties
  const bekendeMerken = [...new Set(data.map(d => d.merk).filter(Boolean))].sort();

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ merk: item.merk || "", kleurnaam: item.kleurnaam || "",
      kleurnummer: item.kleurnummer || "", type: item.type || "",
      aankoopdatum: item.aankoopdatum || TODAY, prijs: item.prijs || "",
      link: item.link || "", beoordeling: item.beoordeling || "", opmerking: item.opmerking || "" });
    setModal(true);
  };

  const submit = () => {
    if (!form.merk || !form.kleurnaam) return;
    if (editItem) {
      onEdit({ ...editItem, ...form, prijs: parseFloat(form.prijs) || 0 });
    } else {
      onAdd({ id: uid(), ...form, prijs: parseFloat(form.prijs) || 0 });
    }
    setModal(false);
    setEditItem(null);
    setForm({ merk: "", kleurnaam: "", kleurnummer: "", type: "", aankoopdatum: TODAY, prijs: "", link: "", beoordeling: "", opmerking: "" });
  };

  const filtered = data
    .filter(k =>
      (!filter.search || k.kleurnaam?.toLowerCase().includes(filter.search.toLowerCase()) || k.merk?.toLowerCase().includes(filter.search.toLowerCase()) || k.kleurnummer?.toLowerCase().includes(filter.search.toLowerCase()))
      && (!filter.merk || k.merk === filter.merk)
      && (!filter.type || k.type === filter.type)
      && (!filter.beoordeling || k.beoordeling === filter.beoordeling)
    )
    .sort((a, b) => (a.merk || "").localeCompare(b.merk || "") || (a.kleurnaam || "").localeCompare(b.kleurnaam || ""));

  const ratingColor = (r) => {
    if (!r) return C.muted;
    if (r.includes("Uitstekend")) return "#22c55e";
    if (r.includes("Goed")) return "#84cc16";
    if (r.includes("Matig")) return "#facc15";
    if (r.includes("Slecht")) return "#fb923c";
    return C.red;
  };

  const merkenInData = [...new Set(data.map(d => d.merk).filter(Boolean))].sort();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Kleuren</div>
        <Btn small onClick={() => { setEditItem(null); setForm({ merk: "", kleurnaam: "", kleurnummer: "", type: "", aankoopdatum: TODAY, prijs: "", link: "", beoordeling: "", opmerking: "" }); setModal(true); }}>+ Toevoegen</Btn>
      </div>

      {/* Filters */}
      <SearchBar value={filter.search} onChange={v => setFilter(f => ({ ...f, search: v }))}
        placeholder="Zoek op naam, nummer of merk..." />

      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {[
          { key: "merk", label: "Merk", options: merkenInData },
          { key: "type", label: "Type", options: KLEUR_TYPES },
          { key: "beoordeling", label: "Beoordeling", options: BEOORDELINGEN },
        ].map(({ key, label, options }) => (
          <select key={key} value={filter[key]} onChange={e => setFilter(f => ({ ...f, [key]: e.target.value }))}
            style={{ background: filter[key] ? "#e879f930" : "rgba(255,255,255,0.07)",
              border: `1px solid ${filter[key] ? C.pink : "rgba(255,255,255,0.12)"}`,
              borderRadius: 10, padding: "7px 12px", color: filter[key] ? C.pink : C.muted,
              fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
              whiteSpace: "nowrap", flexShrink: 0, appearance: "none" }}>
            <option value="">{label}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {(filter.merk || filter.type || filter.beoordeling || filter.search) && (
          <button onClick={() => setFilter({ search: "", merk: "", type: "", beoordeling: "" })}
            style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: 10, padding: "7px 12px", color: C.red, fontSize: 12,
              fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            ✕ Wis
          </button>
        )}
      </div>

      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
        {filtered.length} kleur{filtered.length !== 1 ? "en" : ""}
        {data.length !== filtered.length ? ` van ${data.length}` : ""}
      </div>

      {filtered.length === 0
        ? <EmptyState icon="🎨" text="Nog geen kleuren toegevoegd" />
        : filtered.map(item => (
          <Card key={item.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{item.kleurnaam}</div>
                  {item.kleurnummer && <Badge color={C.purple}>{item.kleurnummer}</Badge>}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                  {item.merk}{item.type ? ` · ${item.type}` : ""}
                  {item.aankoopdatum ? ` · ${fmtDate(item.aankoopdatum)}` : ""}
                  {item.prijs ? ` · ${fmt(item.prijs)}` : ""}
                </div>
                {item.beoordeling && (
                  <div style={{ fontSize: 13, color: ratingColor(item.beoordeling), fontWeight: 700, marginBottom: 6 }}>
                    {item.beoordeling}
                  </div>
                )}
                {item.opmerking && (
                  <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginBottom: 6 }}>
                    {item.opmerking}
                  </div>
                )}
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#60a5fa", textDecoration: "none" }}>
                    🔗 Webshop link
                  </a>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(item)}
                  style={{ background: "none", border: "none", color: "rgba(200,168,233,0.6)", cursor: "pointer", fontSize: 16 }}>✏️</button>
                <button onClick={() => setConfirmId(item.id)}
                  style={{ background: "none", border: "none", color: "rgba(248,113,113,0.4)", cursor: "pointer", fontSize: 16 }}>🗑</button>
              </div>
            </div>
          </Card>
        ))
      }

      <ConfirmDialog open={!!confirmId} message="Deze kleur wordt permanent verwijderd uit het archief."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { onDelete("kleuren", confirmId); setConfirmId(null); }} />
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? "Kleur bewerken" : "Kleur toevoegen"}>
        <MerkInput value={form.merk} onChange={v => set("merk", v)} bekendeMerken={bekendeMerken} />
        <Input label="Kleurnaam *" value={form.kleurnaam} onChange={e => set("kleurnaam", e.target.value)} placeholder="Bijv. Bubble Bath" />
        <Input label="Kleurnummer" value={form.kleurnummer} onChange={e => set("kleurnummer", e.target.value)} placeholder="Bijv. NL 56" />
        <Select label="Type" value={form.type} onChange={e => set("type", e.target.value)} options={KLEUR_TYPES} />
        <Input label="Aankoopdatum" type="date" value={form.aankoopdatum} onChange={e => set("aankoopdatum", e.target.value)} />
        <Input label="Prijs (€)" type="number" step="0.01" min="0" value={form.prijs} onChange={e => set("prijs", e.target.value)} placeholder="0.00" />
        <Input label="Link (webshop)" type="url" value={form.link} onChange={e => set("link", e.target.value)} placeholder="https://..." />
        <Select label="Beoordeling" value={form.beoordeling} onChange={e => set("beoordeling", e.target.value)} options={BEOORDELINGEN} />
        <Textarea label="Opmerking" value={form.opmerking} onChange={e => set("opmerking", e.target.value)} placeholder="Bijv. dekt goed, droogt snel..." />
        <Btn onClick={submit} fullWidth disabled={!form.merk || !form.kleurnaam} style={{ marginTop: 4 }}>
          Opslaan
        </Btn>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PLANNING
// ════════════════════════════════════════════════════════════════════════════
const PLAN_DAGEN = ["Ma","Di","Wo","Do","Vr","Za","Zo"];
const PLAN_MAANDEN = ["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"];
const STATUS_KLEUR = { gepland:"#6366f1", bevestigd:"#22c55e", voltooid:"#a855f7", geannuleerd:"#f87171" };

function dagStr(d) { return d.toISOString().slice(0,10); }
function weekMaandag(d) {
  const r = new Date(d); const dw = r.getDay();
  r.setDate(r.getDate() - (dw === 0 ? 6 : dw - 1)); return r;
}

function Planning({ afspraken, klanten, prijslijst, onAdd, onDelete, onEdit, onVoltooien }) {
  const [weergave, setWeergave] = useState("week");
  const [peildatum, setPeildatum] = useState(new Date(TODAY));
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const LEEG = { datum: TODAY, tijdstip: "10:00", duurMinuten: 60, klantNaam: "", behandeling: "", prijsIndicatie: "", notities: "", status: "gepland" };
  const [form, setForm] = useState(LEEG);
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNieuw = (datum = TODAY) => { setEditItem(null); setForm({ ...LEEG, datum }); setModal(true); };
  const openEdit = (a) => {
    setEditItem(a);
    setForm({ datum: a.datum, tijdstip: a.tijdstip, duurMinuten: a.duurMinuten,
      klantNaam: a.klantNaam || "", behandeling: a.behandeling || "",
      prijsIndicatie: a.prijsIndicatie || "", notities: a.notities || "", status: a.status || "gepland" });
    setModal(true);
  };
  const submit = () => {
    if (!form.datum || !form.tijdstip) return;
    const item = { ...form, duurMinuten: parseInt(form.duurMinuten) || 60, prijsIndicatie: parseFloat(form.prijsIndicatie) || 0 };
    if (editItem) onEdit({ ...editItem, ...item });
    else onAdd({ id: uid(), ...item });
    setModal(false); setEditItem(null); setForm(LEEG);
  };

  const navPeriode = (dir) => {
    const d = new Date(peildatum);
    if (weergave === "maand") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + 7 * dir);
    setPeildatum(d);
  };

  const opDag = (str) => afspraken.filter(a => a.datum === str).sort((a, b) => a.tijdstip.localeCompare(b.tijdstip));

  const periodeLabel = weergave === "maand"
    ? `${PLAN_MAANDEN[peildatum.getMonth()]} ${peildatum.getFullYear()}`
    : (() => {
        const s = weekMaandag(peildatum); const e = new Date(s); e.setDate(e.getDate() + 6);
        return `${s.getDate()} ${PLAN_MAANDEN[s.getMonth()]} – ${e.getDate()} ${PLAN_MAANDEN[e.getMonth()]} ${e.getFullYear()}`;
      })();

  const printAfspraken = weergave === "maand"
    ? afspraken.filter(a => { const d = new Date(a.datum); return d.getMonth() === peildatum.getMonth() && d.getFullYear() === peildatum.getFullYear(); })
        .sort((a, b) => a.datum.localeCompare(b.datum) || a.tijdstip.localeCompare(b.tijdstip))
    : (() => {
        const s = dagStr(weekMaandag(peildatum)); const e = new Date(weekMaandag(peildatum)); e.setDate(e.getDate() + 6);
        return afspraken.filter(a => a.datum >= s && a.datum <= dagStr(e))
          .sort((a, b) => a.datum.localeCompare(b.datum) || a.tijdstip.localeCompare(b.tijdstip));
      })();

  const AfspraakKaart = ({ a }) => (
    <Card style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{a.tijdstip}</span>
            <span style={{ fontSize: 11, color: C.muted }}>{a.duurMinuten} min</span>
            <Badge color={STATUS_KLEUR[a.status] || C.purple}>{a.status}</Badge>
          </div>
          {a.klantNaam && <div style={{ fontSize: 14, fontWeight: 700, color: "#e2d0f8" }}>{a.klantNaam}</div>}
          {a.behandeling && <div style={{ fontSize: 12, color: C.muted }}>{a.behandeling}{a.prijsIndicatie ? ` · ${fmt(a.prijsIndicatie)}` : ""}</div>}
          {a.notities && <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 4 }}>{a.notities}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 8, flexShrink: 0 }}>
          <button onClick={() => openEdit(a)} style={{ background: "none", border: "none", color: "rgba(200,168,233,0.6)", cursor: "pointer", fontSize: 15 }}>✏️</button>
          {(a.status === "gepland" || a.status === "bevestigd") && (
            <button onClick={() => onVoltooien(a)} title="Voltooien + inkomen aanmaken"
              style={{ background: "none", border: "none", color: "rgba(34,197,94,0.8)", cursor: "pointer", fontSize: 15 }}>✅</button>
          )}
          <button onClick={() => setConfirmId(a.id)} style={{ background: "none", border: "none", color: "rgba(248,113,113,0.5)", cursor: "pointer", fontSize: 15 }}>🗑</button>
        </div>
      </div>
    </Card>
  );

  const WeekView = () => {
    const ma = weekMaandag(peildatum);
    const dagen = Array.from({ length: 7 }, (_, i) => { const d = new Date(ma); d.setDate(d.getDate() + i); return d; });
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 12 }}>
          {dagen.map(d => {
            const s = dagStr(d); const isVandaag = s === TODAY; const n = opDag(s).length;
            return (
              <div key={s} onClick={() => openNieuw(s)} style={{ textAlign: "center", padding: "8px 2px", borderRadius: 12, cursor: "pointer",
                background: isVandaag ? `linear-gradient(135deg,${C.pink}33,${C.purple}33)` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isVandaag ? C.pink + "66" : "rgba(255,255,255,0.08)"}` }}>
                <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>{PLAN_DAGEN[d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: isVandaag ? C.pink : "#fff" }}>{d.getDate()}</div>
                {n > 0 && <div style={{ fontSize: 9, color: C.purple, fontWeight: 800 }}>{n}×</div>}
              </div>
            );
          })}
        </div>
        {dagen.map(d => {
          const s = dagStr(d); const lijst = opDag(s); if (!lijst.length) return null;
          return (
            <div key={s} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.label, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                {PLAN_DAGEN[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()} {PLAN_MAANDEN[d.getMonth()]}
              </div>
              {lijst.map(a => <AfspraakKaart key={a.id} a={a} />)}
            </div>
          );
        })}
        {dagen.every(d => !opDag(dagStr(d)).length) && <EmptyState icon="📅" text="Geen afspraken — klik op een dag om toe te voegen" />}
      </div>
    );
  };

  const MaandView = () => {
    const j = peildatum.getFullYear(), m = peildatum.getMonth();
    const eersteWd = new Date(j, m, 1).getDay();
    const offset = eersteWd === 0 ? 6 : eersteWd - 1;
    const aantalDagen = new Date(j, m + 1, 0).getDate();
    const cellen = Array.from({ length: offset + aantalDagen }, (_, i) => i < offset ? null : new Date(j, m, i - offset + 1));
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
          {PLAN_DAGEN.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: C.muted, padding: "4px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {cellen.map((d, i) => {
            if (!d) return <div key={`_${i}`} />;
            const s = dagStr(d); const lijst = opDag(s); const isVandaag = s === TODAY;
            return (
              <div key={s} onClick={() => openNieuw(s)} style={{ minHeight: 54, borderRadius: 8, padding: "5px 4px", cursor: "pointer",
                background: isVandaag ? `linear-gradient(135deg,${C.pink}22,${C.purple}22)` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isVandaag ? C.pink + "50" : "rgba(255,255,255,0.07)"}` }}>
                <div style={{ fontSize: 11, fontWeight: isVandaag ? 900 : 600, color: isVandaag ? C.pink : "#fff", marginBottom: 2 }}>{d.getDate()}</div>
                {lijst.slice(0, 2).map(a => (
                  <div key={a.id} onClick={e => { e.stopPropagation(); openEdit(a); }} style={{
                    fontSize: 8, fontWeight: 700, color: "#fff", background: (STATUS_KLEUR[a.status] || C.purple) + "cc",
                    borderRadius: 3, padding: "1px 3px", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{a.tijdstip} {a.klantNaam || a.behandeling}</div>
                ))}
                {lijst.length > 2 && <div style={{ fontSize: 8, color: C.muted }}>+{lijst.length - 2}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Print-only overzicht */}
      <div id="print-planning" style={{ display: "none" }}>
        <div style={{ fontFamily: "sans-serif", color: "#000", padding: 20 }}>
          <h2 style={{ marginBottom: 4 }}>💅 Gewoon bij Isolde — Planning</h2>
          <p style={{ color: "#666", marginBottom: 16 }}>{periodeLabel}</p>
          {printAfspraken.length === 0 ? <p>Geen afspraken in deze periode.</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#e9d5ff" }}>
                  {["Datum","Tijd","Duur","Klant","Behandeling","Prijs","Status","Notities"].map(h => (
                    <th key={h} style={{ border: "1px solid #bbb", padding: "6px 8px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {printAfspraken.map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? "#fff" : "#faf7ff" }}>
                    <td style={{ border: "1px solid #bbb", padding: "5px 8px" }}>{fmtDate(a.datum)}</td>
                    <td style={{ border: "1px solid #bbb", padding: "5px 8px" }}>{a.tijdstip}</td>
                    <td style={{ border: "1px solid #bbb", padding: "5px 8px" }}>{a.duurMinuten} min</td>
                    <td style={{ border: "1px solid #bbb", padding: "5px 8px" }}>{a.klantNaam || "—"}</td>
                    <td style={{ border: "1px solid #bbb", padding: "5px 8px" }}>{a.behandeling || "—"}</td>
                    <td style={{ border: "1px solid #bbb", padding: "5px 8px" }}>{a.prijsIndicatie ? fmt(a.prijsIndicatie) : "—"}</td>
                    <td style={{ border: "1px solid #bbb", padding: "5px 8px" }}>{a.status}</td>
                    <td style={{ border: "1px solid #bbb", padding: "5px 8px" }}>{a.notities || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Planning</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="secondary" onClick={() => window.print()}>🖨️ Print</Btn>
          <Btn small onClick={() => openNieuw()}>+ Afspraak</Btn>
        </div>
      </div>

      {/* Periode navigatie + weergave toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <button onClick={() => navPeriode(-1)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{periodeLabel}</div>
        <button onClick={() => navPeriode(1)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>›</button>
        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
          {[["week","Week"],["maand","Maand"]].map(([v, l]) => (
            <button key={v} onClick={() => setWeergave(v)} style={{ padding: "8px 11px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit",
              background: weergave === v ? `linear-gradient(135deg,${C.pink},${C.purple})` : "rgba(255,255,255,0.07)",
              color: weergave === v ? "#fff" : C.muted }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Vandaag knop */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <button onClick={() => setPeildatum(new Date(TODAY))} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 14px", color: C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Vandaag</button>
      </div>

      {weergave === "week" ? <WeekView /> : <MaandView />}

      <ConfirmDialog open={!!confirmId} message="Deze afspraak wordt permanent verwijderd."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { onDelete("afspraken", confirmId); setConfirmId(null); }} />

      <Modal open={modal} onClose={() => { setModal(false); setEditItem(null); }} title={editItem ? "Afspraak bewerken" : "Afspraak toevoegen"}>
        <Input label="Datum" type="date" value={form.datum} onChange={e => sf("datum", e.target.value)} />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Input label="Tijd" type="time" value={form.tijdstip} onChange={e => sf("tijdstip", e.target.value)} /></div>
          <div style={{ flex: 1 }}><Select label="Duur" value={form.duurMinuten} onChange={e => sf("duurMinuten", e.target.value)}
            options={[30,45,60,75,90,105,120].map(m => ({ value: m, label: `${m} min` }))} /></div>
        </div>
        <Select label="Klant" value={form.klantNaam} onChange={e => sf("klantNaam", e.target.value)}
          options={klanten.map(k => ({ value: `${k.voornaam} ${k.achternaam}`.trim(), label: `${k.voornaam} ${k.achternaam}`.trim() }))}
          placeholder="— Kies klant —" />
        <Select label="Behandeling" value={form.behandeling} onChange={e => {
          sf("behandeling", e.target.value);
          const p = prijslijst.find(x => x.naam === e.target.value);
          if (p?.prijs) sf("prijsIndicatie", p.prijs);
        }} options={prijslijst.filter(p => p.naam).map(p => ({ value: p.naam, label: p.naam + (p.prijs ? ` — ${fmt(p.prijs)}` : "") }))} />
        <Input label="Prijs indicatie (€)" type="number" step="0.01" value={form.prijsIndicatie} onChange={e => sf("prijsIndicatie", e.target.value)} placeholder="0.00" />
        <Select label="Status" value={form.status} onChange={e => sf("status", e.target.value)}
          options={["gepland","bevestigd","voltooid","geannuleerd"].map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
        <Textarea label="Notities" value={form.notities} onChange={e => sf("notities", e.target.value)} placeholder="Bijv. allergie voor acryl..." />
        <Btn onClick={submit} fullWidth disabled={!form.datum || !form.tijdstip} style={{ marginTop: 4 }}>Opslaan</Btn>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MEER (instellingen + export)
// ════════════════════════════════════════════════════════════════════════════
function Meer({ prijslijst, onUpdatePrijslijst, inkomsten, uitgaven, klanten, leveranciers, kleuren, syncStatus, onRestoreBackup }) {
  const [editPrijzen, setEditPrijzen] = useState(false);
  const [localPrijzen, setLocalPrijzen] = useState(prijslijst);
  const [exporting, setExporting] = useState(false);
  useEffect(() => setLocalPrijzen(prijslijst), [prijslijst]);

  const styleHeader = (ws, cols) => {
    cols.forEach((_, i) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: i });
      if (!ws[addr]) return;
      ws[addr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "4A2C6E" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    });
  };

  const autoWidth = (ws, rows) => {
    if (!rows.length) return;
    ws["!cols"] = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2,
    }));
  };

  const downloadXlsx = (wb, filename) => {
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportAlles = () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const MONTHS = ["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"];

      // Inkomsten
      const incRows = [...inkomsten].sort((a, b) => new Date(a.datum) - new Date(b.datum)).map((x, i) => ({
        "#": i + 1, "Datum": x.datum, "Behandeling": x.behandeling, "Klant": x.klant || "",
        "Betaalwijze": x.betaalwijze || "", "Prijs incl. BTW": x.prijs,
        "BTW-bedrag": x.btw, "Excl. BTW": x.exclBtw,
      }));
      const wsInc = XLSX.utils.json_to_sheet(incRows.length ? incRows : [{}]);
      if (incRows.length) { styleHeader(wsInc, Object.keys(incRows[0])); autoWidth(wsInc, incRows); }
      XLSX.utils.book_append_sheet(wb, wsInc, "Inkomsten");

      // Uitgaven
      const uitRows = [...uitgaven].sort((a, b) => new Date(a.datum) - new Date(b.datum)).map((x, i) => ({
        "#": i + 1, "Datum": x.datum, "Categorie": x.categorie, "Omschrijving": x.omschrijving || "",
        "Leverancier": x.leverancier || "", "Betaalwijze": x.betaalwijze || "",
        "Excl. BTW": x.bedragExcl, "Incl. BTW": x.bedragIncl,
      }));
      const wsUit = XLSX.utils.json_to_sheet(uitRows.length ? uitRows : [{}]);
      if (uitRows.length) { styleHeader(wsUit, Object.keys(uitRows[0])); autoWidth(wsUit, uitRows); }
      XLSX.utils.book_append_sheet(wb, wsUit, "Uitgaven");

      // Maandoverzicht
      const maandRows = MONTHS.map((m, mi) => {
        const inc = inkomsten.filter(x => x.datum && new Date(x.datum).getMonth() === mi).reduce((s, x) => s + (x.prijs || 0), 0);
        const uit = uitgaven.filter(x => x.datum && new Date(x.datum).getMonth() === mi).reduce((s, x) => s + (x.bedragIncl || 0), 0);
        return { "Maand": m, "Inkomsten (€)": +inc.toFixed(2), "Uitgaven (€)": +uit.toFixed(2), "Winst/Verlies (€)": +(inc - uit).toFixed(2) };
      });
      const wsMaand = XLSX.utils.json_to_sheet(maandRows);
      styleHeader(wsMaand, Object.keys(maandRows[0])); autoWidth(wsMaand, maandRows);
      XLSX.utils.book_append_sheet(wb, wsMaand, "Maandoverzicht");

      // BTW overzicht
      const btwRows = MONTHS.map((m, mi) => {
        const ontvangen = inkomsten.filter(x => x.datum && new Date(x.datum).getMonth() === mi).reduce((s, x) => s + (x.btw || 0), 0);
        const betaald = uitgaven.filter(x => x.datum && new Date(x.datum).getMonth() === mi).reduce((s, x) => s + ((x.bedragIncl - x.bedragExcl) || 0), 0);
        return { "Maand": m, "BTW ontvangen": +ontvangen.toFixed(2), "BTW betaald": +betaald.toFixed(2), "Te betalen belastingdienst": +(ontvangen - betaald).toFixed(2) };
      });
      const wsBtw = XLSX.utils.json_to_sheet(btwRows);
      styleHeader(wsBtw, Object.keys(btwRows[0])); autoWidth(wsBtw, btwRows);
      XLSX.utils.book_append_sheet(wb, wsBtw, "BTW overzicht");

      // Klanten
      if (klanten.length) {
        const klRows = klanten.map((x, i) => ({ "#": i + 1, "Voornaam": x.voornaam, "Achternaam": x.achternaam || "", "Telefoon": x.telefoon || "", "Email": x.email || "", "Vaste behandeling": x.vasteBeh || "", "Notities": x.notities || "" }));
        const wsKl = XLSX.utils.json_to_sheet(klRows);
        styleHeader(wsKl, Object.keys(klRows[0])); autoWidth(wsKl, klRows);
        XLSX.utils.book_append_sheet(wb, wsKl, "Klanten");
      }

      // Leveranciers
      if (leveranciers.length) {
        const levRows = leveranciers.map((x, i) => ({ "#": i + 1, "Bedrijf": x.bedrijf, "Contact": x.contact || "", "Telefoon": x.telefoon || "", "Email": x.email || "", "Categorie": x.categorie || "", "Notities": x.notities || "" }));
        const wsLev = XLSX.utils.json_to_sheet(levRows);
        styleHeader(wsLev, Object.keys(levRows[0])); autoWidth(wsLev, levRows);
        XLSX.utils.book_append_sheet(wb, wsLev, "Leveranciers");
      }

      // Kleuren
      if (kleuren.length) {
        const kleurRows = kleuren.map((x, i) => ({ "#": i + 1, "Merk": x.merk, "Kleurnaam": x.kleurnaam, "Nummer": x.kleurnummer || "", "Type": x.type || "", "Aankoopdatum": x.aankoopdatum || "", "Prijs": x.prijs || 0, "Beoordeling": x.beoordeling || "", "Opmerking": x.opmerking || "", "Link": x.link || "" }));
        const wsKleur = XLSX.utils.json_to_sheet(kleurRows);
        styleHeader(wsKleur, Object.keys(kleurRows[0])); autoWidth(wsKleur, kleurRows);
        XLSX.utils.book_append_sheet(wb, wsKleur, "Kleurenarchief");
      }

      downloadXlsx(wb, `Nagelsalon_${new Date().getFullYear()}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 16 }}>Meer</div>

      {/* Sync status */}
      <Card style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 2 }}>Synchronisatie</div>
            <div style={{ fontSize: 12, color: C.muted }}>Data wordt opgeslagen via Supabase</div>
          </div>
          <SyncDot status={syncStatus} />
        </div>
      </Card>

      {/* Prijslijst */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <SectionTitle>Prijslijst behandelingen</SectionTitle>
          <Btn small variant="secondary" onClick={() => {
            if (editPrijzen) onUpdatePrijslijst(localPrijzen);
            setEditPrijzen(!editPrijzen);
          }}>{editPrijzen ? "✓ Opslaan" : "✏️ Bewerken"}</Btn>
        </div>
        {localPrijzen.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, fontSize: 13, color: "#e2d0f8" }}>{item.naam}</div>
            {editPrijzen
              ? <input type="number" step="0.50" value={item.prijs}
                  onChange={e => { const u = [...localPrijzen]; u[i] = { ...item, prijs: parseFloat(e.target.value) || 0 }; setLocalPrijzen(u); }}
                  style={{ width: 80, ...inputStyle, padding: "6px 8px", fontSize: 13 }} />
              : <Badge color={C.green}>{item.prijs ? fmt(item.prijs) : "—"}</Badge>
            }
          </div>
        ))}
      </Card>

      {/* Export */}
      <Card>
        <SectionTitle>Exporteren voor boekhouder</SectionTitle>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.7 }}>
          Eén Excel-bestand met alle tabbladen: inkomsten, uitgaven, maandoverzicht, BTW-overzicht, klanten, leveranciers én kleurenarchief.
        </div>
        <Btn onClick={exportAlles} disabled={exporting} variant="success" fullWidth>
          {exporting ? "⏳ Bezig..." : "📥 Download boekhouding (.xlsx)"}
        </Btn>
        <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 10 }}>
          {inkomsten.length} inkomsten · {uitgaven.length} uitgaven · {kleuren.length} kleuren
        </div>
      </Card>

      {/* Backup terugzetten */}
      <Card>
        <SectionTitle>Backup terugzetten</SectionTitle>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.7 }}>
          Upload een eerder gedownloade backup-Excel om alle data te herstellen. Let op: dit overschrijft de huidige data!
        </div>
        <label style={{ display: "block", background: "rgba(255,255,255,0.07)", border: "1.5px dashed rgba(255,255,255,0.2)",
          borderRadius: 12, padding: "16px", textAlign: "center", cursor: "pointer", marginBottom: 8 }}>
          <input type="file" accept=".xlsx" style={{ display: "none" }}
            onChange={async e => {
              const bestand = e.target.files?.[0];
              if (!bestand) return;
              if (!window.confirm("Weet je zeker dat je de data wilt terugzetten? De huidige data wordt overschreven.")) return;
              try {
                const buf = await bestand.arrayBuffer();
                const wb = XLSX.read(buf);
                const restored = {};
                // Inkomsten
                if (wb.SheetNames.includes("Inkomsten")) {
                  const rijen = XLSX.utils.sheet_to_json(wb.Sheets["Inkomsten"]);
                  restored.inkomsten = rijen.map(r => ({
                    id: uid(), datum: r["Datum"] || "", behandeling: r["Behandeling"] || "",
                    klant: r["Klant"] || "", betaalwijze: r["Betaalwijze"] || "",
                    prijs: parseFloat(r["Prijs incl. BTW (€)"] || r["Prijs incl. BTW"] || 0),
                    btw: parseFloat(r["BTW-bedrag (€)"] || r["BTW-bedrag"] || 0),
                    exclBtw: parseFloat(r["Prijs excl. BTW (€)"] || r["Prijs excl. BTW"] || 0),
                  })).filter(r => r.behandeling);
                }
                // Uitgaven
                if (wb.SheetNames.includes("Uitgaven")) {
                  const rijen = XLSX.utils.sheet_to_json(wb.Sheets["Uitgaven"]);
                  restored.uitgaven = rijen.map(r => ({
                    id: uid(), datum: r["Datum"] || "", categorie: r["Categorie"] || "",
                    omschrijving: r["Omschrijving"] || "", leverancier: r["Leverancier"] || "",
                    betaalwijze: r["Betaalwijze"] || "",
                    bedragExcl: parseFloat(r["Excl. BTW (€)"] || r["Excl. BTW"] || 0),
                    bedragIncl: parseFloat(r["Incl. BTW (€)"] || r["Incl. BTW"] || 0),
                  })).filter(r => r.categorie);
                }
                // Klanten
                if (wb.SheetNames.includes("Klanten")) {
                  const rijen = XLSX.utils.sheet_to_json(wb.Sheets["Klanten"]);
                  restored.klanten = rijen.map(r => ({
                    id: uid(), voornaam: r["Voornaam"] || "", achternaam: r["Achternaam"] || "",
                    telefoon: r["Telefoon"] || "", email: r["Email"] || "",
                    vasteBeh: r["Vaste behandeling"] || "", notities: r["Notities"] || "",
                  })).filter(r => r.voornaam);
                }
                await onRestoreBackup(restored);
              } catch(err) {
                alert("Fout bij terugzetten: " + err.message);
              }
            }}
          />
          <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
          <div style={{ fontSize: 13, color: C.muted }}>Klik om een backup-Excel te kiezen</div>
        </label>
      </Card>

      {/* Bewijsstukken opslag */}
      <Card style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
        <SectionTitle>Bewijsstukken opslag</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>Supabase Storage actief</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
          Foto's en PDF's worden veilig opgeslagen in de cloud — geen NAS of port forwarding nodig.
          Bestanden blijven permanent bewaard (7+ jaar voor belastingdienst ✓).
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Opslag: bucket <span style={{ color: "#e2d0f8", fontFamily: "monospace" }}>bewijsstukken</span> · max 10MB per bestand · 1GB totaal
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("idle");

  const [inkomsten, setInkomsten] = useState([]);
  const [uitgaven, setUitgaven] = useState([]);
  const [klanten, setKlanten] = useState([]);
  const [leveranciers, setLeveranciers] = useState([]);
  const [prijslijst, setPrijslijst] = useState(TREATMENTS);
  const [kleuren, setKleuren] = useState([]);
  const [afspraken, setAfspraken] = useState([]);

  const dbRef = useRef({});
  const isSavingRef = useRef(false);

  // ── Laad data + zet Realtime-abonnement op ────────────────────────────────
  useEffect(() => {
    (async () => {
      const db = await loadAll();
      dbRef.current = db || {};
      if (db.inkomsten) setInkomsten(db.inkomsten);
      if (db.uitgaven) setUitgaven(db.uitgaven);
      if (db.klanten) setKlanten(db.klanten);
      if (db.leveranciers) setLeveranciers(db.leveranciers);
      if (db.prijslijst) setPrijslijst(db.prijslijst);
      if (db.kleuren) setKleuren(db.kleuren);
      if (db.afspraken) setAfspraken(db.afspraken);
      setLoading(false);
    })();

    const unsubscribe = subscribeToChanges((nieuweData) => {
      if (isSavingRef.current) return;
      dbRef.current = nieuweData;
      if (nieuweData.inkomsten) setInkomsten(nieuweData.inkomsten);
      if (nieuweData.uitgaven) setUitgaven(nieuweData.uitgaven);
      if (nieuweData.klanten) setKlanten(nieuweData.klanten);
      if (nieuweData.leveranciers) setLeveranciers(nieuweData.leveranciers);
      if (nieuweData.prijslijst) setPrijslijst(nieuweData.prijslijst);
      if (nieuweData.kleuren) setKleuren(nieuweData.kleuren);
      if (nieuweData.afspraken) setAfspraken(nieuweData.afspraken);
      showToast("🔄 Data bijgewerkt");
    });

    return unsubscribe;
  }, []);

  // ── Persist helper ────────────────────────────────────────────────────────
  const persist = async (updates) => {
    setSyncStatus("saving");
    isSavingRef.current = true;
    const next = { ...dbRef.current, ...updates };
    dbRef.current = next;
    try {
      await saveAll(next);
      setSyncStatus("idle");
    } catch {
      setSyncStatus("error");
    } finally {
      setTimeout(() => { isSavingRef.current = false; }, 2000);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 2500);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const addInkomst = async (item) => {
    const updated = [...inkomsten, item];
    setInkomsten(updated);
    await persist({ inkomsten: updated });
    showToast("✓ Inkomen opgeslagen");
  };

  const addUitgave = async (item) => {
    const updated = [...uitgaven, item];
    setUitgaven(updated);
    await persist({ uitgaven: updated });
    showToast("✓ Uitgave opgeslagen");
  };

  const addKlant = async (item) => {
    const updated = [...klanten, item];
    setKlanten(updated);
    await persist({ klanten: updated });
    showToast("✓ Klant opgeslagen");
  };

  const addLeverancier = async (item) => {
    const updated = [...leveranciers, item];
    setLeveranciers(updated);
    await persist({ leveranciers: updated });
    showToast("✓ Leverancier opgeslagen");
  };

  const addKleur = async (item) => {
    const updated = [...kleuren, item];
    setKleuren(updated);
    await persist({ kleuren: updated });
    showToast("✓ Kleur opgeslagen");
  };

  const editInkomst = async (item) => {
    const updated = inkomsten.map(x => x.id === item.id ? item : x);
    setInkomsten(updated); await persist({ inkomsten: updated }); showToast("✓ Inkomen bijgewerkt");
  };

  const editUitgave = async (item) => {
    const updated = uitgaven.map(x => x.id === item.id ? item : x);
    setUitgaven(updated); await persist({ uitgaven: updated }); showToast("✓ Uitgave bijgewerkt");
  };

  const editKlant = async (item) => {
    const updated = klanten.map(x => x.id === item.id ? item : x);
    setKlanten(updated); await persist({ klanten: updated }); showToast("✓ Klant bijgewerkt");
  };

  const editKleur = async (item) => {
    const updated = kleuren.map(x => x.id === item.id ? item : x);
    setKleuren(updated); await persist({ kleuren: updated }); showToast("✓ Kleur bijgewerkt");
  };

  const deleteItem = async (type, id) => {
    if (type === "inkomsten") {
      const updated = inkomsten.filter(x => x.id !== id);
      setInkomsten(updated); await persist({ inkomsten: updated });
    } else if (type === "uitgaven") {
      const updated = uitgaven.filter(x => x.id !== id);
      setUitgaven(updated); await persist({ uitgaven: updated });
    } else if (type === "kleuren") {
      const updated = kleuren.filter(x => x.id !== id);
      setKleuren(updated); await persist({ kleuren: updated });
    }
    showToast("Verwijderd");
  };

  const deleteKlant = async (id) => {
    const updated = klanten.filter(x => x.id !== id);
    setKlanten(updated); await persist({ klanten: updated }); showToast("Klant verwijderd");
  };

  const deleteLeverancier = async (id) => {
    const updated = leveranciers.filter(x => x.id !== id);
    setLeveranciers(updated); await persist({ leveranciers: updated }); showToast("Leverancier verwijderd");
  };

  const updatePrijslijst = async (lijst) => {
    setPrijslijst(lijst); await persist({ prijslijst: lijst }); showToast("✓ Prijslijst opgeslagen");
  };

  const addAfspraak = async (item) => {
    const updated = [...afspraken, item];
    setAfspraken(updated); await persist({ afspraken: updated }); showToast("✓ Afspraak ingepland");
  };
  const editAfspraak = async (item) => {
    const updated = afspraken.map(a => a.id === item.id ? item : a);
    setAfspraken(updated); await persist({ afspraken: updated }); showToast("✓ Afspraak bijgewerkt");
  };
  const deleteAfspraak = async (_, id) => {
    const updated = afspraken.filter(a => a.id !== id);
    setAfspraken(updated); await persist({ afspraken: updated }); showToast("Afspraak verwijderd");
  };
  const voltooiAfspraak = async (afspraak) => {
    // Markeer als voltooid
    const bijgewerkt = { ...afspraak, status: "voltooid" };
    const updAfspraken = afspraken.map(a => a.id === afspraak.id ? bijgewerkt : a);
    setAfspraken(updAfspraken);
    // Maak direct een inkomen aan
    const prijs = parseFloat(afspraak.prijsIndicatie) || 0;
    const inkomen = { id: uid(), datum: afspraak.datum, behandeling: afspraak.behandeling || "Afspraak",
      klant: afspraak.klantNaam || "", betaalwijze: "", bonPad: "",
      prijs, btw: +(prijs / 1.21 * 0.21).toFixed(2), exclBtw: +(prijs / 1.21).toFixed(2) };
    const updInkomsten = [...inkomsten, inkomen];
    setInkomsten(updInkomsten);
    await persist({ afspraken: updAfspraken, inkomsten: updInkomsten });
    showToast("✅ Afspraak voltooid + inkomen aangemaakt");
  };

  const restoreBackup = async (restored) => {
    if (restored.inkomsten) setInkomsten(restored.inkomsten);
    if (restored.uitgaven) setUitgaven(restored.uitgaven);
    if (restored.klanten) setKlanten(restored.klanten);
    await persist(restored);
    showToast("✓ Backup teruggezet!");
  };

  const TABS = [
    { id: "home",      icon: "🏠", label: "Home" },
    { id: "inkomsten", icon: "💰", label: "Inkomsten" },
    { id: "uitgaven",  icon: "🧾", label: "Uitgaven" },
    { id: "planning",  icon: "📅", label: "Planning" },
    { id: "relaties",  icon: "👥", label: "Relaties" },
    { id: "kleuren",   icon: "🎨", label: "Kleuren" },
    { id: "meer",      icon: "⚙️", label: "Meer" },
  ];

  // ── Responsive: JS-driven (no CSS classes, guaranteed to work) ──────────────
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const isDesktop = windowWidth >= 768;
  const SIDEBAR_W = windowWidth >= 1200 ? 240 : 220;
  const CONTENT_PAD = windowWidth >= 1600 ? 80 : windowWidth >= 1200 ? 64 : 48;

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg,#0d0020,#1e0a3c,#2d1547)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>💅</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Gewoon bij Isolde</div>
      <div style={{ color: C.muted, fontSize: 14 }}>Laden...</div>
    </div>
  );

  const pageProps = {
    home:      <Dashboard inkomsten={inkomsten} uitgaven={uitgaven} kleuren={kleuren} />,
    inkomsten: <Inkomsten data={inkomsten} prijslijst={prijslijst} klanten={klanten} onAdd={addInkomst} onDelete={deleteItem} onEdit={editInkomst} />,
    uitgaven:  <Uitgaven data={uitgaven} leveranciers={leveranciers} onAdd={addUitgave} onDelete={deleteItem} onEdit={editUitgave} />,
    relaties:  <Relaties klanten={klanten} leveranciers={leveranciers} prijslijst={prijslijst}
                  onAddKlant={addKlant} onDeleteKlant={deleteKlant} onEditKlant={editKlant}
                  onAddLeverancier={addLeverancier} onDeleteLeverancier={deleteLeverancier} />,
    planning:  <Planning afspraken={afspraken} klanten={klanten} prijslijst={prijslijst}
                  onAdd={addAfspraak} onDelete={deleteAfspraak} onEdit={editAfspraak} onVoltooien={voltooiAfspraak} />,
    kleuren:   <KleurenArchief data={kleuren} onAdd={addKleur} onDelete={deleteItem} onEdit={editKleur} />,
    meer:      <Meer prijslijst={prijslijst} onUpdatePrijslijst={updatePrijslijst}
                  inkomsten={inkomsten} uitgaven={uitgaven} klanten={klanten}
                  leveranciers={leveranciers} kleuren={kleuren} syncStatus={syncStatus}
                  onRestoreBackup={restoreBackup} />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0d0020,#1e0a3c,#2d1547)", fontFamily: "'Nunito', sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        @media print {
          body * { visibility: hidden !important; }
          #print-planning, #print-planning * { visibility: visible !important; }
          #print-planning { position: fixed; inset: 0; padding: 20px; background: #fff; }
        }
      `}</style>

      {isDesktop ? (
        /* ── DESKTOP / TABLET ── */
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {/* Zijbalk */}
          <div style={{
            width: SIDEBAR_W, flexShrink: 0, minHeight: "100vh",
            background: "rgba(8,0,22,0.98)", borderRight: "1px solid rgba(255,255,255,0.07)",
            position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 40,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "28px 24px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💅</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>Gewoon bij Isolde</div>
              <div style={{ fontSize: 11, color: "#c084fc", marginTop: 3 }}>Boekhouding</div>
            </div>
            <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 14px", borderRadius: 12, marginBottom: 4,
                  background: tab === t.id ? "linear-gradient(135deg,rgba(232,121,249,0.15),rgba(168,85,247,0.15))" : "transparent",
                  border: tab === t.id ? "1px solid rgba(232,121,249,0.2)" : "1px solid transparent",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 20, lineHeight: 1, filter: tab === t.id ? "none" : "grayscale(1) opacity(0.4)" }}>{t.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: tab === t.id ? 800 : 600,
                    color: tab === t.id ? "#fff" : "rgba(255,255,255,0.45)" }}>{t.label}</span>
                  {tab === t.id && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: C.pink }} />}
                </button>
              ))}
            </nav>
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <SyncDot status={syncStatus} />
            </div>
          </div>

          {/* Hoofdinhoud */}
          <div style={{ marginLeft: SIDEBAR_W, flex: 1, padding: `40px ${CONTENT_PAD}px`, minHeight: "100vh", overflowX: "hidden" }}>
            <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>
                {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}
              </div>
            </div>
            {pageProps[tab]}
          </div>
        </div>

      ) : (
        /* ── MOBIEL ── */
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <div style={{
            position: "sticky", top: 0, zIndex: 50,
            background: "rgba(13,0,32,0.92)", backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 20 }}>💅</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Gewoon bij Isolde</div>
                <div style={{ fontSize: 10, color: "#c084fc" }}>Boekhouding</div>
              </div>
            </div>
            <SyncDot status={syncStatus} />
          </div>
          <div style={{ padding: "20px 16px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))", flex: 1 }}>
            {pageProps[tab]}
          </div>
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
            background: "rgba(13,0,32,0.96)", backdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "10px 0 8px", fontFamily: "inherit",
              }}>
                <div style={{ fontSize: 18, lineHeight: 1, filter: tab === t.id ? "none" : "grayscale(1) opacity(0.35)" }}>{t.icon}</div>
                <div style={{ fontSize: 9, fontWeight: tab === t.id ? 800 : 500, color: tab === t.id ? C.pink : "rgba(255,255,255,0.3)" }}>{t.label}</div>
                {tab === t.id && <div style={{ width: 3, height: 3, borderRadius: "50%", background: C.pink, marginTop: 1 }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}
