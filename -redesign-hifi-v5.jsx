import { useState, useRef, useEffect } from "react";

// ─── Design tokens ──────────────────────────────────────
const C = {
  bg: "#0D0E12",
  panelBg: "#111318",
  cardBg: "#16181E",
  cardBorder: "#22252C",
  cardBorderHover: "#3A3D46",
  cardBorderFocus: "#6C5CE7",
  railBg: "#0D0E12",
  railBorder: "#1A1C22",
  railActive: "#1C1E26",
  textPrimary: "#E2E6EF",
  textSecondary: "#8B92A5",
  textTertiary: "#555B6E",
  textFaint: "#3A3E4C",
  accent: "#6C5CE7",
  accentGlow: "#6C5CE744",
  green: "#4ADE80",
  amber: "#FBBF24",
  red: "#EF4444",
};

const I = {
  menu: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>,
  tool: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 2v12M8 2v12M11 2v12M3 5h2M6.5 8h3M10 11h2"/></svg>,
  apps: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="5" r="2.5"/><path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4"/><circle cx="11" cy="4.5" r="1.8"/><path d="M11 8.5c1.7 0 3 1.3 3 3"/></svg>,
  palette: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2a6 6 0 00-1 11.9c.9.2 1.4-.5 1.4-1v-.7c0-.8.5-1.1 1-1.3.3-.1.6-.3.6-.8 0-.3-.2-.6-.5-.8A6 6 0 008 2z"/><circle cx="5.5" cy="6" r=".8" fill="currentColor"/><circle cx="8" cy="5" r=".8" fill="currentColor"/><circle cx="10.5" cy="6.5" r=".8" fill="currentColor"/></svg>,
  home: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l5-5 5 5M3.5 5.5V12h3V9h1v3h3V5.5"/></svg>,
  video: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="3" width="8" height="8" rx="1.5"/><path d="M9.5 6l3-2v6l-3-2"/></svg>,
  image: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1.5" width="11" height="11" rx="2"/><circle cx="5" cy="5" r="1.2"/><path d="M12.5 9l-3-3-6 6"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 3v8M3 7h8"/></svg>,
  copy: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><path d="M9 4V2.5A1.5 1.5 0 007.5 1h-5A1.5 1.5 0 001 2.5v5A1.5 1.5 0 002.5 9H4"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3.5h9M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M10 3.5l-.5 7a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 013.5 10.5L3 3.5"/></svg>,
  sparkle: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 1v2M6.5 10v2M1 6.5h2M10 6.5h2M3 3l1.2 1.2M8.8 8.8L10 10M10 3L8.8 4.2M4.2 8.8L3 10"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/></svg>,
  chevDown: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 3.5l2.5 3 2.5-3"/></svg>,
  motion: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="1" y="1" width="12" height="12" rx="2"/><path d="M4 10l3-3 2 1.5L12 5"/></svg>,
  settings: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="2"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M11.2 2.8l-1 1M3.8 10.2l-1 1"/></svg>,
  upload: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9V2.5M3.5 5L6.5 2l3 3M2 9.5v1A1.5 1.5 0 003.5 12h6a1.5 1.5 0 001.5-1.5v-1"/></svg>,
  folder: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 3A1.5 1.5 0 013 1.5h2.5l1.5 2h3.5A1.5 1.5 0 0112 5v5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 011 10V3z"/></svg>,
  generate: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 2l-1 3.5L1 6.5l3.5 1L5.5 11l1-3.5L10 6.5 6.5 5.5z"/><path d="M10.5 1l-.5 1.5L8.5 3l1.5.5.5 1.5.5-1.5L13 3l-1.5-.5z"/></svg>,
  star: <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" stroke="none"><path d="M5 0l1.5 3.1 3.5.5-2.5 2.4.6 3.5L5 7.8 1.9 9.5l.6-3.5L0 3.6l3.5-.5z"/></svg>,
  warning: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 9h8L5 1zM5 4v2.5M5 7.5v.5"/></svg>,
};

// ─── Shared ─────────────────────────────────────────────
function RailItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 44, padding: "7px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: active ? C.railActive : "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: active ? C.textPrimary : C.textTertiary, transition: "all 0.15s" }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#151720" }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}>
      {icon}<span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.03em" }}>{label}</span>
    </button>
  );
}

function TabPill({ active, icon, children, onClick }) {
  return (
    <button onClick={onClick} style={{ height: 30, padding: "0 14px", borderRadius: 15, border: "none", background: active ? C.textPrimary : "transparent", color: active ? "#0D0E12" : C.textTertiary, fontSize: 12, fontWeight: active ? 600 : 500, fontFamily: "'Inter', -apple-system, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
      <span style={{ opacity: active ? 1 : 0.6 }}>{icon}</span>{children}
    </button>
  );
}

function KeyframeSlot({ filled, gradient, index }) {
  return (
    <div style={{ width: 104, height: 60, borderRadius: 8, border: `1.5px ${filled ? "solid" : "dashed"} ${filled ? C.cardBorderHover : C.cardBorder}`, background: filled ? `linear-gradient(135deg, ${gradient})` : C.cardBg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }}>
      {filled ? (<><div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} /><div style={{ position: "absolute", bottom: 4, left: 6, fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Frame {index + 1}</div></>) : (<span style={{ color: C.textTertiary }}>{I.plus}</span>)}
    </div>
  );
}

function IconBtn({ icon }) {
  return (
    <button style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: C.textTertiary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.background = C.cardBorder; e.currentTarget.style.color = C.textSecondary }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textTertiary }}>
      {icon}
    </button>
  );
}

function SettingsPill({ children }) {
  return (<button style={{ height: 28, padding: "0 8px", borderRadius: 6, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.textTertiary, fontSize: 11, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>{children}</button>);
}

// ─── Preview Frame Action ───────────────────────────────
function PreviewFrameAction({ lastUsed, onGenerate }) {
  const [hoveredSide, setHoveredSide] = useState(null);
  return (
    <div style={{ height: 26, display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.cardBorder}`, background: C.bg, transition: "border-color 0.15s", ...(hoveredSide ? { borderColor: C.cardBorderHover } : {}) }}>
      <button onClick={() => onGenerate(1)} onMouseEnter={() => setHoveredSide("single")} onMouseLeave={() => setHoveredSide(null)} title="Generate 1 preview · 1 cr"
        style={{ height: "100%", padding: "0 7px", border: "none", background: hoveredSide === "single" ? `${C.cardBorder}88` : lastUsed === 1 ? C.cardBg : "transparent", color: hoveredSide === "single" ? C.textPrimary : lastUsed === 1 ? C.textSecondary : C.textFaint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s", position: "relative" }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/></svg>
        {lastUsed === 1 && <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: C.accent }} />}
      </button>
      <div style={{ width: 1, height: 14, alignSelf: "center", background: C.cardBorder }} />
      <button onClick={() => onGenerate(4)} onMouseEnter={() => setHoveredSide("timeline")} onMouseLeave={() => setHoveredSide(null)} title="Generate 4 previews · ~4 cr"
        style={{ height: "100%", padding: "0 7px", border: "none", background: hoveredSide === "timeline" ? `${C.cardBorder}88` : lastUsed === 4 ? C.cardBg : "transparent", color: hoveredSide === "timeline" ? C.textPrimary : lastUsed === 4 ? C.textSecondary : C.textFaint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s", position: "relative" }}>
        <svg width="22" height="13" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3.5" width="4" height="7" rx="0.8"/><rect x="6" y="3.5" width="4" height="7" rx="0.8"/><rect x="11" y="3.5" width="4" height="7" rx="0.8"/><rect x="16" y="3.5" width="4" height="7" rx="0.8"/></svg>
        {lastUsed === 4 && <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: C.accent }} />}
      </button>
    </div>
  );
}

// ─── Match Bar ──────────────────────────────────────────
function MatchBar({ pct, color }) {
  return (
    <div style={{ width: 48, height: 4, borderRadius: 2, background: `${C.cardBorder}`, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: color || C.green, transition: "width 0.3s ease" }} />
    </div>
  );
}

// ─── Model Dropdown with Recommendations ────────────────
function ModelDropdown({ models, selectedModel, recommended, unavailable, onSelect, onClose }) {
  const recIds = recommended.map(r => r.id);
  const otherModels = models.filter(m => !recIds.includes(m.id) && !unavailable.some(u => u.id === m.id));

  return (
    <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, width: 264, background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 0, boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px ${C.cardBorder}`, zIndex: 100, overflow: "hidden" }}>

      {/* ─── Recommended section ─── */}
      {recommended.length > 0 && (
        <div style={{ padding: "10px 6px 4px" }}>
          <div style={{ padding: "0 8px 6px", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textFaint, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: C.amber }}>{I.star}</span>
            Recommended for this prompt
          </div>

          {recommended.map((rec, i) => {
            const model = models.find(m => m.id === rec.id);
            if (!model) return null;
            const isSelected = model.id === selectedModel;
            const isTop = i === 0;
            return (
              <button key={model.id} onClick={() => { onSelect(model.id); onClose() }}
                style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: isTop ? `1px solid ${C.accent}33` : "1px solid transparent", background: isTop ? `${C.accent}0a` : isSelected ? `${C.accent}12` : "transparent", color: isSelected ? C.textPrimary : C.textSecondary, fontSize: 12, fontFamily: "inherit", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, textAlign: "left", transition: "all 0.1s", marginBottom: 2 }}
                onMouseEnter={e => { if (!isTop) e.currentTarget.style.background = `${C.cardBorder}44` }}
                onMouseLeave={e => { if (!isTop) e.currentTarget.style.background = isSelected ? `${C.accent}12` : "transparent" }}
              >
                {/* Top row: name + match + badge + cost */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                  {isTop && <span style={{ color: C.amber, flexShrink: 0 }}>{I.star}</span>}
                  <span style={{ fontWeight: isTop ? 700 : isSelected ? 600 : 400, color: isTop ? C.textPrimary : undefined, flex: 1 }}>{model.label}</span>
                  <span style={{ fontSize: 10, color: C.textTertiary, fontVariantNumeric: "tabular-nums" }}>{rec.match}%</span>
                  <MatchBar pct={rec.match} color={isTop ? C.green : C.accent} />
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: model.badgeColor, opacity: 0.7 }}>{model.badge}</span>
                  <span style={{ fontSize: 10, color: C.textFaint, fontVariantNumeric: "tabular-nums", minWidth: 30, textAlign: "right" }}>{model.credits} cr</span>
                </div>
                {/* Capability tags — only for top rec */}
                {isTop && rec.capabilities && (
                  <div style={{ display: "flex", gap: 4, paddingLeft: 20 }}>
                    {rec.capabilities.map((cap, ci) => (
                      <span key={ci} style={{ fontSize: 9, color: C.textTertiary, padding: "1px 5px", borderRadius: 3, background: `${C.cardBorder}88`, lineHeight: 1.4 }}>{cap}</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Divider ─── */}
      {recommended.length > 0 && otherModels.length > 0 && (
        <div style={{ height: 1, background: C.cardBorder, margin: "2px 14px" }} />
      )}

      {/* ─── Other models ─── */}
      {otherModels.length > 0 && (
        <div style={{ padding: "4px 6px" }}>
          {otherModels.map(model => {
            const isSelected = model.id === selectedModel;
            return (
              <button key={model.id} onClick={() => { onSelect(model.id); onClose() }}
                style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 6, border: "none", background: isSelected ? `${C.accent}15` : "transparent", color: isSelected ? C.textPrimary : C.textSecondary, fontSize: 12, fontWeight: isSelected ? 600 : 400, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left", transition: "all 0.1s" }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = `${C.cardBorder}44` }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${C.accent}15` : "transparent" }}
              >
                <span style={{ flex: 1 }}>{model.label}</span>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: model.badgeColor, opacity: 0.7 }}>{model.badge}</span>
                <span style={{ fontSize: 10, color: C.textFaint, fontVariantNumeric: "tabular-nums" }}>{model.credits} cr</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Unavailable ─── */}
      {unavailable.length > 0 && (
        <div style={{ padding: "2px 6px 8px" }}>
          <div style={{ height: 1, background: C.cardBorder, margin: "2px 8px 6px" }} />
          {unavailable.map(u => (
            <div key={u.id} style={{ height: 30, padding: "0 8px", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textFaint }}>
              <span style={{ color: C.amber, opacity: 0.6, flexShrink: 0 }}>{I.warning}</span>
              <span>{u.label}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 9, color: C.textFaint, fontStyle: "italic" }}>{u.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────
export default function ToolPanelHiFiV5() {
  const [activeTab, setActiveTab] = useState("video");
  const [railPanel, setRailPanel] = useState("tool");
  const [refsOpen, setRefsOpen] = useState(true);
  const [lastPreviewMode, setLastPreviewMode] = useState(1);
  const [promptText, setPromptText] = useState(
    "A woman in her 30s walks barefoot along a pristine beach at golden hour, lateral tracking shot, warm backlight catching spray from gentle waves, shallow depth of field, anamorphic lens flare"
  );
  const [modelOpen, setModelOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("sora-2");
  const textareaRef = useRef(null);

  const models = [
    { id: "wan-2.2", label: "Wan 2.2", credits: 5, badge: "draft", badgeColor: C.green },
    { id: "sora-2", label: "Sora 2", credits: 80, badge: "render", badgeColor: C.accent },
    { id: "veo-3", label: "Veo 3", credits: 30, badge: "render", badgeColor: C.accent },
    { id: "kling-2.1", label: "Kling 2.1", credits: 35, badge: "render", badgeColor: C.accent },
    { id: "luma-ray3", label: "Luma Ray 3", credits: 40, badge: "render", badgeColor: C.accent },
  ];

  // Simulated recommendation data (would come from backend)
  const recommended = [
    { id: "sora-2", match: 87, capabilities: ["General Quality", "Motion Quality"] },
    { id: "veo-3", match: 72 },
  ];
  const unavailable = [
    { id: "kling-2.1", label: "Kling 2.1", reason: "Missing credentials" },
  ];

  const currentModel = models.find(m => m.id === selectedModel);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [promptText]);

  const handlePreviewGenerate = (frameCount) => {
    setLastPreviewMode(frameCount);
    console.log(`→ Generate ${frameCount} Flux preview(s)`);
  };

  return (
    <div onClick={() => setModelOpen(false)} style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#080910", padding: 40, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: `0 0 80px ${C.accentGlow}, 0 0 0 1px ${C.railBorder}` }}>
        <div style={{ position: "absolute", top: -100, left: -50, width: 300, height: 300, background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ display: "flex", height: 780, position: "relative" }}>

          {/* ═══ RAIL ═══ */}
          <div style={{ width: 56, background: C.railBg, borderRight: `1px solid ${C.railBorder}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 2 }}>
            <button style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.railBorder}`, background: "transparent", color: C.textTertiary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{I.menu}</button>
            <div style={{ width: 28, height: 1, background: C.railBorder, margin: "6px 0" }} />
            <RailItem icon={I.tool} label="Tool" active={railPanel === "tool"} onClick={() => setRailPanel("tool")} />
            <RailItem icon={I.apps} label="Apps" active={railPanel === "apps"} onClick={() => setRailPanel("apps")} />
            <RailItem icon={I.users} label="Chars" active={railPanel === "chars"} onClick={() => setRailPanel("chars")} />
            <RailItem icon={I.palette} label="Styles" active={railPanel === "styles"} onClick={() => setRailPanel("styles")} />
            <div style={{ flex: 1 }} />
            <button style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: C.textTertiary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{I.home}</button>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}, #8B5CF6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 6 }}>B</div>
          </div>

          {/* ═══ PANEL ═══ */}
          <div style={{ width: 400, background: C.panelBg, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Tab bar */}
            <div style={{ height: 48, borderBottom: `1px solid ${C.railBorder}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 4 }}>
              <div style={{ display: "flex", gap: 2, background: C.bg, borderRadius: 16, padding: 2 }}>
                <TabPill active={activeTab === "video"} icon={I.video} onClick={() => setActiveTab("video")}>Video</TabPill>
                <TabPill active={activeTab === "image"} icon={I.image} onClick={() => setActiveTab("image")}>Image</TabPill>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: C.textTertiary, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>Untitled session {I.chevDown}</span>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

              {/* ═══ PROMPT CARD ═══ */}
              <div
                style={{ border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: C.cardBg, overflow: "hidden", transition: "border-color 0.2s" }}
                onFocus={e => e.currentTarget.style.borderColor = C.cardBorderFocus}
                onBlur={e => e.currentTarget.style.borderColor = C.cardBorder}
              >
                <div style={{ padding: "12px 12px 0", display: "flex", gap: 6 }}>
                  <KeyframeSlot filled gradient="#1a4a3a, #0a2a1a" index={0} />
                  <KeyframeSlot filled={false} index={1} />
                  <KeyframeSlot filled={false} index={2} />
                </div>
                <div style={{ padding: "10px 12px 0" }}>
                  <textarea ref={textareaRef} value={promptText} onChange={e => setPromptText(e.target.value)} placeholder="Describe your shot..." style={{ width: "100%", minHeight: 130, resize: "none", border: "none", background: "transparent", color: C.textPrimary, fontSize: 13, lineHeight: 1.65, fontFamily: "inherit", outline: "none", padding: 0 }} />
                </div>

                {/* ═══ ACTION BAR ═══ */}
                <div style={{ height: 42, borderTop: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", padding: "0 8px", gap: 2 }}>
                  <IconBtn icon={I.copy} />
                  <IconBtn icon={I.trash} />
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: C.textFaint, marginRight: 8, fontVariantNumeric: "tabular-nums" }}>{promptText.length}</span>
                  <PreviewFrameAction lastUsed={lastPreviewMode} onGenerate={handlePreviewGenerate} />
                  <div style={{ width: 4 }} />
                  <button
                    style={{ height: 26, padding: "0 10px", borderRadius: 6, border: `1px solid ${C.accent}44`, background: `${C.accent}11`, color: C.accent, fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${C.accent}22`; e.currentTarget.style.borderColor = `${C.accent}88` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${C.accent}11`; e.currentTarget.style.borderColor = `${C.accent}44` }}
                  >
                    {I.sparkle} AI Enhance
                  </button>
                </div>
              </div>

              {/* ═══ References ═══ */}
              <div>
                <button onClick={() => setRefsOpen(!refsOpen)} style={{ width: "100%", display: "flex", alignItems: "center", padding: "6px 2px", background: "none", border: "none", cursor: "pointer", gap: 6 }}>
                  <span style={{ color: C.textTertiary, transition: "transform 0.2s", transform: refsOpen ? "rotate(0)" : "rotate(-90deg)" }}>{I.chevDown}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>References</span>
                  <div style={{ flex: 1, height: 1, background: C.cardBorder, margin: "0 8px" }} />
                  <span style={{ fontSize: 10, color: C.textFaint }}>0 images</span>
                </button>
                {refsOpen && (
                  <div style={{ marginTop: 4, border: `1px solid ${C.cardBorder}`, borderRadius: 10, background: C.cardBg, padding: 20, textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                      {[{ bg: "linear-gradient(135deg, #2a1a3a, #1a0a2a)", w: 52, h: 40, rot: -8 }, { bg: "linear-gradient(135deg, #1a3a2a, #0a2a1a)", w: 56, h: 42, rot: 0 }, { bg: "linear-gradient(135deg, #3a2a1a, #2a1a0a)", w: 48, h: 38, rot: 8 }].map((c, i) => (
                        <div key={i} style={{ width: c.w, height: c.h, borderRadius: 6, background: c.bg, border: `1px solid ${C.cardBorder}`, transform: `rotate(${c.rot}deg)`, marginLeft: i > 0 ? -10 : 0 }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>Create consistent scenes</div>
                    <div style={{ fontSize: 11, color: C.textTertiary, lineHeight: 1.5, maxWidth: 260, margin: "0 auto 14px" }}>Use 1–3 character or location images to build your scene.</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {[{ icon: I.folder, label: "Assets" }, { icon: I.upload, label: "Upload" }].map((btn, i) => (
                        <button key={i} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: i === 1 ? C.cardBg : "transparent", color: C.textSecondary, fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.cardBorderHover; e.currentTarget.style.color = C.textPrimary }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.cardBorder; e.currentTarget.style.color = C.textSecondary }}>
                          {btn.icon} {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ SETTINGS ROW ═══ */}
            <div style={{ height: 44, borderTop: `1px solid ${C.railBorder}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 6 }}>
              <button style={{ height: 28, padding: "0 10px", borderRadius: 14, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.textSecondary, fontSize: 11, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>{I.motion} Motion</button>
              <div style={{ flex: 1 }} />
              <SettingsPill>16:9</SettingsPill>
              <SettingsPill>5s</SettingsPill>
              <SettingsPill>{I.settings}</SettingsPill>
            </div>

            {/* ═══ FOOTER ═══ */}
            <div style={{ height: 64, borderTop: `1px solid ${C.railBorder}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 10, background: `linear-gradient(180deg, ${C.panelBg} 0%, ${C.bg} 100%)` }}>

              {/* Model selector with recommendation dropdown */}
              <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                <button onClick={() => setModelOpen(!modelOpen)}
                  style={{ height: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.cardBg, color: C.textPrimary, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  {currentModel?.label}{I.chevDown}
                </button>

                {modelOpen && (
                  <ModelDropdown
                    models={models}
                    selectedModel={selectedModel}
                    recommended={recommended}
                    unavailable={unavailable}
                    onSelect={setSelectedModel}
                    onClose={() => setModelOpen(false)}
                  />
                )}
              </div>

              <span style={{ fontSize: 11, color: C.textTertiary, fontVariantNumeric: "tabular-nums" }}>· {currentModel?.credits} cr</span>
              <div style={{ flex: 1 }} />

              <button
                style={{ height: 38, padding: "0 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.accent}, #8B5CF6)`, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: `0 2px 12px ${C.accent}55, 0 0 0 1px ${C.accent}33`, transition: "all 0.2s", letterSpacing: "0.02em" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px ${C.accent}77, 0 0 0 1px ${C.accent}55`; e.currentTarget.style.transform = "translateY(-1px)" }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 12px ${C.accent}55, 0 0 0 1px ${C.accent}33`; e.currentTarget.style.transform = "none" }}
              >
                {I.generate} Generate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ANNOTATIONS ═══ */}
      <div style={{ width: 280, marginLeft: 40, display: "flex", flexDirection: "column", gap: 20 }}>

        <div style={{ background: C.cardBg, border: `1px solid ${C.accent}44`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 10, letterSpacing: "0.04em" }}>★ RECOMMENDATION IN DROPDOWN</div>
          <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7 }}>
            Model recommendation moved <strong style={{ color: C.textPrimary }}>inside the model selector dropdown</strong>. Shows up exactly when you're choosing a model, disappears when you're not.
          </div>
          <div style={{ height: 8 }} />
          <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7 }}>
            Eliminates an entire persistent section from the panel. Zero screen real estate when idle.
          </div>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 10 }}>DROPDOWN ANATOMY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "★ RECOMMENDED", desc: "Top section. Sorted by match %. Best match gets star, capability tags, and subtle border.", color: C.amber },
              { label: "OTHER MODELS", desc: "Standard list below divider. Name, badge (draft/render), credit cost.", color: C.textSecondary },
              { label: "⚠ UNAVAILABLE", desc: "Grayed out at bottom with reason (e.g. 'Missing credentials'). Visible but not clickable.", color: C.textFaint },
            ].map(item => (
              <div key={item.label} style={{ padding: "6px 8px", background: C.bg, borderRadius: 6, border: `1px solid ${C.cardBorder}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: item.color, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: C.textTertiary, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>BEFORE → AFTER</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, padding: "8px", background: C.bg, borderRadius: 8, border: `1px solid ${C.red}33` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.red, marginBottom: 4 }}>BEFORE</div>
              <div style={{ fontSize: 10, color: C.textTertiary, lineHeight: 1.6 }}>
                Permanent section<br/>
                ~120px tall<br/>
                Always visible<br/>
                Separate "Use" button<br/>
                Duplicates model selector
              </div>
            </div>
            <div style={{ flex: 1, padding: "8px", background: C.bg, borderRadius: 8, border: `1px solid ${C.green}33` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.green, marginBottom: 4 }}>AFTER</div>
              <div style={{ fontSize: 10, color: C.textTertiary, lineHeight: 1.6 }}>
                Inside model dropdown<br/>
                0px when idle<br/>
                On-demand only<br/>
                Click to select<br/>
                IS the model selector
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 10 }}>SECTION COUNT</div>
          {[
            { label: "Runway", count: 5, color: C.green },
            { label: "v5 (this)", count: 5, color: C.accent },
            { label: "Current", count: 11, color: C.red },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: `${(row.count / 11) * 100}%`, height: 6, borderRadius: 3, background: row.color, minWidth: 16 }} />
              <span style={{ fontSize: 10, color: C.textTertiary, whiteSpace: "nowrap" }}>{row.label} ({row.count})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
