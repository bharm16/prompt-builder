import { useState, useRef, useEffect } from "react";

// ━━━ Design tokens — from actual codebase ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  bg: "#0D0E12",
  panelBg: "#11131A",
  cardBg: "#16181E",
  surface: "#141519",
  railBorder: "#1A1C22",
  cardBorder: "#22252C",
  cardBorderHover: "#3A3D46",
  textPrimary: "#E2E6EF",
  textSecondary: "#8B92A5",
  textTertiary: "#555B6E",
  textFaint: "#3A3E4C",
  textGhost: "#2E323E",
  accent: "#6C5CE7",
  green: "#4ADE80",
  amber: "#FBBF24",
  red: "#EF4444",
  sp: {
    subject:    { base: "#B8A9E8", bg: "#B8A9E811" },
    camera:     { base: "#E8C07D", bg: "#E8C07D11" },
    lighting:   { base: "#E8B87D", bg: "#E8B87D11" },
    location:   { base: "#8DC5E8", bg: "#8DC5E811" },
    style:      { base: "#D4A0D0", bg: "#D4A0D011" },
    atmosphere: { base: "#7DC5C5", bg: "#7DC5C511" },
    action:     { base: "#7DD3A8", bg: "#7DD3A811" },
  },
};

// ━━━ Icons ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const I = {
  list: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>,
  sliders: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 2v12M8 2v12M11 2v12M3 5h2M6.5 8h3M10 11h2"/></svg>,
  grid: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="5" r="2.5"/><path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4"/><circle cx="11" cy="4.5" r="1.8"/><path d="M11 8.5c1.7 0 3 1.3 3 3"/></svg>,
  palette: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2a6 6 0 00-1 11.9c.9.2 1.4-.5 1.4-1v-.7c0-.8.5-1.1 1-1.3.3-.1.6-.3.6-.8 0-.3-.2-.6-.5-.8A6 6 0 008 2z"/><circle cx="5.5" cy="6" r=".8" fill="currentColor"/><circle cx="8" cy="5" r=".8" fill="currentColor"/><circle cx="10.5" cy="6.5" r=".8" fill="currentColor"/></svg>,
  home: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l5-5 5 5M3.5 5.5V12h3V9h1v3h3V5.5"/></svg>,
  chevDown: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 3.5l2.5 3 2.5-3"/></svg>,
  sparkle: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 1v2M6.5 10v2M1 6.5h2M10 6.5h2M3 3l1.2 1.2M8.8 8.8L10 10M10 3L8.8 4.2M4.2 8.8L3 10"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/></svg>,
  generate: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 2l-1 3.5L1 6.5l3.5 1L5.5 11l1-3.5L10 6.5 6.5 5.5z"/><path d="M10.5 1l-.5 1.5L8.5 3l1.5.5.5 1.5.5-1.5L13 3l-1.5-.5z"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 3v8M3 7h8"/></svg>,
  x: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l6 6M8 2l-6 6"/></svg>,
  image: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1.5" width="10" height="10" rx="2"/><circle cx="4.5" cy="4.5" r="1"/><path d="M11.5 8.5l-3-3-5.5 5.5"/></svg>,
  folder: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 3A1.5 1.5 0 013 1.5h2.5l1.5 2h3.5A1.5 1.5 0 0112 5v5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 011 10V3z"/></svg>,
  motion: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M2 9.5l3.5-3.5 2 2L11 4"/><path d="M8.5 4H11v2.5"/></svg>,
  preview: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2.5" width="5" height="4" rx="0.8"/><rect x="7" y="2.5" width="5" height="4" rx="0.8"/><rect x="1" y="7.5" width="5" height="4" rx="0.8"/><rect x="7" y="7.5" width="5" height="4" rx="0.8"/></svg>,
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL RAIL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ToolRailButton({ icon, label, active, onClick, variant }) {
  const isHeader = variant === "header";
  const [hovered, setHovered] = useState(false);
  if (isHeader) {
    return (
      <button onClick={onClick}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{
          width: 36, height: 36, borderRadius: 8,
          border: `1px solid ${active ? C.accent + "44" : C.railBorder}`,
          background: active ? `${C.accent}15` : hovered ? "#151720" : "transparent",
          color: active ? C.accent : C.textTertiary,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}>{icon}</button>
    );
  }
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: 44, padding: "7px 0",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        background: active ? "#1C1E26" : hovered ? "#151720" : "transparent",
        border: "none", borderRadius: 8, cursor: "pointer",
        color: active ? C.textPrimary : C.textTertiary,
        transition: "all 0.15s",
      }}>
      {icon}
      <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.03em" }}>{label}</span>
    </button>
  );
}

function ToolRail({ activePanel, onPanelChange }) {
  return (
    <aside style={{
      width: 56, height: "100%", flexShrink: 0,
      display: "flex", flexDirection: "column", alignItems: "center",
      borderRight: `1px solid ${C.railBorder}`,
      background: C.bg, padding: "10px 0",
    }}>
      <ToolRailButton icon={I.list} label="" variant="header"
        active={activePanel === "sessions"}
        onClick={() => onPanelChange(activePanel === "sessions" ? "studio" : "sessions")} />
      <div style={{ width: 28, height: 1, background: C.railBorder, margin: "6px 0" }} />
      <nav style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <ToolRailButton icon={I.sliders} label="Tool" active={activePanel === "studio"} onClick={() => onPanelChange("studio")} />
        <ToolRailButton icon={I.grid} label="Apps" active={activePanel === "apps"} onClick={() => onPanelChange("apps")} />
        <ToolRailButton icon={I.users} label="Chars" active={activePanel === "characters"} onClick={() => onPanelChange("characters")} />
        <ToolRailButton icon={I.palette} label="Styles" active={activePanel === "styles"} onClick={() => onPanelChange("styles")} />
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingBottom: 4 }}>
        <button style={{
          width: 32, height: 32, borderRadius: 8,
          border: "none", background: "transparent",
          color: C.textTertiary, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{I.home}</button>
        <div style={{
          width: 28, height: 28, borderRadius: 14,
          background: `linear-gradient(135deg, ${C.accent}, #8B5CF6)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff",
          marginTop: 6, cursor: "pointer",
        }}>B</div>
      </div>
    </aside>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEMANTIC SPANS + SUGGESTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Span({ children, cat, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  const lit = active || hovered;
  const c = C.sp[cat] || C.sp.subject;
  return (
    <span onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: `1.5px solid ${lit ? c.base : `${c.base}33`}`,
        color: lit ? C.textPrimary : C.textSecondary,
        background: lit ? c.bg : "transparent",
        borderRadius: lit ? 2 : 0, padding: "0 1px",
        cursor: "pointer", transition: "all 0.12s",
      }}>{children}</span>
  );
}

function Alt({ text }) {
  const [h, setH] = useState(false);
  return (
    <button onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        padding: "5px 12px", borderRadius: 20,
        border: `1px solid ${h ? C.accent + "66" : C.cardBorder}`,
        background: h ? `${C.accent}0c` : "transparent",
        color: h ? C.textPrimary : C.textSecondary,
        fontSize: 12, fontFamily: "inherit", cursor: "pointer",
        transition: "all 0.12s", whiteSpace: "nowrap",
      }}>{text}</button>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROMPT BAR BUTTON (ghost style for settings row)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function BarBtn({ children, active, accent, onClick, style: sx }) {
  const [h, setH] = useState(false);
  const lit = active || h;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 30, padding: "0 10px", borderRadius: 8,
        border: "none", background: lit ? "#1C1E26" : "transparent",
        color: accent ? C.accent : lit ? C.textPrimary : C.textTertiary,
        fontSize: 12, fontWeight: accent ? 600 : 500,
        fontFamily: "inherit", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 5,
        transition: "all 0.12s", whiteSpace: "nowrap",
        ...sx,
      }}>{children}</button>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// START FRAME POPOVER (thumbnail + motion, appears on click)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function StartFramePopover({ onClose, onClearFrame, hasFrame, onSelectMotion, selectedMotion }) {
  const motions = ["None", "Dolly in", "Dolly out", "Pan left", "Pan right", "Arc left", "Arc right", "Crane up", "Crane down", "Orbit CW"];
  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: "absolute", bottom: "calc(100% + 8px)", left: 0,
      width: 220, borderRadius: 12,
      border: `1px solid ${C.cardBorder}`,
      background: C.cardBg, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      overflow: "hidden", animation: "fadeUp 0.15s ease",
      zIndex: 100,
    }}>
      {hasFrame ? (
        <>
          {/* Thumbnail */}
          <div style={{ position: "relative", aspectRatio: "16/9", background: "linear-gradient(135deg, #1a3a2a, #0a2a1a)" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>beach_golden_hour.jpg</span>
            </div>
            <button onClick={onClearFrame} style={{
              position: "absolute", top: 6, right: 6,
              width: 22, height: 22, borderRadius: 6,
              background: "rgba(0,0,0,0.5)", border: "none",
              color: "rgba(255,255,255,0.6)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{I.x}</button>
          </div>
          {/* Motion selector */}
          <div style={{ padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.textFaint, letterSpacing: "0.06em", marginBottom: 6 }}>
              CAMERA MOTION
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {motions.map(m => {
                const active = selectedMotion === m;
                return (
                  <button key={m} onClick={() => onSelectMotion(m)} style={{
                    height: 26, padding: "0 9px", borderRadius: 6,
                    border: `1px solid ${active ? C.accent + "66" : C.cardBorder}`,
                    background: active ? `${C.accent}15` : "transparent",
                    color: active ? C.accent : C.textSecondary,
                    fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                    transition: "all 0.12s",
                  }}>{m}</button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: 16, textAlign: "center" }}>
          <div style={{
            width: "100%", height: 80, borderRadius: 8,
            border: `1.5px dashed ${C.cardBorder}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 6, cursor: "pointer", marginBottom: 8,
            transition: "border-color 0.15s",
          }}>
            <span style={{ color: C.textFaint, display: "flex" }}>{I.image}</span>
            <span style={{ fontSize: 11, color: C.textTertiary }}>Drop image or click to upload</span>
          </div>
          <span style={{ fontSize: 10, color: C.textFaint }}>Or select from storyboard previews</span>
        </div>
      )}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STORYBOARD FILMSTRIP (appears after Preview)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function StoryboardStrip({ selectedIndex, onSelect, onDismiss }) {
  const frames = [
    "linear-gradient(135deg, #1a3a2a 0%, #0a2a1a 100%)",
    "linear-gradient(135deg, #2a3a1a 0%, #1a2a0a 100%)",
    "linear-gradient(135deg, #1a2a3a 0%, #0a1a2a 100%)",
    "linear-gradient(135deg, #3a2a1a 0%, #2a1a0a 100%)",
  ];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 16px", animation: "fadeUp 0.2s ease",
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: C.textFaint, letterSpacing: "0.05em", flexShrink: 0 }}>
        PREVIEW
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {frames.map((bg, i) => {
          const active = selectedIndex === i;
          return (
            <button key={i} onClick={() => onSelect(i)} style={{
              width: 72, height: 44, borderRadius: 8, padding: 0,
              border: `2px solid ${active ? C.accent : "transparent"}`,
              background: bg, cursor: "pointer",
              opacity: active ? 1 : 0.7,
              transition: "all 0.15s", outline: "none",
              boxShadow: active ? `0 0 12px ${C.accent}44` : "none",
            }} />
          );
        })}
      </div>
      <button onClick={() => onSelect(selectedIndex)} style={{
        height: 26, padding: "0 10px", borderRadius: 6,
        border: `1px solid ${C.accent}44`, background: `${C.accent}11`,
        color: C.accent, fontSize: 11, fontWeight: 600,
        fontFamily: "inherit", cursor: "pointer",
        transition: "all 0.12s",
      }}>
        Use as start frame
      </button>
      <div style={{ flex: 1 }} />
      <button onClick={onDismiss} style={{
        width: 24, height: 24, borderRadius: 6,
        border: "none", background: "transparent",
        color: C.textFaint, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{I.x}</button>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN LAYOUT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function CanvasRedesignV1() {
  const [activePanel, setActivePanel] = useState("studio");
  const [activeSpan, setActiveSpan] = useState(null);
  const [promptFocused, setPromptFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genPct, setGenPct] = useState(0);

  // Start frame + motion state
  const [hasStartFrame, setHasStartFrame] = useState(true);
  const [showStartFramePopover, setShowStartFramePopover] = useState(false);
  const [selectedMotion, setSelectedMotion] = useState("Dolly in");

  // Storyboard state
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [storyboardSelection, setStoryboardSelection] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Model state
  const [selectedModel, setSelectedModel] = useState("Sora 2");
  const [showModelPicker, setShowModelPicker] = useState(false);

  const isWan = selectedModel.startsWith("Wan");
  const creditCost = isWan ? 5 : selectedModel.includes("Hailuo") ? 20 : 80;

  const toggle = (key) => setActiveSpan(prev => prev === key ? null : key);

  const suggestions = {
    subject: ["elderly fisherman", "young dancer", "silhouetted figure", "child with kite"],
    camera: ["dolly push-in", "steadicam follow", "crane descent", "handheld"],
    camera2: ["static wide", "orbit", "whip pan", "POV"],
    lighting: ["blue hour", "overcast diffusion", "harsh noon", "twilight"],
    lighting2: ["cold rim light", "dappled sun", "neon accent", "firelight"],
    location: ["rocky coastline", "volcanic shore", "wooden pier", "tidal flats"],
    style: ["deep focus", "tilt-shift", "rack focus pull", "split diopter"],
    atmosphere: ["volumetric fog", "lens dust", "chromatic aberration", "film grain"],
  };

  const versions = ["#1a2a1a, #0a1a0a", "#1a3a2a, #0a2a1a", "#2a1a3a, #1a0a2a"];

  const handleGenerate = () => {
    setIsGenerating(true); setGenPct(0);
    const iv = setInterval(() => {
      setGenPct(p => {
        if (p >= 100) { clearInterval(iv); setTimeout(() => setIsGenerating(false), 600); return 100; }
        return p + Math.random() * 18 + 4;
      });
    }, 350);
  };

  const handlePreview = () => {
    setPreviewLoading(true);
    setTimeout(() => {
      setPreviewLoading(false);
      setShowStoryboard(true);
      setStoryboardSelection(0);
    }, 1500);
  };

  const handleStoryboardSelect = (idx) => {
    setStoryboardSelection(idx);
  };

  const handleUseAsStartFrame = () => {
    setHasStartFrame(true);
    setShowStoryboard(false);
  };

  const models = [
    { name: "Hailuo 2.3 Fast", cost: 20, tags: ["Start Frame", "2m"] },
    { name: "Wan 2.1", cost: 5, tags: ["Start Frame", "End Frame", "Styles", "1m"], desc: "Fastest lower-quality model" },
    { name: "Wan 2.2", cost: 8, tags: ["Start Frame", "2m"], desc: "Fast, high-quality from Alibaba" },
    { name: "Kling 3.0", cost: 120, tags: ["Start Frame", "End Frame", "5m"], isNew: true, expensive: true },
    { name: "Runway Gen-4.5", cost: 100, tags: ["Start Frame", "5m"], isNew: true, expensive: true },
    { name: "Sora 2", cost: 80, tags: ["Start Frame", "3m"], desc: "High-quality from OpenAI" },
  ];

  return (
    <div
      onClick={() => { setActiveSpan(null); setPromptFocused(false); setShowStartFramePopover(false); setShowModelPicker(false); }}
      style={{
        width: "100vw", height: "100vh",
        background: C.bg, overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: C.textPrimary, display: "flex", position: "relative",
      }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        ::selection { background: ${C.accent}44; }
        textarea::placeholder { color: ${C.textFaint}; }
        textarea { resize: none; border: none; outline: none; background: transparent; font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.cardBorder}; border-radius: 2px; }
      `}</style>

      {/* ═══ TOOL RAIL ═══ */}
      <ToolRail activePanel={activePanel} onPanelChange={setActivePanel} />

      {/* ═══ FULL CANVAS AREA — no panel ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        {/* Version thumbnails (left edge) */}
        <div style={{
          position: "absolute", left: 20, top: "50%", transform: "translateY(-60%)",
          display: "flex", flexDirection: "column", gap: 8, zIndex: 20,
          alignItems: "center",
        }}>
          <button style={{
            width: 52, height: 52, borderRadius: 10,
            border: `1.5px dashed ${C.cardBorder}`,
            background: `${C.surface}88`, backdropFilter: "blur(12px)",
            color: C.textFaint, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.textFaint}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.cardBorder}
          >{I.plus}</button>
          {versions.map((g, i) => {
            const active = i === 2;
            return (
              <button key={i} style={{
                width: 52, height: 52, borderRadius: 10, padding: 0,
                border: `2px solid ${active ? C.textPrimary : "transparent"}`,
                background: `linear-gradient(135deg, ${g})`,
                cursor: "pointer", position: "relative", overflow: "hidden",
                transition: "all 0.15s", outline: "none",
                opacity: active ? 1 : 0.6,
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.opacity = "0.85" }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.opacity = active ? "1" : "0.6" }}
              >
                <div style={{ position: "absolute", bottom: 3, right: 4, fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>v{i + 1}</div>
              </button>
            );
          })}
        </div>

        {/* Main content column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 96px", overflow: "hidden" }}>

          {/* Top bar */}
          <div style={{ height: 48, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 4px" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.02em" }}>PromptCanvas</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: C.textTertiary, display: "flex", alignItems: "center", gap: 4 }}>
              Untitled session {I.chevDown}
            </span>
            <div style={{ width: 1, height: 16, background: C.railBorder, margin: "0 4px" }} />
            <span style={{ fontSize: 12, color: C.textSecondary, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: C.green }} />
              247 credits
            </span>
          </div>

          {/* THE VIDEO CANVAS */}
          <div style={{
            flex: 1, minHeight: 0, borderRadius: 16,
            background: "linear-gradient(160deg, #1a3a2a 0%, #0a2a1a 35%, #1a2030 70%, #0f1520 100%)",
            position: "relative", overflow: "hidden", cursor: "pointer",
          }}>
            {/* Ambient light */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 65% 45%, rgba(251,191,36,0.07) 0%, transparent 55%), radial-gradient(ellipse at 30% 55%, rgba(74,222,128,0.03) 0%, transparent 40%)",
              pointerEvents: "none",
            }} />

            {/* Play button */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ opacity: 0.5, transition: "opacity 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
              >
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="27" stroke="white" strokeWidth="1" strokeOpacity="0.25"/>
                  <path d="M23 17l14 11-14 11V17z" fill="white" fillOpacity="0.6"/>
                </svg>
              </div>
            </div>

            {/* Generation overlay */}
            {isGenerating && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(12,13,17,0.85)", backdropFilter: "blur(16px)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 14,
                animation: "fadeUp 0.2s ease",
              }}>
                <div style={{
                  width: 24, height: 24,
                  border: `2px solid ${C.accent}33`, borderTopColor: C.accent,
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }} />
                <span style={{ fontSize: 13, color: C.textSecondary, fontWeight: 500 }}>
                  {genPct < 30 ? "Analyzing prompt…" : genPct < 65 ? "Generating…" : "Rendering…"}
                </span>
                <div style={{ width: 160, height: 2, borderRadius: 1, background: C.cardBorder }}>
                  <div style={{
                    width: `${Math.min(genPct, 100)}%`, height: "100%", borderRadius: 1,
                    background: C.accent, transition: "width 0.3s",
                  }} />
                </div>
              </div>
            )}

            {/* Top-right actions */}
            <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 6 }}>
              {[
                <svg key="fs" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M9 1h4v4M5 13H1V9M14 1L8.5 6.5M0 13l5.5-5.5"/></svg>,
                <svg key="dl" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1.5v9M4 8.5l3 3 3-3M1.5 12.5h11"/></svg>,
              ].map((icon, i) => (
                <button key={i} style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.5)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.55)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.35)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)" }}
                >{icon}</button>
              ))}
            </div>

            {/* Bottom metadata */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              padding: "40px 20px 14px",
              background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
              display: "flex", gap: 16, alignItems: "flex-end",
            }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>1920×1080</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>5s</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{selectedModel}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>v3 · just now</span>
            </div>
          </div>

          {/* Action row */}
          <div style={{ padding: "8px 4px 4px", display: "flex", gap: 16, alignItems: "center" }}>
            {["Reuse", "Extend", "Copy prompt", "Share", "Download"].map(label => (
              <button key={label} style={{
                background: "none", border: "none", color: C.textFaint,
                fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                padding: "2px 0", transition: "color 0.12s",
              }}
                onMouseEnter={e => e.currentTarget.style.color = C.textSecondary}
                onMouseLeave={e => e.currentTarget.style.color = C.textFaint}
              >{label}</button>
            ))}
          </div>

          {/* ═══ STORYBOARD FILMSTRIP (appears after Preview) ═══ */}
          {showStoryboard && (
            <StoryboardStrip
              selectedIndex={storyboardSelection}
              onSelect={handleStoryboardSelect}
              onDismiss={() => setShowStoryboard(false)}
            />
          )}

          {/* ═══ PROMPT AREA (bottom, Krea-style canvas prompt) ═══ */}
          <div onClick={e => e.stopPropagation()} style={{
            flexShrink: 0, padding: "4px 0 16px",
            display: "flex", flexDirection: "column", gap: 0,
          }}>
            {/* Suggestion strip */}
            {activeSpan && suggestions[activeSpan] && (
              <div style={{
                display: "flex", gap: 6, padding: "0 4px 8px",
                alignItems: "center", animation: "fadeUp 0.15s ease",
                overflowX: "auto",
              }}>
                <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 600, letterSpacing: "0.05em", flexShrink: 0 }}>ALT</span>
                {suggestions[activeSpan].map(s => <Alt key={s} text={s} />)}
              </div>
            )}

            {/* Prompt container */}
            <div onClick={() => setPromptFocused(true)} style={{
              padding: "14px 16px", borderRadius: 14,
              border: `1px solid ${promptFocused ? C.accent + "44" : C.cardBorder}`,
              background: C.surface, transition: "border-color 0.2s",
              minHeight: 56,
            }}>
              {/* Prompt text with semantic spans */}
              <div style={{ fontSize: 14, lineHeight: 1.75, color: C.textSecondary }}>
                <Span cat="camera" active={activeSpan === "camera"} onClick={() => toggle("camera")}>Wide shot</Span>
                {": "}
                <Span cat="subject" active={activeSpan === "subject"} onClick={() => toggle("subject")}>woman in her 30s</Span>
                {" walks barefoot along a "}
                <Span cat="location" active={activeSpan === "location"} onClick={() => toggle("location")}>pristine beach</Span>
                {" at "}
                <Span cat="lighting" active={activeSpan === "lighting"} onClick={() => toggle("lighting")}>golden hour</Span>
                {", "}
                <Span cat="camera" active={activeSpan === "camera2"} onClick={() => toggle("camera2")}>lateral tracking shot</Span>
                {", "}
                <Span cat="lighting" active={activeSpan === "lighting2"} onClick={() => toggle("lighting2")}>warm backlight</Span>
                {" catching spray from gentle waves, "}
                <Span cat="style" active={activeSpan === "style"} onClick={() => toggle("style")}>shallow depth of field</Span>
                {", "}
                <Span cat="atmosphere" active={activeSpan === "atmosphere"} onClick={() => toggle("atmosphere")}>anamorphic lens flare</Span>
              </div>

              {/* ═══ SETTINGS ROW — inside prompt, below text ═══ */}
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                marginTop: 10, paddingTop: 10,
                borderTop: `1px solid #181A20`,
              }}>
                {/* Start frame (with popover) */}
                <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                  <BarBtn
                    active={showStartFramePopover}
                    onClick={() => setShowStartFramePopover(!showStartFramePopover)}
                  >
                    {hasStartFrame ? (
                      <>
                        <div style={{
                          width: 20, height: 14, borderRadius: 3,
                          background: "linear-gradient(135deg, #1a3a2a, #0a2a1a)",
                          border: `1px solid ${C.cardBorder}`, flexShrink: 0,
                        }} />
                        <span style={{ color: C.textPrimary, fontSize: 12 }}>Start frame</span>
                        {selectedMotion !== "None" && (
                          <span style={{
                            fontSize: 10, color: C.accent, fontWeight: 600,
                            padding: "1px 5px", borderRadius: 4,
                            background: `${C.accent}11`,
                          }}>{selectedMotion}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span style={{ display: "flex", opacity: 0.6 }}>{I.image}</span>
                        Start frame
                      </>
                    )}
                  </BarBtn>
                  {showStartFramePopover && (
                    <StartFramePopover
                      hasFrame={hasStartFrame}
                      onClose={() => setShowStartFramePopover(false)}
                      onClearFrame={() => { setHasStartFrame(false); setSelectedMotion("None"); }}
                      selectedMotion={selectedMotion}
                      onSelectMotion={setSelectedMotion}
                    />
                  )}
                </div>

                {/* Assets / References */}
                <BarBtn onClick={e => e.stopPropagation()}>
                  <span style={{ display: "flex", opacity: 0.6 }}>{I.folder}</span>
                  Assets
                </BarBtn>

                {/* Aspect ratio */}
                <BarBtn>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2" width="9" height="7" rx="1.5"/></svg>
                  16:9
                </BarBtn>

                {/* Duration */}
                <BarBtn>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><circle cx="5.5" cy="5.5" r="4.5"/><path d="M5.5 3v3l2 1"/></svg>
                  5s
                </BarBtn>

                {/* AI Enhance */}
                <BarBtn accent onClick={e => e.stopPropagation()}>
                  {I.sparkle} Enhance
                </BarBtn>

                <div style={{ flex: 1 }} />

                {/* Character count */}
                <span style={{ fontSize: 10, color: C.textFaint, fontVariantNumeric: "tabular-nums", marginRight: 4 }}>190</span>

                {/* Preview button (secondary) */}
                <button onClick={handlePreview} disabled={previewLoading} style={{
                  height: 34, padding: "0 14px", borderRadius: 9,
                  border: `1px solid ${C.cardBorder}`,
                  background: "transparent",
                  color: previewLoading ? C.textFaint : C.textSecondary,
                  fontSize: 12, fontWeight: 600,
                  fontFamily: "inherit", cursor: previewLoading ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
                  onMouseEnter={e => { if (!previewLoading) { e.currentTarget.style.borderColor = C.cardBorderHover; e.currentTarget.style.color = C.textPrimary; }}}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.cardBorder; e.currentTarget.style.color = previewLoading ? C.textFaint : C.textSecondary; }}
                >
                  {previewLoading ? (
                    <>
                      <div style={{
                        width: 12, height: 12,
                        border: `1.5px solid ${C.textFaint}`, borderTopColor: C.textSecondary,
                        borderRadius: "50%", animation: "spin 0.8s linear infinite",
                      }} />
                      Generating…
                    </>
                  ) : (
                    <>
                      <span style={{ display: "flex" }}>{I.preview}</span>
                      Preview · ~4 cr
                    </>
                  )}
                </button>

                {/* Generate button (primary, cost-aware) */}
                <button onClick={handleGenerate} style={{
                  height: 34, padding: "0 18px", borderRadius: 9,
                  border: "none",
                  background: isWan
                    ? "transparent"
                    : C.textPrimary,
                  ...(isWan ? {
                    border: `1px solid ${C.textPrimary}`,
                    color: C.textPrimary,
                  } : {
                    color: C.bg,
                  }),
                  fontSize: 12, fontWeight: 700,
                  fontFamily: "inherit", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.15s", whiteSpace: "nowrap",
                  letterSpacing: "0.01em",
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  {isWan ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1v3M6 8v3M9 3L7.5 5.5M4.5 6.5L3 9M3 3l1.5 2.5M7.5 6.5L9 9"/></svg>
                      Draft · {creditCost} cr
                    </>
                  ) : (
                    <>
                      {I.generate}
                      Generate · {creditCost} cr
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ MODEL SELECTOR — bottom-left corner, Krea-style ═══ */}
        <div onClick={e => e.stopPropagation()} style={{
          position: "absolute", bottom: 16, left: 16, zIndex: 50,
        }}>
          <button onClick={() => setShowModelPicker(!showModelPicker)} style={{
            height: 36, padding: "0 14px", borderRadius: 10,
            border: `1px solid ${C.cardBorder}`,
            background: `${C.cardBg}ee`, backdropFilter: "blur(12px)",
            color: C.textPrimary, fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7,
            transition: "all 0.15s", whiteSpace: "nowrap",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.cardBorderHover}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.cardBorder}
          >
            <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 500 }}>Model</span>
            <span style={{ fontWeight: 700 }}>{selectedModel}</span>
            <span style={{ display: "flex", color: C.textTertiary }}>{I.chevDown}</span>
          </button>

          {/* Model picker popover */}
          {showModelPicker && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 8px)", left: 0,
              width: 320, maxHeight: 420, borderRadius: 14,
              border: `1px solid ${C.cardBorder}`,
              background: C.cardBg, boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
              overflow: "auto", animation: "fadeUp 0.15s ease",
            }}>
              {models.map((m, i) => {
                const active = selectedModel === m.name;
                return (
                  <button key={m.name} onClick={() => { setSelectedModel(m.name); setShowModelPicker(false); }} style={{
                    width: "100%", padding: "12px 16px", textAlign: "left",
                    border: "none", borderBottom: i < models.length - 1 ? `1px solid ${C.railBorder}` : "none",
                    background: active ? `${C.accent}0a` : "transparent",
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "background 0.12s",
                    display: "flex", flexDirection: "column", gap: 4,
                  }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#1C1E26" }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{m.name}</span>
                      {m.isNew && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: C.green,
                          padding: "1px 6px", borderRadius: 4,
                          background: `${C.green}15`, letterSpacing: "0.03em",
                        }}>New</span>
                      )}
                      <div style={{ flex: 1 }} />
                      {active && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill={C.accent}><circle cx="7" cy="7" r="6"/><path d="M4.5 7l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                      )}
                    </div>
                    {m.desc && <span style={{ fontSize: 11, color: C.textTertiary }}>{m.desc}</span>}
                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                      {m.tags.map(t => (
                        <span key={t} style={{
                          fontSize: 10, color: t === "Expensive model" ? C.amber : C.textFaint,
                          padding: "2px 6px", borderRadius: 4,
                          background: t === "Expensive model" ? `${C.amber}11` : `${C.cardBorder}66`,
                          fontWeight: 500,
                        }}>{t === "Expensive model" ? `⚠ ${t}` : t}</span>
                      ))}
                      <span style={{
                        fontSize: 10, color: C.textFaint,
                        padding: "2px 6px", borderRadius: 4,
                        background: `${C.cardBorder}66`, fontWeight: 500,
                      }}>{m.cost} cr</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
