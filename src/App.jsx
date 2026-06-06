import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { loadAll, saveAll, subscribeToChanges } from "./storage.js";
import { uploadNaarNAS, getBewijsstukUrl, getNucConfig, setNucConfig } from "./webdav.js";

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
const MAAND_KORT = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];

function Dashboard({ inkomsten, uitgaven, kleuren, afspraken, onNavigate }) {
  const now = new Date();
  const jaar = now.getFullYear();
  const mnd = now.getMonth();

  const incVoorMaand = (m, j) => inkomsten
    .filter(x => { const d = new Date(x.datum); return d.getMonth() === m && d.getFullYear() === j; })
    .reduce((s, x) => s + (parseFloat(x.prijs) || 0), 0);
  const uitVoorMaand = (m, j) => uitgaven
    .filter(x => { const d = new Date(x.datum); return d.getMonth() === m && d.getFullYear() === j; })
    .reduce((s, x) => s + (parseFloat(x.bedragIncl) || 0), 0);

  const dezeInc = incVoorMaand(mnd, jaar);
  const dezeUit = uitVoorMaand(mnd, jaar);
  const vorigeInc = incVoorMaand(mnd === 0 ? 11 : mnd - 1, mnd === 0 ? jaar - 1 : jaar);
  const winst = dezeInc - dezeUit;
  const allInc = inkomsten.filter(x => new Date(x.datum).getFullYear() === jaar).reduce((s, x) => s + (parseFloat(x.prijs) || 0), 0);
  const allExp = uitgaven.filter(x => new Date(x.datum).getFullYear() === jaar).reduce((s, x) => s + (parseFloat(x.bedragIncl) || 0), 0);

  // Maandvergelijking
  const groei = vorigeInc > 0 ? ((dezeInc - vorigeInc) / vorigeInc * 100) : null;

  // Laatste 6 maanden voor grafiek
  const grafiekData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(jaar, mnd - 5 + i, 1);
    const inc = incVoorMaand(d.getMonth(), d.getFullYear());
    return { label: MAAND_KORT[d.getMonth()], inc };
  });
  const maxInc = Math.max(...grafiekData.map(d => d.inc), 1);

  // Slimme stats
  const dezeBehandelingen = inkomsten.filter(x => { const d = new Date(x.datum); return d.getMonth() === mnd && d.getFullYear() === jaar; });
  const gemiddeld = dezeBehandelingen.length > 0 ? dezeInc / dezeBehandelingen.length : 0;
  const zestigDagenGeleden = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
  const actieveKlanten = new Set(inkomsten.filter(x => x.datum >= zestigDagenGeleden && x.klant).map(x => x.klant)).size;
  const besteMaxInc = Math.max(...Array.from({length:12},(_,i) => incVoorMaand(i, jaar)));
  const besteMaand = Array.from({length:12},(_,i) => ({ naam: MAAND_KORT[i], inc: incVoorMaand(i,jaar) })).find(m => m.inc === besteMaxInc);

  // Vandaag afspraken
  const vandaagAfspraken = (afspraken || []).filter(a => a.datum === TODAY && a.status !== "geannuleerd")
    .sort((a,b) => a.tijdstip.localeCompare(b.tijdstip));

  const behandelingCount = {};
  inkomsten.forEach(x => { if (x.behandeling) behandelingCount[x.behandeling] = (behandelingCount[x.behandeling] || 0) + 1; });
  const topBeh = Object.entries(behandelingCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maandNaam = now.toLocaleDateString("nl-NL", { month: "long" });
  const nognietBeoordeeld = kleuren.filter(k => !k.beoordeling).length;

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 2 }}>Hoi Isolde! 💅</div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 18 }}>
        {now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
      </div>

      {/* Vandaag afspraken */}
      {vandaagAfspraken.length > 0 && (
        <Card style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", marginBottom: 12 }}
          onClick={() => onNavigate?.("planning")}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            📅 Vandaag — {vandaagAfspraken.length} afspraak{vandaagAfspraken.length !== 1 ? "en" : ""}
          </div>
          {vandaagAfspraken.slice(0, 3).map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: "#e2d0f8" }}>{a.tijdstip} · {a.klantNaam || a.behandeling}</span>
              {a.behandeling && a.klantNaam && <span style={{ fontSize: 11, color: C.muted }}>{a.behandeling}</span>}
            </div>
          ))}
        </Card>
      )}

      {/* Maand stats + vergelijking */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={{ background: `${C.green}18`, border: `1px solid ${C.green}30`, borderRadius: 18, padding: "16px 14px" }}>
          <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>↑ Inkomsten</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{fmt(dezeInc)}</div>
          {groei !== null && (
            <div style={{ fontSize: 10, color: groei >= 0 ? C.green : C.red, marginTop: 4, fontWeight: 700 }}>
              {groei >= 0 ? "▲" : "▼"} {Math.abs(groei).toFixed(0)}% vs vorige maand
            </div>
          )}
        </div>
        <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}30`, borderRadius: 18, padding: "16px 14px" }}>
          <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>↓ Uitgaven</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{fmt(dezeUit)}</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{maandNaam}</div>
        </div>
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

      {/* 6-maanden grafiek */}
      <Card>
        <SectionTitle>Inkomsten — laatste 6 maanden</SectionTitle>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
          {grafiekData.map(({ label, inc }, i) => {
            const hoogte = maxInc > 0 ? Math.max(4, Math.round(inc / maxInc * 72)) : 4;
            const isHuidig = i === 5;
            return (
              <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: isHuidig ? C.green : C.muted, fontWeight: isHuidig ? 800 : 400 }}>
                  {inc > 0 ? (inc >= 1000 ? `${(inc/1000).toFixed(1)}k` : fmt(inc).replace("€","").trim()) : ""}
                </div>
                <div style={{ width: "100%", height: hoogte, borderRadius: "4px 4px 0 0",
                  background: isHuidig ? `linear-gradient(180deg,${C.green},#16a34a)` : "rgba(168,85,247,0.4)",
                  minHeight: 4 }} />
                <div style={{ fontSize: 9, color: isHuidig ? "#fff" : C.muted, fontWeight: isHuidig ? 800 : 400 }}>{label}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Slimme stats */}
      <Card>
        <SectionTitle>Inzichten {jaar}</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Jaaromzet", value: fmt(allInc), color: C.green },
            { label: "Jaarwinst", value: fmt(allInc - allExp), color: C.purple },
            { label: "Gem. per behandeling", value: gemiddeld > 0 ? fmt(gemiddeld) : "—", color: "#e2d0f8" },
            { label: "Actieve klanten", value: `${actieveKlanten} klant${actieveKlanten !== 1 ? "en" : ""}`, color: "#60a5fa", sub: "laatste 60 dagen" },
            ...(besteMaand && besteMaand.inc > 0 ? [{ label: "Beste maand", value: besteMaand.naam, color: C.orange, sub: fmt(besteMaand.inc) }] : []),
            { label: "Behandelingen", value: `${dezeBehandelingen.length}×`, color: C.pink, sub: `deze ${maandNaam}` },
          ].map(({ label, value, color, sub }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
              {sub && <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>}
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
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#e2d0f8" }}>{naam}</div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${Math.round(count / (topBeh[0]?.[1]||1) * 100)}%`,
                    background: ["#e879f9","#a855f7","#c4b5fd"][i], borderRadius: 2 }} />
                </div>
              </div>
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
function BonUpload({ onUploaded, datum, bedrag, type, uploading, setUploading, naam, omschrijving }) {
  const fileRef = useRef(null);

  const handleBestand = async (bestand) => {
    if (!bestand) return;
    setUploading(true);
    try {
      const pad = await uploadNaarNAS(bestand, type, datum, bedrag, naam, omschrijving);
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

function Inkomsten({ data, prijslijst, klanten, onAdd, onDelete, onEdit, onMaakFactuur, onAddKlant }) {
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [nieuweKlant, setNieuweKlant] = useState(null);
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
    // Check of ingevulde naam een nieuwe klant is
    if (form.klant && !klanten.some(k =>
      `${k.voornaam} ${k.achternaam}`.trim().toLowerCase() === form.klant.trim().toLowerCase()
    )) {
      setNieuweKlant(form.klant.trim());
    }
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

      {/* Nieuwe klant melding */}
      {nieuweKlant && (
        <Card style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.orange, marginBottom: 10 }}>
            👤 <strong>{nieuweKlant}</strong> staat nog niet in je relaties.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small onClick={() => {
              const delen = nieuweKlant.split(" ");
              onAddKlant({ id: uid(), voornaam: delen[0] || nieuweKlant, achternaam: delen.slice(1).join(" "), telefoon: "", email: "", vasteBeh: "", notities: "" });
              setNieuweKlant(null);
            }}>Toevoegen aan relaties</Btn>
            <Btn small variant="ghost" onClick={() => setNieuweKlant(null)}>Overslaan</Btn>
          </div>
        </Card>
      )}

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
                  <button onClick={() => onMaakFactuur(item)} title="Factuur maken"
                    style={{ background: "none", border: "none", color: "rgba(99,168,233,0.7)", cursor: "pointer", fontSize: 15 }}>🧾</button>
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
        <Field label="Klant (optioneel)">
          <input
            list="klant-suggesties"
            value={form.klant}
            onChange={e => set("klant", e.target.value)}
            placeholder="Typ of kies een klant..."
            style={{ ...inputStyle }}
            onFocus={e => e.target.style.borderColor = C.pink}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"}
          />
          <datalist id="klant-suggesties">
            {klanten.map(k => {
              const naam = `${k.voornaam} ${k.achternaam}`.trim();
              return <option key={k.id} value={naam} />;
            })}
          </datalist>
        </Field>
        <Select label="Betaalwijze" value={form.betaalwijze} onChange={e => set("betaalwijze", e.target.value)}
          options={BETAALWIJZE} />
        <BonUpload type="inkomen" datum={form.datum} bedrag={form.prijs}
          naam={form.klant} omschrijving={form.behandeling}
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
        <Field label="Leverancier (optioneel)">
          <input
            list="lev-suggesties"
            value={form.leverancier}
            onChange={e => set("leverancier", e.target.value)}
            placeholder="Typ of kies een leverancier..."
            style={{ ...inputStyle }}
            onFocus={e => e.target.style.borderColor = C.pink}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"}
          />
          <datalist id="lev-suggesties">
            {leveranciers.map(l => <option key={l.id} value={l.bedrijf} />)}
          </datalist>
        </Field>
        <Select label="Betaalwijze" value={form.betaalwijze} onChange={e => set("betaalwijze", e.target.value)} options={BETAALWIJZE} />
        <BonUpload type="uitgave" datum={form.datum} bedrag={form.bedrag}
          naam={form.leverancier} omschrijving={form.omschrijving}
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
function Relaties({ klanten, leveranciers, prijslijst, onAddKlant, onDeleteKlant, onEditKlant, onAddLeverancier, onDeleteLeverancier, onEditLeverancier, inkomsten, afspraken, facturen, onStempel }) {
  const [tab, setTab] = useState("klanten");
  const [modal, setModal] = useState(null);
  const [editKlant, setEditKlant] = useState(null);
  const [geschiedenisKlant, setGeschiedenisKlant] = useState(null);
  const [editLev, setEditLev] = useState(null);
  const [confirmKlantId, setConfirmKlantId] = useState(null);
  const [confirmLevId, setConfirmLevId] = useState(null);
  const [search, setSearch] = useState("");
  const LEEG_K = { voornaam: "", achternaam: "", telefoon: "", email: "", vasteBeh: "", notities: "", stempels: 0, stempelDoel: 10, stempelBeloning: "" };
  const LEEG_L = { bedrijf: "", contact: "", telefoon: "", email: "", categorie: "", notities: "" };
  const [kForm, setKForm] = useState(LEEG_K);
  const [lForm, setLForm] = useState(LEEG_L);

  const openEditLev = (l) => {
    setEditLev(l);
    setLForm({ bedrijf: l.bedrijf, contact: l.contact || "", telefoon: l.telefoon || "",
      email: l.email || "", categorie: l.categorie || "", notities: l.notities || "" });
    setModal("leverancier");
  };

  const openEditKlant = (k) => {
    setEditKlant(k);
    setKForm({ voornaam: k.voornaam, achternaam: k.achternaam || "", telefoon: k.telefoon || "",
      email: k.email || "", vasteBeh: k.vasteBeh || "", notities: k.notities || "",
      stempels: k.stempels || 0, stempelDoel: k.stempelDoel || 10, stempelBeloning: k.stempelBeloning || "" });
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
    if (editLev) { onEditLeverancier({ ...editLev, ...lForm }); }
    else { onAddLeverancier({ id: uid(), ...lForm }); }
    setModal(null); setEditLev(null); setLForm(LEEG_L);
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
          <Card key={k.id} onClick={() => setGeschiedenisKlant(k)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{k.voornaam} {k.achternaam}</div>
                {k.telefoon && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>📞 {k.telefoon}</div>}
                {k.email && <div style={{ fontSize: 12, color: C.muted }}>✉️ {k.email}</div>}
                {k.vasteBeh && <div style={{ marginTop: 7 }}><Badge color={C.purple}>{k.vasteBeh}</Badge></div>}
                {k.notities && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontStyle: "italic" }}>{k.notities}</div>}

                {/* Stempelkaart */}
                {k.stempelDoel > 0 && (() => {
                  const stempels = k.stempels || 0;
                  const doel = k.stempelDoel || 10;
                  const vol = stempels >= doel;
                  const rijen = Math.ceil(doel / 5);
                  return (
                    <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                      {vol && (
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.orange, marginBottom: 6 }}>
                          🎉 Beloning behaald! {k.stempelBeloning ? `→ ${k.stempelBeloning}` : ""}
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                        {Array.from({ length: doel }, (_, i) => (
                          <span key={i} style={{ fontSize: 16, opacity: i < stempels ? 1 : 0.2 }}>💅</span>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>{stempels}/{doel}</span>
                        {!vol && (
                          <button onClick={() => onStempel(k, 1)} style={{
                            background: `linear-gradient(135deg,${C.pink},${C.purple})`, border: "none",
                            borderRadius: 8, padding: "3px 10px", color: "#fff", fontSize: 11,
                            fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Stempel</button>
                        )}
                        {vol && (
                          <button onClick={() => onStempel(k, -stempels)} style={{
                            background: "rgba(251,146,60,0.2)", border: "1px solid rgba(251,146,60,0.4)",
                            borderRadius: 8, padding: "3px 10px", color: C.orange, fontSize: 11,
                            fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Verzilverd</button>
                        )}
                        {stempels > 0 && !vol && (
                          <button onClick={() => onStempel(k, -1)} style={{
                            background: "none", border: "none", color: C.muted, fontSize: 11,
                            cursor: "pointer", fontFamily: "inherit" }}>−</button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                <button onClick={e => { e.stopPropagation(); openEditKlant(k); }}
                  style={{ background: "none", border: "none", color: "rgba(200,168,233,0.6)", cursor: "pointer", fontSize: 16 }}>✏️</button>
                <button onClick={e => { e.stopPropagation(); setConfirmKlantId(k.id); }}
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
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEditLev(l)}
                  style={{ background: "none", border: "none", color: "rgba(200,168,233,0.6)", cursor: "pointer", fontSize: 16 }}>✏️</button>
                <button onClick={() => setConfirmLevId(l.id)}
                  style={{ background: "none", border: "none", color: "rgba(248,113,113,0.4)", cursor: "pointer", fontSize: 16 }}>🗑</button>
              </div>
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
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, marginTop: 4 }}>
          <SectionTitle>Stempelkaart</SectionTitle>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Input label="Aantal stempels voor beloning" type="number" min="0" max="50"
              value={kForm.stempelDoel} onChange={e => setKForm(f => ({ ...f, stempelDoel: parseInt(e.target.value) || 0 }))} /></div>
          </div>
          <Input label="Beloning omschrijving" value={kForm.stempelBeloning}
            onChange={e => setKForm(f => ({ ...f, stempelBeloning: e.target.value }))}
            placeholder="Bijv. Gratis gellak behandeling" />
        </div>
        <Btn onClick={submitKlant} fullWidth disabled={!kForm.voornaam} style={{ marginTop: 4 }}>Opslaan</Btn>
      </Modal>

      <Modal open={modal === "leverancier"} onClose={() => { setModal(null); setEditLev(null); }} title={editLev ? "Leverancier bewerken" : "Leverancier toevoegen"}>
        <Input label="Bedrijfsnaam *" value={lForm.bedrijf} onChange={e => setLForm(f => ({ ...f, bedrijf: e.target.value }))} />
        <Input label="Contactpersoon" value={lForm.contact} onChange={e => setLForm(f => ({ ...f, contact: e.target.value }))} />
        <Input label="Telefoon" type="tel" value={lForm.telefoon} onChange={e => setLForm(f => ({ ...f, telefoon: e.target.value }))} />
        <Input label="E-mail" type="email" value={lForm.email} onChange={e => setLForm(f => ({ ...f, email: e.target.value }))} />
        <Select label="Categorie" value={lForm.categorie} onChange={e => setLForm(f => ({ ...f, categorie: e.target.value }))} options={CATEGORIES} />
        <Textarea label="Notities" value={lForm.notities} onChange={e => setLForm(f => ({ ...f, notities: e.target.value }))} />
        <Btn onClick={submitLev} fullWidth disabled={!lForm.bedrijf} style={{ marginTop: 4 }}>Opslaan</Btn>
      </Modal>

      {/* Klantgeschiedenis modal */}
      {geschiedenisKlant && (() => {
        const k = geschiedenisKlant;
        const naam = `${k.voornaam} ${k.achternaam}`.trim();
        const kInk = (inkomsten || []).filter(x => x.klant === naam).sort((a,b) => b.datum.localeCompare(a.datum));
        const kAfs = (afspraken || []).filter(x => x.klantNaam === naam).sort((a,b) => b.datum.localeCompare(a.datum));
        const kFac = (facturen || []).filter(x => x.klant === naam).sort((a,b) => b.datum.localeCompare(a.datum));
        const totaal = kInk.reduce((s,x) => s + (x.prijs||0), 0);
        const laatste = kInk[0]?.datum || kAfs[0]?.datum;
        return (
          <Modal open={true} onClose={() => setGeschiedenisKlant(null)} title={`👤 ${naam}`}>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                ["Bezoeken", kInk.length, C.green],
                ["Totaal", fmt(totaal), C.purple],
                ["Afspraken", kAfs.length, "#6366f1"],
              ].map(([l,v,c]) => (
                <div key={l} style={{ background: `${c}18`, border: `1px solid ${c}30`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: c, fontWeight: 700 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            {laatste && <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Laatste bezoek: {fmtDate(laatste)}</div>}

            {/* Inkomsten */}
            {kInk.length > 0 && (
              <>
                <SectionTitle>Behandelingen</SectionTitle>
                {kInk.slice(0,5).map(x => (
                  <div key={x.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#e2d0f8" }}>{x.behandeling}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(x.datum)}{x.betaalwijze ? ` · ${x.betaalwijze}` : ""}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt(x.prijs)}</div>
                  </div>
                ))}
                {kInk.length > 5 && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>+{kInk.length - 5} meer</div>}
              </>
            )}

            {/* Komende afspraken */}
            {kAfs.filter(a => a.datum >= TODAY && a.status !== "geannuleerd").length > 0 && (
              <>
                <SectionTitle style={{ marginTop: 14 }}>Komende afspraken</SectionTitle>
                {kAfs.filter(a => a.datum >= TODAY && a.status !== "geannuleerd").slice(0,3).map(a => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 13, color: "#e2d0f8" }}>{fmtDate(a.datum)} {a.tijdstip}</div>
                    <Badge color={STATUS_KLEUR[a.status] || C.purple}>{a.status}</Badge>
                  </div>
                ))}
              </>
            )}

            {kInk.length === 0 && kAfs.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px", color: C.muted, fontSize: 13 }}>Nog geen geschiedenis</div>
            )}
          </Modal>
        );
      })()}
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

function dagStr(d) {
  // Gebruik lokale datum-onderdelen (NIET toISOString — die converteert naar UTC
  // waardoor in tijdzone UTC+1/+2 een lokale middernacht als gisteren wordt teruggegeven)
  const j = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${j}-${m}-${dag}`;
}
function weekMaandag(d) {
  const r = new Date(d); const dw = r.getDay();
  r.setDate(r.getDate() - (dw === 0 ? 6 : dw - 1)); return r;
}

function Planning({ afspraken, klanten, prijslijst, onAdd, onDelete, onEdit, onVoltooien, onAddKlant, inkomsten, facturen }) {
  const [weergave, setWeergave] = useState("week");
  const [peildatum, setPeildatum] = useState(new Date(TODAY));
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [nieuweKlant, setNieuweKlant] = useState(null); // naam van onbekende klant na opslaan
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
    // Check of klant nieuw is
    if (form.klantNaam && !klanten.some(k => `${k.voornaam} ${k.achternaam}`.trim().toLowerCase() === form.klantNaam.trim().toLowerCase())) {
      setNieuweKlant(form.klantNaam.trim());
    }
    setModal(false); setEditItem(null); setForm(LEEG);
  };

  const voegNieuweKlantToe = () => {
    if (!nieuweKlant) return;
    const delen = nieuweKlant.split(" ");
    onAddKlant({ id: uid(), voornaam: delen[0] || nieuweKlant, achternaam: delen.slice(1).join(" "), telefoon: "", email: "", vasteBeh: "", notities: "" });
    setNieuweKlant(null);
  };

  const navPeriode = (dir) => {
    const d = new Date(peildatum);
    if (weergave === "maand") d.setMonth(d.getMonth() + dir);
    else if (weergave === "dag") d.setDate(d.getDate() + dir);
    else d.setDate(d.getDate() + 7 * dir);
    setPeildatum(d);
  };

  const openDag = (datum) => { setPeildatum(new Date(datum)); setWeergave("dag"); };

  const opDag = (str) => afspraken.filter(a => a.datum === str).sort((a, b) => a.tijdstip.localeCompare(b.tijdstip));

  const periodeLabel = weergave === "maand"
    ? `${PLAN_MAANDEN[peildatum.getMonth()]} ${peildatum.getFullYear()}`
    : weergave === "dag"
    ? `${PLAN_DAGEN[peildatum.getDay() === 0 ? 6 : peildatum.getDay() - 1]} ${peildatum.getDate()} ${PLAN_MAANDEN[peildatum.getMonth()]} ${peildatum.getFullYear()}`
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
          {(a.status === "gepland" || a.status === "bevestigd") && (() => {
            const klant = klanten.find(k => `${k.voornaam} ${k.achternaam}`.trim() === a.klantNaam);
            const telRaw = klant?.telefoon?.replace(/\D/g, "") || "";
            if (!telRaw) return null;
            // Zet Nederlandse notatie om: 06... → 316...
            const tel = telRaw.startsWith("0") ? "31" + telRaw.slice(1) : telRaw;
            const tekst = encodeURIComponent(`Hoi ${klant.voornaam}! 💅 Herinnering: je afspraak is op ${fmtDate(a.datum)} om ${a.tijdstip}${a.behandeling ? ` voor ${a.behandeling}` : ""}. Tot dan!`);
            return (
              <button onClick={() => window.open(`https://wa.me/${tel}?text=${tekst}`, "_blank")}
                title="WhatsApp herinnering sturen"
                style={{ background: "none", border: "none", color: "rgba(37,211,102,0.8)", cursor: "pointer", fontSize: 15 }}>💬</button>
            );
          })()}
          {(a.status === "gepland" || a.status === "bevestigd") && (
            <button onClick={() => onVoltooien(a)} title="Voltooien + inkomen aanmaken"
              style={{ background: "none", border: "none", color: "rgba(34,197,94,0.8)", cursor: "pointer", fontSize: 15 }}>✅</button>
          )}
          <button onClick={() => setConfirmId(a.id)} style={{ background: "none", border: "none", color: "rgba(248,113,113,0.5)", cursor: "pointer", fontSize: 15 }}>🗑</button>
        </div>
      </div>
    </Card>
  );

  const DagView = () => {
    const s = dagStr(peildatum);
    const lijst = opDag(s);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: C.muted }}>{lijst.length} afspraak{lijst.length !== 1 ? "en" : ""}</div>
          <Btn small onClick={() => openNieuw(s)}>+ Afspraak</Btn>
        </div>
        {lijst.length === 0
          ? <EmptyState icon="📅" text="Geen afspraken op deze dag" />
          : lijst.map(a => <AfspraakKaart key={a.id} a={a} />)
        }
      </div>
    );
  };

  const WeekView = () => {
    const ma = weekMaandag(peildatum);
    const dagen = Array.from({ length: 7 }, (_, i) => { const d = new Date(ma); d.setDate(d.getDate() + i); return d; });
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 12 }}>
          {dagen.map(d => {
            const s = dagStr(d); const isVandaag = s === TODAY; const n = opDag(s).length;
            return (
              <div key={s} onClick={() => openDag(s)} style={{ textAlign: "center", padding: "8px 2px", borderRadius: 12, cursor: "pointer",
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
    const isMobiel = window.innerWidth < 640;
    const j = peildatum.getFullYear(), m = peildatum.getMonth();
    const eersteWd = new Date(j, m, 1).getDay();
    const offset = eersteWd === 0 ? 6 : eersteWd - 1;
    const aantalDagen = new Date(j, m + 1, 0).getDate();
    const cellen = Array.from({ length: offset + aantalDagen }, (_, i) => i < offset ? null : new Date(j, m, i - offset + 1));
    return (
      <div>
        {/* Dagnamen header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: isMobiel ? 1 : 2, marginBottom: isMobiel ? 2 : 4 }}>
          {PLAN_DAGEN.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: isMobiel ? 8 : 9, fontWeight: 800, color: C.muted, padding: isMobiel ? "2px 0" : "4px 0" }}>
              {isMobiel ? d.slice(0, 1) : d}
            </div>
          ))}
        </div>

        {/* Kalendercellen */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: isMobiel ? 1 : 2 }}>
          {cellen.map((d, i) => {
            if (!d) return <div key={`_${i}`} />;
            const s = dagStr(d); const lijst = opDag(s); const isVandaag = s === TODAY;
            return (
              <div key={s} onClick={() => isMobiel ? openDag(s) : openNieuw(s)}
                style={{
                  minHeight: isMobiel ? 42 : 54,
                  borderRadius: isMobiel ? 6 : 8,
                  padding: isMobiel ? "4px 2px" : "5px 4px",
                  cursor: "pointer",
                  background: isVandaag
                    ? `linear-gradient(135deg,${C.pink}22,${C.purple}22)`
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isVandaag ? C.pink + "50" : "rgba(255,255,255,0.07)"}`,
                }}>
                {/* Dagnummer */}
                <div style={{
                  fontSize: isMobiel ? 10 : 11,
                  fontWeight: isVandaag ? 900 : 600,
                  color: isVandaag ? C.pink : "#fff",
                  marginBottom: 2,
                  textAlign: isMobiel ? "center" : "left",
                }}>{d.getDate()}</div>

                {/* Afspraken: op desktop tekst, op mobiel gekleurde stippen */}
                {isMobiel ? (
                  lijst.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                      {lijst.slice(0, 3).map(a => (
                        <div key={a.id} style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: STATUS_KLEUR[a.status] || C.purple,
                          flexShrink: 0,
                        }} />
                      ))}
                      {lijst.length > 3 && (
                        <div style={{ fontSize: 7, color: C.muted, lineHeight: "6px" }}>+{lijst.length - 3}</div>
                      )}
                    </div>
                  )
                ) : (
                  <>
                    {lijst.slice(0, 2).map(a => (
                      <div key={a.id} onClick={e => { e.stopPropagation(); openDag(s); }} style={{
                        fontSize: 8, fontWeight: 700, color: "#fff",
                        background: (STATUS_KLEUR[a.status] || C.purple) + "cc",
                        borderRadius: 3, padding: "1px 3px", marginBottom: 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{a.tijdstip} {a.klantNaam || a.behandeling}</div>
                    ))}
                    {lijst.length > 2 && <div style={{ fontSize: 8, color: C.muted }}>+{lijst.length - 2}</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobiel: legenda */}
        {isMobiel && (
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(STATUS_KLEUR).map(([status, kleur]) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: kleur }} />
                <span style={{ fontSize: 10, color: C.muted, textTransform: "capitalize" }}>{status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Mobiel: tip */}
        {isMobiel && (
          <div style={{ marginTop: 8, fontSize: 11, color: C.muted, textAlign: "center" }}>
            Tik op een dag om afspraken te zien of toe te voegen
          </div>
        )}
      </div>
    );
  };

  const printOverzicht = () => {
    const rijen = printAfspraken.map((a, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#faf7ff'}">
        <td>${fmtDate(a.datum)}</td><td>${a.tijdstip}</td><td>${a.duurMinuten} min</td>
        <td>${a.klantNaam || '—'}</td><td>${a.behandeling || '—'}</td>
        <td>${a.prijsIndicatie ? fmt(a.prijsIndicatie) : '—'}</td>
        <td>${a.status}</td><td>${a.notities || ''}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planning ${periodeLabel}</title>
      <style>body{font-family:sans-serif;padding:20px;color:#000}h2{margin-bottom:4px}
      p{color:#666;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#e9d5ff;border:1px solid #bbb;padding:6px 8px;text-align:left}
      td{border:1px solid #bbb;padding:5px 8px}</style></head>
      <body><h2>💅 Gewoon bij Isolde — Planning</h2><p>${periodeLabel}</p>
      ${printAfspraken.length === 0 ? '<p>Geen afspraken in deze periode.</p>' :
        `<table><thead><tr>${["Datum","Tijd","Duur","Klant","Behandeling","Prijs","Status","Notities"]
          .map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rijen}</tbody></table>`}
      <div style="text-align:center;margin-top:24px" class="no-print">
        <button onclick="window.print()" style="background:#a855f7;color:#fff;border:none;padding:10px 28px;border-radius:20px;font-size:13px;cursor:pointer">🖨️ Afdrukken / Opslaan als PDF</button>
      </div>
      <style>@media print{.no-print{display:none}}</style>
      </body></html>`;
    const win = window.open('', '_blank', 'width=900,height=600');
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  return (
    <div>
      {/* Nieuwe klant melding */}
      {nieuweKlant && (
        <Card style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.orange, marginBottom: 10 }}>
            👤 <strong>{nieuweKlant}</strong> staat nog niet in je relaties.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small onClick={voegNieuweKlantToe}>Toevoegen aan relaties</Btn>
            <Btn small variant="ghost" onClick={() => setNieuweKlant(null)}>Overslaan</Btn>
          </div>
        </Card>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Planning</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="secondary" onClick={printOverzicht}>🖨️ Print</Btn>
          <Btn small onClick={() => openNieuw()}>+ Afspraak</Btn>
        </div>
      </div>

      {/* Periode navigatie + weergave toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <button onClick={() => navPeriode(-1)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{periodeLabel}</div>
        <button onClick={() => navPeriode(1)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>›</button>
        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
          {[["dag","Dag"],["week","Week"],["maand","Maand"]].map(([v, l]) => (
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

      {weergave === "dag" ? <DagView /> : weergave === "week" ? <WeekView /> : <MaandView />}

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
        <Field label="Klant">
          <input value={form.klantNaam} onChange={e => sf("klantNaam", e.target.value)}
            list="klanten-planning" placeholder="Naam klant (bestaand of nieuw)"
            style={{ ...inputStyle }}
            onFocus={e => e.target.style.borderColor = C.pink}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"} />
          <datalist id="klanten-planning">
            {klanten.map(k => {
              const naam = `${k.voornaam} ${k.achternaam}`.trim();
              return <option key={k.id} value={naam} />;
            })}
          </datalist>
        </Field>
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
// BTW + INKOMSTENBELASTING OVERZICHT
// ════════════════════════════════════════════════════════════════════════════

// 2026 belastingschijven Box 1
const SCHIJVEN_2026 = [
  { tot: 38883,    tarief: 0.3575 },
  { tot: 78426,    tarief: 0.3756 },
  { tot: Infinity, tarief: 0.4950 },
];

function berekenBoxBelasting(inkomen) {
  let belasting = 0, rest = Math.max(0, inkomen);
  let vorigeGrens = 0;
  for (const { tot, tarief } of SCHIJVEN_2026) {
    const schijfBreedte = tot - vorigeGrens;
    const inSchijf = Math.min(rest, schijfBreedte);
    belasting += inSchijf * tarief;
    rest -= inSchijf;
    vorigeGrens = tot;
    if (rest <= 0) break;
  }
  return belasting;
}

function marginaalTarief(inkomen) {
  for (const { tot, tarief } of SCHIJVEN_2026) {
    if (inkomen <= tot) return tarief;
  }
  return 0.4950;
}

const KWARTALEN = [
  { q: "Q1", label: "Kwartaal 1", periode: "Jan – Mrt", maanden: [0,1,2] },
  { q: "Q2", label: "Kwartaal 2", periode: "Apr – Jun", maanden: [3,4,5] },
  { q: "Q3", label: "Kwartaal 3", periode: "Jul – Sep", maanden: [6,7,8] },
  { q: "Q4", label: "Kwartaal 4", periode: "Okt – Dec", maanden: [9,10,11] },
];

function BTWOverzicht({ inkomsten, uitgaven, ibInst, onUpdateIbInst }) {
  const huidigJaar = new Date().getFullYear();
  const jaren = [...new Set([
    ...inkomsten.map(x => new Date(x.datum).getFullYear()),
    ...uitgaven.map(x => new Date(x.datum).getFullYear()),
    huidigJaar,
  ])].filter(Boolean).sort((a,b) => b - a);

  const [jaar, setJaar] = useState(huidigJaar);
  const [openKwartaal, setOpenKwartaal] = useState(null);
  const [sectie, setSectie] = useState("btw"); // "btw" | "ib"

  // IB instellingen komen via props (gesynchroniseerd via Supabase)
  const setIbInst = (v) => onUpdateIbInst(v);
  const [editIb, setEditIb] = useState(false);
  const [ibForm, setIbForm] = useState(ibInst);
  // Sync ibForm als ibInst van buiten verandert (Realtime sync)
  useEffect(() => { if (!editIb) setIbForm(ibInst); }, [ibInst]);
  const ibf = (k, v) => setIbForm(f => ({ ...f, [k]: v }));

  const btwVoorPeriode = (maanden) => {
    const ontvangen = inkomsten
      .filter(x => { const d = new Date(x.datum); return d.getFullYear() === jaar && maanden.includes(d.getMonth()); })
      .reduce((s, x) => s + (x.btw || 0), 0);
    const betaald = uitgaven
      .filter(x => { const d = new Date(x.datum); return d.getFullYear() === jaar && maanden.includes(d.getMonth()); })
      .reduce((s, x) => s + ((x.bedragIncl - x.bedragExcl) || 0), 0);
    return { ontvangen, betaald, teBetalen: ontvangen - betaald };
  };

  const btwPerMaand = (maand) => {
    const ontvangen = inkomsten
      .filter(x => { const d = new Date(x.datum); return d.getFullYear() === jaar && d.getMonth() === maand; })
      .reduce((s, x) => s + (x.btw || 0), 0);
    const betaald = uitgaven
      .filter(x => { const d = new Date(x.datum); return d.getFullYear() === jaar && d.getMonth() === maand; })
      .reduce((s, x) => s + ((x.bedragIncl - x.bedragExcl) || 0), 0);
    return { ontvangen, betaald, saldo: ontvangen - betaald };
  };

  const totaalJaar = btwVoorPeriode([0,1,2,3,4,5,6,7,8,9,10,11]);

  // IB berekening voor geselecteerd jaar
  const ibBerekening = (() => {
    const salaris = parseFloat(ibInst.salaris) || 0;
    const urenOk = ibInst.urencriterium === "ja";
    const isStarter = ibInst.starter === "ja";

    const omzet = inkomsten
      .filter(x => new Date(x.datum).getFullYear() === jaar)
      .reduce((s, x) => s + (x.exclBtw || 0), 0);
    const kosten = uitgaven
      .filter(x => new Date(x.datum).getFullYear() === jaar)
      .reduce((s, x) => s + (x.bedragExcl || 0), 0);
    const brutoWinst = omzet - kosten;

    const zelfstandigenaftrek = urenOk ? (jaar >= 2026 ? 1200 : 2470) : 0;
    const startersaftrek = (urenOk && isStarter) ? 2123 : 0;
    const winstNaOndAftrek = Math.max(0, brutoWinst - zelfstandigenaftrek - startersaftrek);
    const mkbVrijstelling = winstNaOndAftrek * 0.127;
    const belastbareWinst = Math.max(0, winstNaOndAftrek - mkbVrijstelling);

    const totaalBoxInkomen = salaris + belastbareWinst;
    const belastingTotaal = berekenBoxBelasting(totaalBoxInkomen);
    const belastingAlleen = berekenBoxBelasting(salaris);
    const belastingOpWinst = belastingTotaal - belastingAlleen;
    const margTarief = marginaalTarief(salaris + belastbareWinst / 2);
    const zvwBijdrage = belastbareWinst * 0.0485;

    return { omzet, kosten, brutoWinst, zelfstandigenaftrek, startersaftrek,
      winstNaOndAftrek, mkbVrijstelling, belastbareWinst,
      belastingOpWinst, margTarief, zvwBijdrage, totaalExtra: belastingOpWinst + zvwBijdrage };
  })();

  return (
    <div>
      {/* Header + jaar-selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Belastingen</div>
        <div style={{ display: "flex", gap: 6 }}>
          {jaren.map(j => (
            <button key={j} onClick={() => setJaar(j)} style={{
              padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: "none", cursor: "pointer", fontFamily: "inherit",
              background: j === jaar ? `linear-gradient(135deg,${C.pink},${C.purple})` : "rgba(255,255,255,0.07)",
              color: j === jaar ? "#fff" : C.muted,
            }}>{j}</button>
          ))}
        </div>
      </div>

      {/* Sectie toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["btw","🧾 BTW-aangifte"],["ib","💶 Inkomstenbelasting"]].map(([s, l]) => (
          <button key={s} onClick={() => setSectie(s)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 700, fontSize: 13,
            border: "none", cursor: "pointer", fontFamily: "inherit",
            background: sectie === s ? `linear-gradient(135deg,${C.pink},${C.purple})` : "rgba(255,255,255,0.07)",
            color: sectie === s ? "#fff" : C.muted,
          }}>{l}</button>
        ))}
      </div>

      {sectie === "ib" && (
        <div>
          {/* IB Instellingen */}
          <Card style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editIb ? 12 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>⚙️ Persoonlijke instellingen</div>
              <Btn small variant="secondary" onClick={() => { if (editIb) { setIbInst(ibForm); } else { setIbForm(ibInst); } setEditIb(!editIb); }}>
                {editIb ? "✓ Opslaan" : "✏️"}
              </Btn>
            </div>
            {editIb ? (
              <>
                <Input label="Bruto jaarsalaris loondienst (€)" type="number" value={ibForm.salaris || ""}
                  onChange={e => ibf("salaris", e.target.value)} placeholder="bijv. 35000" />
                <Select label="Voldoe je aan het urencriterium? (≥1.225 uur/jaar in salon)"
                  value={ibForm.urencriterium || ""} onChange={e => ibf("urencriterium", e.target.value)}
                  options={[{value:"ja",label:"Ja (≥1.225 uur)"},{value:"nee",label:"Nee (<1.225 uur)"}]} />
                <Select label="Ben je starter? (max 5 jaar ondernemer)"
                  value={ibForm.starter || ""} onChange={e => ibf("starter", e.target.value)}
                  options={[{value:"ja",label:"Ja"},{value:"nee",label:"Nee"}]} />
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                Salaris: <span style={{ color: "#fff" }}>{ibInst.salaris ? fmt(ibInst.salaris) : "niet ingevuld"}</span>
                {" · "}Urencriterium: <span style={{ color: "#fff" }}>{ibInst.urencriterium || "?"}</span>
                {" · "}Starter: <span style={{ color: "#fff" }}>{ibInst.starter || "?"}</span>
              </div>
            )}
          </Card>

          {/* Winstberekening */}
          <Card>
            <SectionTitle>Winstberekening {jaar}</SectionTitle>
            {[
              ["Omzet (excl. BTW)", ibBerekening.omzet, C.green],
              ["Zakelijke kosten (excl. BTW)", -ibBerekening.kosten, C.red],
              ["= Bruto winst", ibBerekening.brutoWinst, ibBerekening.brutoWinst >= 0 ? "#fff" : C.red],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{val < 0 ? `- ${fmt(Math.abs(val))}` : fmt(val)}</span>
              </div>
            ))}
          </Card>

          {/* Aftrekposten */}
          <Card>
            <SectionTitle>Ondernemersaftrek {jaar}</SectionTitle>
            <div style={{ fontSize: 11, color: ibInst.urencriterium === "ja" ? C.green : C.orange, marginBottom: 10, fontWeight: 700 }}>
              {ibInst.urencriterium === "ja" ? "✓ Urencriterium gehaald" : ibInst.urencriterium === "nee" ? "⚠️ Urencriterium niet gehaald — aftrekken vervallen" : "⚠️ Stel urencriterium in"}
            </div>
            {[
              ["Zelfstandigenaftrek", -ibBerekening.zelfstandigenaftrek, ibBerekening.zelfstandigenaftrek === 0 ? C.muted : null],
              ibBerekening.startersaftrek > 0 ? ["Startersaftrek ⚡", -ibBerekening.startersaftrek, C.orange] : null,
              ["MKB-winstvrijstelling (12,7%)", -ibBerekening.mkbVrijstelling, null],
              ["= Belastbare winst", ibBerekening.belastbareWinst, "#fff"],
            ].filter(Boolean).map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: color || C.green }}>
                  {val < 0 ? `- ${fmt(Math.abs(val))}` : fmt(val)}
                </span>
              </div>
            ))}
            {ibBerekening.startersaftrek > 0 && (
              <div style={{ fontSize: 11, color: C.orange, marginTop: 4 }}>
                ⚡ Startersaftrek verdwijnt per 1 januari 2027!
              </div>
            )}
          </Card>

          {/* Schatting belasting */}
          <Card style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
            <SectionTitle>Geschatte belasting op ZZP-inkomen</SectionTitle>
            {!ibInst.salaris && (
              <div style={{ fontSize: 12, color: C.orange, marginBottom: 10 }}>⚠️ Vul je salaris in voor een nauwkeurige schatting</div>
            )}
            {[
              [`Marginaal tarief Box 1 (${(ibBerekening.margTarief * 100).toFixed(2).replace(".", ",")}%)`, ibBerekening.belastingOpWinst, C.red],
              ["ZVW-bijdrage (4,85%)", ibBerekening.zvwBijdrage, C.orange],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{fmt(val)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Totaal te reserveren</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: C.red }}>{fmt(ibBerekening.totaalExtra)}</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
              Dit is een schatting op basis van 2026-tarieven. Vraag je accountant voor de definitieve aangifte.
            </div>
          </Card>
        </div>
      )}

      {sectie === "btw" && (
        <div>

      {/* Jaartotaal */}
      <Card style={{
        background: totaalJaar.teBetalen > 0 ? "rgba(248,113,113,0.08)" : "rgba(34,197,94,0.08)",
        border: `1px solid ${totaalJaar.teBetalen > 0 ? "rgba(248,113,113,0.25)" : "rgba(34,197,94,0.25)"}`,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>TOTAAL {jaar}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
              Ontvangen <span style={{ color: C.green, fontWeight: 700 }}>{fmt(totaalJaar.ontvangen)}</span>
              {" · "}Betaald <span style={{ color: C.orange, fontWeight: 700 }}>{fmt(totaalJaar.betaald)}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.muted }}>{totaalJaar.teBetalen > 0 ? "Te betalen" : "Teruggave"}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: totaalJaar.teBetalen > 0 ? C.red : C.green }}>
              {fmt(Math.abs(totaalJaar.teBetalen))}
            </div>
          </div>
        </div>
      </Card>

      {/* Per kwartaal */}
      {KWARTALEN.map(({ q, label, periode, maanden }) => {
        const { ontvangen, betaald, teBetalen } = btwVoorPeriode(maanden);
        const isOpen = openKwartaal === q;
        return (
          <Card key={q} style={{ marginBottom: 8 }}>
            {/* Header kwartaal */}
            <div onClick={() => setOpenKwartaal(isOpen ? null : q)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{q}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{periode}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  Ontvangen <span style={{ color: C.green }}>{fmt(ontvangen)}</span>
                  {" · "}Betaald <span style={{ color: C.orange }}>{fmt(betaald)}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge color={teBetalen > 0 ? C.red : C.green}>
                  {teBetalen > 0 ? `▲ ${fmt(teBetalen)}` : `▼ ${fmt(Math.abs(teBetalen))}`}
                </Badge>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{isOpen ? "▲" : "▼"} details</div>
              </div>
            </div>

            {/* Maandbreakdown */}
            {isOpen && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {maanden.map(m => {
                  const { ontvangen: mo, betaald: mb, saldo } = btwPerMaand(m);
                  return (
                    <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0", borderBottom: m !== maanden[2] ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2d0f8" }}>{PLAN_MAANDEN[m]}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                          ↑ <span style={{ color: C.green }}>{fmt(mo)}</span>
                          {" · "}↓ <span style={{ color: C.orange }}>{fmt(mb)}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: saldo > 0 ? C.red : saldo < 0 ? C.green : C.muted }}>
                        {saldo === 0 ? "—" : (saldo > 0 ? "+" : "") + fmt(Math.abs(saldo))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
        ▲ te betalen aan belastingdienst · ▼ teruggave · BTW 21%
      </div>
      </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEMPELKAART
// ════════════════════════════════════════════════════════════════════════════
function Stempelkaart({ klanten, onStempel }) {
  const [zoek, setZoek] = useState("");
  const metKaart = klanten.filter(k => (k.stempelDoel || 0) > 0);
  const gefilterd = metKaart.filter(k =>
    !zoek || `${k.voornaam} ${k.achternaam}`.toLowerCase().includes(zoek.toLowerCase())
  ).sort((a, b) => {
    // Klanten die doel bereikt hebben bovenaan
    const aVol = (a.stempels || 0) >= (a.stempelDoel || 10);
    const bVol = (b.stempels || 0) >= (b.stempelDoel || 10);
    if (aVol !== bVol) return aVol ? -1 : 1;
    return `${a.voornaam} ${a.achternaam}`.localeCompare(`${b.voornaam} ${b.achternaam}`);
  });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 16 }}>Stempelkaarten</div>

      {metKaart.length === 0 ? (
        <EmptyState icon="💳" text="Nog geen klanten met een stempelkaart — stel het in via Relaties → klant bewerken" />
      ) : (
        <>
          <SearchBar value={zoek} onChange={setZoek} placeholder="Zoek klant..." />
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            {metKaart.filter(k => (k.stempels||0) >= (k.stempelDoel||10)).length} behaald · {metKaart.length} actief
          </div>
          {gefilterd.map(k => {
            const stempels = k.stempels || 0;
            const doel = k.stempelDoel || 10;
            const vol = stempels >= doel;
            const pct = Math.min(100, Math.round(stempels / doel * 100));
            return (
              <Card key={k.id} style={vol ? { border: `1px solid ${C.orange}40`, background: "rgba(251,146,60,0.06)" } : {}}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{k.voornaam} {k.achternaam}</div>
                    {k.stempelBeloning && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>🎁 {k.stempelBeloning}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: vol ? C.orange : C.purple }}>{stempels}/{doel}</div>
                    {vol && <div style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>🎉 Behaald!</div>}
                  </div>
                </div>

                {/* Visuele stempels */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                  {Array.from({ length: doel }, (_, i) => (
                    <span key={i} style={{ fontSize: doel > 15 ? 14 : 18, opacity: i < stempels ? 1 : 0.15,
                      filter: i < stempels ? "none" : "grayscale(1)" }}>💅</span>
                  ))}
                </div>

                {/* Progressiebalk */}
                <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2,
                    background: vol ? `linear-gradient(90deg,${C.orange},#f59e0b)` : `linear-gradient(90deg,${C.pink},${C.purple})`,
                    transition: "width 0.3s" }} />
                </div>

                {/* Acties */}
                <div style={{ display: "flex", gap: 8 }}>
                  {!vol && (
                    <Btn small onClick={() => onStempel(k, 1)}>+ Stempel geven</Btn>
                  )}
                  {vol && (
                    <Btn small variant="secondary" onClick={() => onStempel(k, -stempels)}
                      style={{ borderColor: `${C.orange}50`, color: C.orange }}>
                      ✓ Beloning verzilverd — reset
                    </Btn>
                  )}
                  {stempels > 0 && !vol && (
                    <Btn small variant="ghost" onClick={() => onStempel(k, -1)}>− Verwijder stempel</Btn>
                  )}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── Brand CSS + Factuur HTML generator (module-niveau) ───────────────────────
const BRAND_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Montserrat',sans-serif; background:#fff; color:#2a1f1f; }
  .serif { font-family:'Cormorant Garamond',serif; }
  .rose { color:#c4938a; }
  .muted { color:#888; }
`;

function genereerFactuurHtml(factuur, s) {
  const logoHtml = s?.logoBase64
    ? `<img src="${s.logoBase64}" style="max-height:80px;max-width:240px;object-fit:contain;" />`
    : `<div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;letter-spacing:2px;color:#2a1f1f">${s?.naam || "Gewoon bij Isolde"}</div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Factuur ${factuur.nr}</title><style>
  ${BRAND_CSS}
  body{padding:48px;max-width:800px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:28px;margin-bottom:32px;border-bottom:1px solid #e8d5d0}
  .salon-info{font-size:11px;color:#888;line-height:2;margin-top:10px}
  .factuur-label{font-family:'Cormorant Garamond',serif;font-size:38px;font-weight:300;letter-spacing:4px;color:#2a1f1f;text-align:right}
  .factuur-meta{font-size:11px;color:#888;line-height:2;text-align:right;margin-top:8px}
  .factuur-meta strong{color:#2a1f1f}
  .roze-balk{height:2px;background:linear-gradient(90deg,#e8d5d0,#c4938a,#e8d5d0);margin:0 0 28px}
  .klant-blok{background:#fdf8f7;border-left:3px solid #c4938a;padding:14px 18px;margin-bottom:28px}
  .klant-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#c4938a;margin-bottom:4px}
  .klant-naam{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  thead tr{border-bottom:2px solid #e8d5d0}
  th{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#c4938a;padding:10px 12px;text-align:left;font-weight:500}
  td{padding:14px 12px;border-bottom:1px solid #f5eeec;font-size:13px}
  .totalen{margin-left:auto;width:260px}
  .totaal-rij{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#888}
  .totaal-rij.main{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:#2a1f1f;border-top:1px solid #e8d5d0;padding-top:12px;margin-top:6px}
  .betaling{margin-top:36px;padding:18px 20px;background:#fdf8f7;border:1px solid #e8d5d0;border-radius:4px;font-size:12px;line-height:2}
  .betaling-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#c4938a;margin-bottom:8px}
  .footer{margin-top:36px;text-align:center;font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;color:#c4938a;border-top:1px solid #e8d5d0;padding-top:20px}
  @media print{body{padding:30px}}
  </style></head><body>
  <div class="header">
    <div>${logoHtml}<div class="salon-info">${[s?.adres,`${s?.postcode||""} ${s?.stad||""}`.trim(),s?.kvk?`KVK ${s.kvk}`:"",s?.btwNummer?`BTW ${s.btwNummer}`:"",s?.email,s?.telefoon].filter(Boolean).join("<br>")}</div></div>
    <div><div class="factuur-label">FACTUUR</div><div class="factuur-meta">Nr. <strong>${factuur.nr}</strong><br>Datum <strong>${fmtDate(factuur.datum)}</strong><br>Vervaldatum <strong>${fmtDate(factuur.vervalDatum)}</strong></div></div>
  </div>
  <div class="roze-balk"></div>
  ${factuur.klant ? `<div class="klant-blok"><div class="klant-label">Factuur aan</div><div class="klant-naam">${factuur.klant}</div></div>` : ""}
  <table>
    <thead><tr><th>Omschrijving</th><th style="text-align:right">Excl. BTW</th><th style="text-align:right">BTW 21%</th><th style="text-align:right">Incl. BTW</th></tr></thead>
    <tbody><tr>
      <td style="font-size:14px">${factuur.behandeling}</td>
      <td style="text-align:right">${fmt(factuur.exclBtw||0)}</td>
      <td style="text-align:right">${fmt(factuur.btw||0)}</td>
      <td style="text-align:right;font-weight:500">${fmt(factuur.prijs||0)}</td>
    </tr></tbody>
  </table>
  <div class="totalen">
    <div class="totaal-rij"><span>Subtotaal excl. BTW</span><span>${fmt(factuur.exclBtw||0)}</span></div>
    <div class="totaal-rij"><span>BTW 21%</span><span>${fmt(factuur.btw||0)}</span></div>
    <div class="totaal-rij main"><span>Totaal</span><span>${fmt(factuur.prijs||0)}</span></div>
  </div>
  <div class="betaling">
    <div class="betaling-label">Betalingsinformatie</div>
    ${s?.iban ? `IBAN <strong>${s.iban}</strong> t.n.v. <strong>${s.naam||"Gewoon bij Isolde"}</strong><br>` : ""}
    o.v.v. factuurnummer <strong>${factuur.nr}</strong> — betaling voor <strong>${fmtDate(factuur.vervalDatum)}</strong>
    ${factuur.betaalwijze && factuur.betaalwijze !== "Overschrijving" ? `<br><em style="color:#888">Reeds voldaan via ${factuur.betaalwijze}</em>` : ""}
    ${factuur.opmerkingen ? `<br><br>${factuur.opmerkingen}` : ""}
  </div>
  <div class="footer">Bedankt voor uw vertrouwen — ${s?.naam||"Gewoon bij Isolde"} ${s?.tagline ? `· ${s.tagline}` : ""}</div>
  <div style="text-align:center;margin-top:32px;padding-top:20px" class="no-print">
    <button onclick="window.print()" style="background:linear-gradient(135deg,#c4938a,#a87a72);color:#fff;border:none;padding:12px 32px;border-radius:24px;font-size:14px;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:0.5px">🖨️ Afdrukken / Opslaan als PDF</button>
  </div>
  <style>.no-print { } @media print { .no-print { display:none; } }</style>
  </body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// FACTUREN
// ════════════════════════════════════════════════════════════════════════════
const FACTUUR_STATUS = ["concept","verzonden","betaald","vervallen"];
const FACTUUR_STATUS_KLEUR = { concept: "#888", verzonden: "#6366f1", betaald: "#22c55e", vervallen: "#f87171" };

function Facturen({ facturen, salonInst, onDelete, onEdit, onDownload }) {
  const [confirmId, setConfirmId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openEdit = (f) => { setEditItem(f); setForm({ ...f }); setModal(true); };
  const submitEdit = () => { onEdit({ ...editItem, ...form }); setModal(false); setEditItem(null); };

  const gesorteerd = [...facturen].sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
  const totaalBedrag = facturen.reduce((s, f) => s + (f.prijs || 0), 0);
  const betaald = facturen.filter(f => f.status === "betaald").reduce((s, f) => s + (f.prijs || 0), 0);
  const openstaand = facturen.filter(f => f.status === "verzonden").reduce((s, f) => s + (f.prijs || 0), 0);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          ["Totaal", totaalBedrag, C.purple],
          ["Betaald", betaald, C.green],
          ["Openstaand", openstaand, "#6366f1"],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: `${c}18`, border: `1px solid ${c}30`, borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: c, fontWeight: 700, marginBottom: 3 }}>{l}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{fmt(v)}</div>
          </div>
        ))}
      </div>

      {gesorteerd.length === 0
        ? <EmptyState icon="🧾" text="Nog geen facturen aangemaakt — klik op 🧾 bij een inkomen" />
        : gesorteerd.map(f => (
          <Card key={f.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{f.nr}</span>
                  <Badge color={FACTUUR_STATUS_KLEUR[f.status] || "#888"}>{f.status}</Badge>
                  {f.nasPad && <Badge color={C.green}>💾 NAS</Badge>}
                </div>
                {f.klant && <div style={{ fontSize: 13, color: "#e2d0f8", marginBottom: 2 }}>{f.klant}</div>}
                <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(f.datum)}{f.behandeling ? ` · ${f.behandeling}` : ""}</div>
                {f.opmerkingen && <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 4 }}>{f.opmerkingen}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.green, marginBottom: 4 }}>{fmt(f.prijs)}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {f.status !== "betaald" && (
                    <button onClick={() => onEdit({ ...f, status: "betaald" })} title="Markeer als betaald"
                      style={{ background: "none", border: "none", color: "rgba(34,197,94,0.8)", cursor: "pointer", fontSize: 15 }}>✅</button>
                  )}
                  <button onClick={() => onDownload(f)} title="Download/print"
                    style={{ background: "none", border: "none", color: "rgba(99,168,233,0.7)", cursor: "pointer", fontSize: 15 }}>⬇️</button>
                  <button onClick={() => openEdit(f)}
                    style={{ background: "none", border: "none", color: "rgba(200,168,233,0.6)", cursor: "pointer", fontSize: 15 }}>✏️</button>
                  <button onClick={() => setConfirmId(f.id)}
                    style={{ background: "none", border: "none", color: "rgba(248,113,113,0.5)", cursor: "pointer", fontSize: 15 }}>🗑</button>
                </div>
              </div>
            </div>
          </Card>
        ))
      }

      <ConfirmDialog open={!!confirmId} message="Deze factuur wordt permanent verwijderd."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { onDelete(confirmId); setConfirmId(null); }} />

      <Modal open={modal} onClose={() => { setModal(false); setEditItem(null); }} title="Factuur bewerken">
        <Input label="Factuurnummer" value={form.nr || ""} onChange={e => sf("nr", e.target.value)} />
        <Input label="Datum" type="date" value={form.datum || ""} onChange={e => sf("datum", e.target.value)} />
        <Input label="Vervaldatum" type="date" value={form.vervalDatum || ""} onChange={e => sf("vervalDatum", e.target.value)} />
        <Input label="Klant" value={form.klant || ""} onChange={e => sf("klant", e.target.value)} />
        <Input label="Behandeling / omschrijving" value={form.behandeling || ""} onChange={e => sf("behandeling", e.target.value)} />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Input label="Excl. BTW (€)" type="number" step="0.01" value={form.exclBtw || ""} onChange={e => sf("exclBtw", parseFloat(e.target.value) || 0)} /></div>
          <div style={{ flex: 1 }}><Input label="BTW (€)" type="number" step="0.01" value={form.btw || ""} onChange={e => sf("btw", parseFloat(e.target.value) || 0)} /></div>
          <div style={{ flex: 1 }}><Input label="Incl. BTW (€)" type="number" step="0.01" value={form.prijs || ""} onChange={e => sf("prijs", parseFloat(e.target.value) || 0)} /></div>
        </div>
        <Select label="Status" value={form.status || "verzonden"} onChange={e => sf("status", e.target.value)}
          options={FACTUUR_STATUS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
        <Textarea label="Opmerkingen" value={form.opmerkingen || ""} onChange={e => sf("opmerkingen", e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Btn onClick={submitEdit} fullWidth>Opslaan</Btn>
          <Btn variant="secondary" onClick={() => onDownload({ ...editItem, ...form })}>⬇️ Download</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── Salon Instellingen (voor facturen) ───────────────────────────────────────
function SalonInstellingen({ inst, onUpdate }) {
  const [bewerken, setBewerken] = useState(false);
  const [form, setForm] = useState(inst || {});
  useEffect(() => setForm(inst || {}), [inst]);
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogo = (e) => {
    const bestand = e.target.files?.[0];
    if (!bestand) return;
    const reader = new FileReader();
    reader.onload = ev => sf("logoBase64", ev.target.result);
    reader.readAsDataURL(bestand);
  };

  return (
    <Card style={{ background: "rgba(232,121,249,0.06)", border: "1px solid rgba(232,121,249,0.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: bewerken ? 12 : 0 }}>
        <SectionTitle>Salon instellingen (facturen & kaartje)</SectionTitle>
        <Btn small variant="secondary" onClick={() => {
          if (bewerken) onUpdate({ ...inst, ...form });
          setBewerken(!bewerken);
        }}>{bewerken ? "✓ Opslaan" : "✏️ Bewerken"}</Btn>
      </div>
      {bewerken ? (
        <>
          {/* Logo upload */}
          <Field label="Logo">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {form.logoBase64 && <img src={form.logoBase64} alt="logo" style={{ height: 48, borderRadius: 8, background: "#fff", padding: 4 }} />}
              <label style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1.5px dashed rgba(255,255,255,0.2)",
                borderRadius: 12, padding: "10px", color: C.muted, cursor: "pointer",
                fontSize: 13, textAlign: "center", display: "block" }}>
                {form.logoBase64 ? "📎 Ander logo kiezen" : "📎 Logo uploaden (PNG/JPG)"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
              </label>
              {form.logoBase64 && <button onClick={() => sf("logoBase64", null)}
                style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }}>✕</button>}
            </div>
          </Field>
          <Input label="Salonnaam" value={form.naam || ""} onChange={e => sf("naam", e.target.value)} />
          <Input label="Tagline" value={form.tagline || ""} onChange={e => sf("tagline", e.target.value)} placeholder="Nails & More" />
          <Input label="Adres" value={form.adres || ""} onChange={e => sf("adres", e.target.value)} placeholder="Straat en huisnummer" />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Input label="Postcode" value={form.postcode || ""} onChange={e => sf("postcode", e.target.value)} /></div>
            <div style={{ flex: 2 }}><Input label="Stad" value={form.stad || ""} onChange={e => sf("stad", e.target.value)} /></div>
          </div>
          <Input label="Telefoon" type="tel" value={form.telefoon || ""} onChange={e => sf("telefoon", e.target.value)} />
          <Input label="E-mail" type="email" value={form.email || ""} onChange={e => sf("email", e.target.value)} />
          <Input label="Website" value={form.website || ""} onChange={e => sf("website", e.target.value)} placeholder="www.gewoonbijIsolde.nl" />
          <Input label="Instagram" value={form.instagram || ""} onChange={e => sf("instagram", e.target.value)} placeholder="@gewoonbijIsolde" />
          <Input label="KVK-nummer" value={form.kvk || ""} onChange={e => sf("kvk", e.target.value)} placeholder="12345678" />
          <Input label="BTW-nummer" value={form.btwNummer || ""} onChange={e => sf("btwNummer", e.target.value)} placeholder="NL123456789B01" />
          <Input label="IBAN" value={form.iban || ""} onChange={e => sf("iban", e.target.value)} placeholder="NL00 BANK 0000 0000 00" />
          <Input label="Betalingstermijn (dagen)" type="number" value={form.betalingstermijn || "14"} onChange={e => sf("betalingstermijn", e.target.value)} />
        </>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {inst?.logoBase64 && <img src={inst.logoBase64} alt="logo" style={{ height: 44, borderRadius: 8, background: "#fff", padding: 4, flexShrink: 0 }} />}
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
            {[
              ["Naam", inst?.naam],
              ["Adres", inst?.adres ? `${inst.adres}, ${inst.postcode} ${inst.stad}` : null],
              ["KVK", inst?.kvk],
              ["IBAN", inst?.iban],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><span style={{ color: C.label }}>{k}: </span>{v}</div>
            ))}
            {!inst?.iban && <div style={{ color: C.orange }}>⚠️ Vul je gegevens in voor facturen</div>}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── NUC Upload Instellingen ───────────────────────────────────────────────────
function NucInstellingen({ config, onUpdate }) {
  const [testStatus, setTestStatus] = useState(null);
  const [bewerken, setBewerken] = useState(false);
  const [form, setForm] = useState(config || {});

  useEffect(() => setForm(config || {}), [config]);

  const isIngesteld = config?.serverUrl && config?.apiKey;

  const opslaan = () => {
    onUpdate(form);
    setBewerken(false);
    setTestStatus(null);
  };

  const testVerbinding = async () => {
    setTestStatus("bezig");
    try {
      const res = await fetch(`${config.serverUrl.replace(/\/$/, "")}/health`, {
        headers: { "x-api-key": config.apiKey },
        signal: AbortSignal.timeout(5000),
      });
      setTestStatus(res.ok ? "ok" : "fout");
    } catch {
      setTestStatus("fout");
    }
  };

  return (
    <Card style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionTitle>Bewijsstukken (NUC)</SectionTitle>
        <Btn small variant="secondary" onClick={() => { setForm(config); setBewerken(!bewerken); setTestStatus(null); }}>
          {bewerken ? "Annuleren" : "✏️ Bewerken"}
        </Btn>
      </div>

      {!bewerken ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%",
              background: isIngesteld ? C.green : C.orange,
              boxShadow: `0 0 6px ${isIngesteld ? C.green : C.orange}` }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: isIngesteld ? C.green : C.orange }}>
              {isIngesteld ? "Server ingesteld" : "Nog niet ingesteld"}
            </span>
          </div>
          {isIngesteld && (
            <>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 8, wordBreak: "break-all" }}>
                {config.serverUrl}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Btn small variant="secondary" onClick={testVerbinding} disabled={testStatus === "bezig"}>
                  {testStatus === "bezig" ? "⏳ Testen..." : "🔌 Test verbinding"}
                </Btn>
                {testStatus === "ok" && <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>✓ Verbonden!</span>}
                {testStatus === "fout" && <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>✗ Geen verbinding</span>}
              </div>
            </>
          )}
          {!isIngesteld && (
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
              Installeer de server op de NUC en vul hier de Tailscale URL en API-key in.
              Zie <span style={{ color: "#60a5fa" }}>upload-server/README.md</span> voor instructies.
            </div>
          )}
        </>
      ) : (
        <>
          <Input label="Server URL (Tailscale Funnel adres)"
            value={form.serverUrl || ""} onChange={e => setForm(f => ({ ...f, serverUrl: e.target.value }))}
            placeholder="https://jouw-nuc.staartje-xxxxx.ts.net" />
          <Input label="API-key (wachtwoord uit .env)"
            value={form.apiKey || ""} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
            placeholder="nagels2026geheim" />
          <Btn onClick={opslaan} fullWidth disabled={!form.serverUrl || !form.apiKey}>Opslaan</Btn>
        </>
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MEER (instellingen + export)
// ════════════════════════════════════════════════════════════════════════════
function Meer({ prijslijst, onUpdatePrijslijst, inkomsten, uitgaven, klanten, leveranciers, kleuren, syncStatus, onRestoreBackup, nucConfig, onUpdateNucConfig, salonInst, onUpdateSalonInst, onMaakVisitekaartje }) {
  const [editPrijzen, setEditPrijzen] = useState(false);
  const [localPrijzen, setLocalPrijzen] = useState(prijslijst);
  const [exporting, setExporting] = useState(false);
  const [confirmVerwijder, setConfirmVerwijder] = useState(null); // index van te verwijderen behandeling
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
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            {editPrijzen
              ? <>
                  <input value={item.naam}
                    onChange={e => { const u = [...localPrijzen]; u[i] = { ...item, naam: e.target.value }; setLocalPrijzen(u); }}
                    style={{ ...inputStyle, flex: 1, width: "auto", padding: "6px 10px", fontSize: 13 }} />
                  <input type="number" step="0.50" min="0" value={item.prijs}
                    onChange={e => { const u = [...localPrijzen]; u[i] = { ...item, prijs: parseFloat(e.target.value) || 0 }; setLocalPrijzen(u); }}
                    style={{ ...inputStyle, width: 76, flexShrink: 0, padding: "6px 8px", fontSize: 13 }} />
                  <button onClick={() => setConfirmVerwijder(i)}
                    style={{ background: "none", border: "none", color: "rgba(248,113,113,0.6)", cursor: "pointer", fontSize: 16, padding: "0 2px", flexShrink: 0 }}>🗑</button>
                </>
              : <>
                  <div style={{ flex: 1, fontSize: 13, color: "#e2d0f8" }}>{item.naam}</div>
                  <Badge color={C.green}>{item.prijs ? fmt(item.prijs) : "—"}</Badge>
                </>
            }
          </div>
        ))}
        {editPrijzen && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 700 }}>NIEUWE BEHANDELING</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="nieuwBehNaam" placeholder="Naam behandeling"
                style={{ ...inputStyle, flex: 1, width: "auto", padding: "8px 10px", fontSize: 13 }} />
              <input id="nieuwBehPrijs" type="number" step="0.50" min="0" placeholder="€"
                style={{ ...inputStyle, width: 70, flexShrink: 0, padding: "8px 8px", fontSize: 13 }} />
              <button onClick={() => {
                const naam = document.getElementById("nieuwBehNaam").value.trim();
                const prijs = parseFloat(document.getElementById("nieuwBehPrijs").value) || 0;
                if (!naam) return;
                setLocalPrijzen([...localPrijzen, { naam, prijs }]);
                document.getElementById("nieuwBehNaam").value = "";
                document.getElementById("nieuwBehPrijs").value = "";
              }} style={{ background: `linear-gradient(135deg,${C.pink},${C.purple})`, border: "none",
                borderRadius: 10, padding: "8px 14px", color: "#fff", cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "inherit", flexShrink: 0 }}>+ Toevoegen</button>
            </div>
          </div>
        )}
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

      {/* Salon instellingen + visitekaartje */}
      <SalonInstellingen inst={salonInst} onUpdate={onUpdateSalonInst} />
      <Btn fullWidth variant="secondary" onClick={onMaakVisitekaartje} style={{ marginBottom: 12 }}>
        📇 Digitaal visitekaartje openen
      </Btn>

      {/* NUC bewijsstukken instellingen */}
      <NucInstellingen config={nucConfig} onUpdate={onUpdateNucConfig} />

      <ConfirmDialog
        open={confirmVerwijder !== null}
        message={`"${localPrijzen[confirmVerwijder]?.naam}" verwijderen uit de prijslijst?`}
        onCancel={() => setConfirmVerwijder(null)}
        onConfirm={() => { setLocalPrijzen(localPrijzen.filter((_, j) => j !== confirmVerwijder)); setConfirmVerwijder(null); }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TODO LIJST
// ════════════════════════════════════════════════════════════════════════════
const TODO_PRIO = [
  { value: "hoog",   label: "🔴 Hoog",   color: "#f87171" },
  { value: "middel", label: "🟡 Middel",  color: "#fb923c" },
  { value: "laag",   label: "🟢 Laag",    color: "#22c55e" },
];

function TodoLijst({ todos, onAdd, onToggle, onDelete, onEdit }) {
  const [nieuweTekst, setNieuweTekst] = useState("");
  const [nieuwePrio, setNieuwePrio]   = useState("middel");
  const [bewerkId, setBewerkId]       = useState(null);
  const [bewerkTekst, setBewerkTekst] = useState("");
  const [bewerkPrio, setBewerkPrio]   = useState("middel");
  const [filter, setFilter]           = useState("open"); // "open" | "gedaan" | "alles"

  const voegToe = () => {
    const t = nieuweTekst.trim();
    if (!t) return;
    onAdd({ tekst: t, prioriteit: nieuwePrio });
    setNieuweTekst("");
    setNieuwePrio("middel");
  };

  const startBewerk = (todo) => {
    setBewerkId(todo.id);
    setBewerkTekst(todo.tekst);
    setBewerkPrio(todo.prioriteit || "middel");
  };

  const slaBewerk = () => {
    const t = bewerkTekst.trim();
    if (!t) return;
    onEdit(bewerkId, { tekst: t, prioriteit: bewerkPrio });
    setBewerkId(null);
  };

  const gefilterdeItems = (todos || []).filter(todo => {
    if (filter === "open")  return !todo.gedaan;
    if (filter === "gedaan") return  todo.gedaan;
    return true;
  }).sort((a, b) => {
    // Hoog prioriteit bovenaan, dan op aanmaakdatum
    const prioOrder = { hoog: 0, middel: 1, laag: 2 };
    const pa = prioOrder[a.prioriteit] ?? 1;
    const pb = prioOrder[b.prioriteit] ?? 1;
    if (pa !== pb) return pa - pb;
    return (b.aangemaakt || "").localeCompare(a.aangemaakt || "");
  });

  const aantalOpen   = (todos || []).filter(t => !t.gedaan).length;
  const aantalGedaan = (todos || []).filter(t =>  t.gedaan).length;

  return (
    <div>
      <SectionTitle>📝 Taken & To-do lijst</SectionTitle>

      {/* Teller badges */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Badge color={C.pink}>{aantalOpen} open</Badge>
        <Badge color={C.green}>{aantalGedaan} gedaan</Badge>
      </div>

      {/* Nieuwe taak invoer */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <input
              placeholder="Nieuwe taak toevoegen..."
              value={nieuweTekst}
              onChange={e => setNieuweTekst(e.target.value)}
              onKeyDown={e => e.key === "Enter" && voegToe()}
              style={{ ...inputStyle, marginBottom: 0 }}
              onFocus={e => e.target.style.borderColor = C.pink}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"}
            />
          </div>
          <div>
            <select
              value={nieuwePrio}
              onChange={e => setNieuwePrio(e.target.value)}
              style={{
                ...inputStyle, width: "auto", background: "#1a0635", marginBottom: 0,
                appearance: "none", paddingRight: 28,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c8a8e9' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
              }}
            >
              {TODO_PRIO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <Btn onClick={voegToe} variant="primary">+ Toevoegen</Btn>
        </div>
      </Card>

      {/* Filter knoppen */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { id: "open",   label: "📋 Open" },
          { id: "gedaan", label: "✅ Gedaan" },
          { id: "alles",  label: "📁 Alles" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700,
            border: filter === f.id ? `1px solid ${C.pink}` : "1px solid rgba(255,255,255,0.12)",
            background: filter === f.id ? `rgba(232,121,249,0.15)` : "transparent",
            color: filter === f.id ? C.pink : C.muted, cursor: "pointer", fontFamily: "inherit",
          }}>{f.label}</button>
        ))}
      </div>

      {/* Taken lijst */}
      {gefilterdeItems.length === 0 ? (
        <EmptyState icon={filter === "gedaan" ? "✅" : "📝"} text={filter === "gedaan" ? "Nog niets afgerond" : "Geen open taken — goed bezig! 🎉"} />
      ) : (
        gefilterdeItems.map(todo => {
          const prioInfo = TODO_PRIO.find(p => p.value === (todo.prioriteit || "middel"));
          const isBewerk = bewerkId === todo.id;
          return (
            <Card key={todo.id} style={{ marginBottom: 8, opacity: todo.gedaan ? 0.6 : 1 }}>
              {isBewerk ? (
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <input
                      value={bewerkTekst}
                      onChange={e => setBewerkTekst(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && slaBewerk()}
                      style={{ ...inputStyle, flex: 1, minWidth: 140, marginBottom: 0 }}
                      autoFocus
                      onFocus={e => e.target.style.borderColor = C.pink}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"}
                    />
                    <select
                      value={bewerkPrio}
                      onChange={e => setBewerkPrio(e.target.value)}
                      style={{
                        ...inputStyle, width: "auto", background: "#1a0635", marginBottom: 0,
                        appearance: "none", paddingRight: 28,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c8a8e9' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
                      }}
                    >
                      {TODO_PRIO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn small onClick={slaBewerk}>💾 Opslaan</Btn>
                    <Btn small variant="secondary" onClick={() => setBewerkId(null)}>Annuleer</Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {/* Checkbox */}
                  <button onClick={() => onToggle(todo.id)} style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: 8,
                    border: `2px solid ${todo.gedaan ? C.green : "rgba(255,255,255,0.25)"}`,
                    background: todo.gedaan ? C.green + "33" : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 1,
                  }}>
                    {todo.gedaan && <span style={{ fontSize: 14, color: C.green }}>✓</span>}
                  </button>

                  {/* Tekst + metadata */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 600, color: todo.gedaan ? C.muted : C.text,
                      textDecoration: todo.gedaan ? "line-through" : "none",
                      wordBreak: "break-word",
                    }}>{todo.tekst}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: prioInfo?.color, fontWeight: 700 }}>{prioInfo?.label}</span>
                      {todo.aangemaakt && (
                        <span style={{ fontSize: 11, color: C.muted }}>
                          {new Date(todo.aangemaakt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {todo.gedaan && todo.afgerondOp && (
                        <span style={{ fontSize: 11, color: C.green }}>
                          ✓ {new Date(todo.afgerondOp).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acties */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {!todo.gedaan && (
                      <Btn small variant="secondary" onClick={() => startBewerk(todo)}>✏️</Btn>
                    )}
                    <Btn small variant="danger" onClick={() => onDelete(todo.id)}>🗑️</Btn>
                  </div>
                </div>
              )}
            </Card>
          );
        })
      )}
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

  // ── Terugknop mobiel: History API ─────────────────────────────────────────
  const goToTab = (newTab) => {
    history.pushState({ tab: newTab }, "");
    setTab(newTab);
  };
  useEffect(() => {
    history.replaceState({ tab: "home" }, "");
    const onPop = (e) => setTab(e.state?.tab || "home");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const [inkomsten, setInkomsten] = useState([]);
  const [uitgaven, setUitgaven] = useState([]);
  const [klanten, setKlanten] = useState([]);
  const [leveranciers, setLeveranciers] = useState([]);
  const [prijslijst, setPrijslijst] = useState(TREATMENTS);
  const [kleuren, setKleuren] = useState([]);
  const [afspraken, setAfspraken] = useState([]);
  const [nucConfig, setNucConfigState] = useState(() => getNucConfig());
  const [facturen, setFacturen] = useState([]);
  const [todos, setTodos] = useState([]);
  const IB_DEFAULTS = { salaris: "0", urencriterium: "ja", starter: "nee" };
  const [ibInst, setIbInstState] = useState(IB_DEFAULTS);
  const [salonInst, setSalonInst] = useState({
    naam: "Gewoon bij Isolde", adres: "", postcode: "", stad: "",
    kvk: "", btwNummer: "", iban: "", betalingstermijn: "14",
    volgendFactuurnr: 1,
  });

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
      if (db.nucConfig) { setNucConfigState(db.nucConfig); setNucConfig(db.nucConfig); }
      if (db.salonInst) setSalonInst(s => ({ ...s, ...db.salonInst }));
      if (db.facturen) setFacturen(db.facturen);
      if (db.todos) setTodos(db.todos);
      if (db.ibInst) setIbInstState(s => ({ ...IB_DEFAULTS, ...s, ...db.ibInst }));
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
      if (nieuweData.nucConfig) { setNucConfigState(nieuweData.nucConfig); setNucConfig(nieuweData.nucConfig); }
      if (nieuweData.salonInst) setSalonInst(s => ({ ...s, ...nieuweData.salonInst }));
      if (nieuweData.facturen) setFacturen(nieuweData.facturen);
      if (nieuweData.todos) setTodos(nieuweData.todos);
      if (nieuweData.ibInst) setIbInstState(s => ({ ...IB_DEFAULTS, ...s, ...nieuweData.ibInst }));
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

  const geefStempel = async (klant, aantal) => {
    const nieuwAantal = Math.max(0, (klant.stempels || 0) + aantal);
    const bijgewerkt = { ...klant, stempels: nieuwAantal };
    const updated = klanten.map(x => x.id === klant.id ? bijgewerkt : x);
    setKlanten(updated);
    await persist({ klanten: updated });
    if (aantal > 0) showToast(`💅 Stempel gegeven! ${nieuwAantal}/${klant.stempelDoel || 10}`);
    else if (nieuwAantal === 0) showToast("✓ Stempelkaart gereset");
  };

  const editLeverancierHandler = async (item) => {
    const updated = leveranciers.map(x => x.id === item.id ? item : x);
    setLeveranciers(updated); await persist({ leveranciers: updated }); showToast("✓ Leverancier bijgewerkt");
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
  const updateSalonInst = async (inst) => {
    setSalonInst(inst);
    await persist({ salonInst: inst });
    showToast("✓ Saloninstellingen opgeslagen");
  };

  const addFactuur = async (f) => {
    const updated = [...facturen, f];
    setFacturen(updated); await persist({ facturen: updated });
  };
  const editFactuurHandler = async (f) => {
    const updated = facturen.map(x => x.id === f.id ? f : x);
    setFacturen(updated); await persist({ facturen: updated }); showToast("✓ Factuur bijgewerkt");
  };
  const deleteFactuurHandler = async (id) => {
    const updated = facturen.filter(x => x.id !== id);
    setFacturen(updated); await persist({ facturen: updated }); showToast("Factuur verwijderd");
  };
  const downloadFactuur = (f) => {
    const html = genereerFactuurHtml(f, salonInst);
    const win = window.open("", "_blank", "width=820,height=1000");
    win.document.write(html); win.document.close(); win.focus();
  };

  const genereerFactuurNr = async () => {
    const jaar = new Date().getFullYear();
    const bestaande = dbRef.current.facturen || [];
    // Als lijst leeg is: altijd opnieuw beginnen bij 1
    const hoogste = bestaande.length === 0 ? 0 :
      bestaande
        .filter(f => f.nr?.startsWith(`F${jaar}-`))
        .map(f => parseInt(f.nr.split("-")[1]) || 0)
        .reduce((max, n) => Math.max(max, n), 0);
    const volgend = hoogste + 1;
    const label = `F${jaar}-${String(volgend).padStart(3, "0")}`;
    const bijgewerkt = { ...salonInst, volgendFactuurnr: volgend + 1 };
    setSalonInst(bijgewerkt);
    await persist({ salonInst: bijgewerkt });
    return label;
  };

  const openPrintVenster = (html, breedte = 820) => {
    const win = window.open("", "_blank", `width=${breedte},height=1000`);
    win.document.write(html); win.document.close(); win.focus();
  };

  const maakFactuur = async (item) => {
    const nr = await genereerFactuurNr();
    const s = salonInst;
    const verval = new Date(item.datum);
    verval.setDate(verval.getDate() + parseInt(s.betalingstermijn || 14));

    const factuurObj = {
      id: uid(), nr,
      datum: item.datum,
      vervalDatum: verval.toISOString().slice(0, 10),
      klant: item.klant || "",
      behandeling: item.behandeling || "",
      exclBtw: item.exclBtw || 0,
      btw: item.btw || 0,
      prijs: item.prijs || 0,
      betaalwijze: item.betaalwijze || "",
      status: (item.betaalwijze && item.betaalwijze !== "Overschrijving") ? "betaald" : "verzonden",
      inkomstId: item.id,
      nasPad: null,
      opmerkingen: "",
    };

    // Opslaan via dbRef (geen stale closure)
    const lijst1 = [...(dbRef.current.facturen || []), factuurObj];
    setFacturen(lijst1);
    await persist({ facturen: lijst1 });

    // HTML genereren
    const html = genereerFactuurHtml(factuurObj, s);

    // NAS: HTML → PDF via Puppeteer op de NUC
    try {
      const { serverUrl, apiKey } = nucConfig || getNucConfig();
      if (serverUrl && apiKey) {
        const jaar = item.datum.slice(0, 4);
        const maand = item.datum.slice(5, 7);
        const bestandsnaam = `${nr}_${(item.klant||"factuur").replace(/[^a-zA-Z0-9]/g,"-")}.pdf`;
        const res = await fetch(`${serverUrl.replace(/\/$/, "")}/html-to-pdf`, {
          method: "POST",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ html, pad: `facturen/${jaar}/${maand}`, bestandsnaam }),
        });
        if (res.ok) {
          const data = await res.json();
          const lijst2 = (dbRef.current.facturen || []).map(x =>
            x.id === factuurObj.id ? { ...x, nasPad: data.pad } : x
          );
          setFacturen(lijst2);
          await persist({ facturen: lijst2 });
        }
      }
    } catch (e) { console.warn("NAS PDF factuur:", e); }

    const win = window.open("", "_blank", "width=820,height=1000");
    win.document.write(html); win.document.close(); win.focus();
    showToast("✓ Factuur aangemaakt en opgeslagen");
  };

  const maakVisitekaartje = () => {
    const s = salonInst;
    const logoHtml = s.logoBase64
      ? `<img src="${s.logoBase64}" style="max-height:100px;max-width:280px;object-fit:contain;" />`
      : `<div style="font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:300;letter-spacing:3px;color:#2a1f1f">${s.naam||"Gewoon bij Isolde"}</div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Visitekaartje</title><style>
    ${BRAND_CSS}
    body { background:#f5f0ee; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
    .kaart { background:#fff; width:360px; border-radius:12px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.12); }
    .kaart-top { background:linear-gradient(135deg,#fdf8f7,#f5eeec); padding:36px 32px 28px; text-align:center; border-bottom:1px solid #e8d5d0; }
    .tagline { font-family:'Cormorant Garamond',serif; font-size:14px; font-style:italic; color:#c4938a; margin-top:8px; letter-spacing:1px; }
    .kaart-body { padding:24px 32px; }
    .info-rij { display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid #f5eeec; font-size:13px; color:#555; }
    .info-rij:last-child { border-bottom:none; }
    .info-icon { color:#c4938a; font-size:16px; width:20px; text-align:center; flex-shrink:0; }
    .kaart-bottom { background:linear-gradient(135deg,#2a1f1f,#3d2c2c); padding:16px 32px; text-align:center; }
    .kaart-bottom-tekst { font-family:'Cormorant Garamond',serif; font-size:12px; color:#c4938a; letter-spacing:2px; text-transform:uppercase; }
    .deel-btn { display:block; margin:20px auto 0; padding:10px 28px; background:linear-gradient(135deg,#c4938a,#a87a72); color:#fff; border:none; border-radius:20px; font-size:13px; cursor:pointer; font-family:'Montserrat',sans-serif; letter-spacing:0.5px; }
    @media print { body { background:#fff; } .deel-btn { display:none; } }
    </style></head><body>
    <div>
      <div class="kaart">
        <div class="kaart-top">
          ${logoHtml}
          ${s.tagline ? `<div class="tagline">${s.tagline}</div>` : ""}
        </div>
        <div class="kaart-body">
          ${s.adres ? `<div class="info-rij"><span class="info-icon">📍</span><span>${s.adres}, ${s.postcode||""} ${s.stad||""}</span></div>` : ""}
          ${s.telefoon ? `<div class="info-rij"><span class="info-icon">📞</span><span>${s.telefoon}</span></div>` : ""}
          ${s.email ? `<div class="info-rij"><span class="info-icon">✉️</span><span>${s.email}</span></div>` : ""}
          ${s.website ? `<div class="info-rij"><span class="info-icon">🌐</span><span>${s.website}</span></div>` : ""}
          ${s.instagram ? `<div class="info-rij"><span class="info-icon">📸</span><span>${s.instagram}</span></div>` : ""}
        </div>
        <div class="kaart-bottom">
          <div class="kaart-bottom-tekst">Nails & More</div>
        </div>
      </div>
      <button class="deel-btn" onclick="window.print()">🖨️ Afdrukken / Opslaan als PDF</button>
    </div>
    </body></html>`;
    const win = window.open("", "_blank", "width=440,height=800");
    win.document.write(html); win.document.close(); win.focus();
  };

  const updateNucConfig = async (config) => {
    setNucConfigState(config);
    setNucConfig(config); // ook lokaal opslaan als fallback
    await persist({ nucConfig: config });
    showToast("✓ NUC instellingen opgeslagen & gesynchroniseerd");
  };

  // ── IB instellingen ───────────────────────────────────────────────────────
  const updateIbInst = async (inst) => {
    const bijgewerkt = { ...IB_DEFAULTS, ...inst };
    setIbInstState(bijgewerkt);
    await persist({ ibInst: bijgewerkt });
  };

  // ── Todo handlers ─────────────────────────────────────────────────────────
  const addTodo = async ({ tekst, prioriteit }) => {
    const item = { id: uid(), tekst, prioriteit, gedaan: false, aangemaakt: new Date().toISOString() };
    const updated = [...(dbRef.current.todos || []), item];
    setTodos(updated);
    await persist({ todos: updated });
    showToast("✓ Taak toegevoegd");
  };

  const toggleTodo = async (id) => {
    const now = new Date().toISOString();
    const updated = (dbRef.current.todos || []).map(t =>
      t.id === id ? { ...t, gedaan: !t.gedaan, afgerondOp: !t.gedaan ? now : null } : t
    );
    setTodos(updated);
    await persist({ todos: updated });
  };

  const deleteTodo = async (id) => {
    const updated = (dbRef.current.todos || []).filter(t => t.id !== id);
    setTodos(updated);
    await persist({ todos: updated });
    showToast("Taak verwijderd");
  };

  const editTodo = async (id, velden) => {
    const updated = (dbRef.current.todos || []).map(t => t.id === id ? { ...t, ...velden } : t);
    setTodos(updated);
    await persist({ todos: updated });
    showToast("✓ Taak bijgewerkt");
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
    { id: "facturen",  icon: "🧾", label: "Facturen" },
    { id: "stempels",  icon: "💳", label: "Stempels" },
    { id: "todos",     icon: "✅", label: "Taken" },
    { id: "btw",       icon: "📊", label: "BTW" },
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
    home:      <Dashboard inkomsten={inkomsten} uitgaven={uitgaven} kleuren={kleuren} afspraken={afspraken} onNavigate={goToTab} />,
    inkomsten: <Inkomsten data={inkomsten} prijslijst={prijslijst} klanten={klanten} onAdd={addInkomst} onDelete={deleteItem} onEdit={editInkomst} onMaakFactuur={maakFactuur} onAddKlant={addKlant} />,
    uitgaven:  <Uitgaven data={uitgaven} leveranciers={leveranciers} onAdd={addUitgave} onDelete={deleteItem} onEdit={editUitgave} />,
    relaties:  <Relaties klanten={klanten} leveranciers={leveranciers} prijslijst={prijslijst}
                  onAddKlant={addKlant} onDeleteKlant={deleteKlant} onEditKlant={editKlant}
                  onAddLeverancier={addLeverancier} onDeleteLeverancier={deleteLeverancier}
                  onEditLeverancier={editLeverancierHandler}
                  inkomsten={inkomsten} afspraken={afspraken} facturen={facturen}
                  onStempel={geefStempel} />,
    planning:  <Planning afspraken={afspraken} klanten={klanten} prijslijst={prijslijst}
                  onAdd={addAfspraak} onDelete={deleteAfspraak} onEdit={editAfspraak}
                  onVoltooien={voltooiAfspraak} onAddKlant={addKlant}
                  inkomsten={inkomsten} facturen={facturen} />,
    kleuren:   <KleurenArchief data={kleuren} onAdd={addKleur} onDelete={deleteItem} onEdit={editKleur} />,
    facturen:  <Facturen facturen={facturen} salonInst={salonInst}
                  onDelete={deleteFactuurHandler} onEdit={editFactuurHandler} onDownload={downloadFactuur} />,
    stempels:  <Stempelkaart klanten={klanten} onStempel={geefStempel} />,
    todos:     <TodoLijst todos={todos} onAdd={addTodo} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={editTodo} />,
    btw:       <BTWOverzicht inkomsten={inkomsten} uitgaven={uitgaven} ibInst={ibInst} onUpdateIbInst={updateIbInst} />,
    meer:      <Meer prijslijst={prijslijst} onUpdatePrijslijst={updatePrijslijst}
                  inkomsten={inkomsten} uitgaven={uitgaven} klanten={klanten}
                  leveranciers={leveranciers} kleuren={kleuren} syncStatus={syncStatus}
                  onRestoreBackup={restoreBackup}
                  nucConfig={nucConfig} onUpdateNucConfig={updateNucConfig}
                  salonInst={salonInst} onUpdateSalonInst={updateSalonInst}
                  onMaakVisitekaartje={maakVisitekaartje} />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0d0020,#1e0a3c,#2d1547)", fontFamily: "'Nunito', sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 0; }
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
                <button key={t.id} onClick={() => goToTab(t.id)} style={{
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
            overflowX: "auto", scrollbarWidth: "none",
          }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => goToTab(t.id)} style={{
                flex: "0 0 auto", minWidth: 62, background: "none", border: "none", cursor: "pointer",
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
