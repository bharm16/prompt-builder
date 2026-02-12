import { useState, useRef, useEffect } from "react";

// ━━━ Design tokens (matched from redesign-hifi-v5) ━━━━━━━━━━━━━━━━━━
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
  cyan: "#22D3EE",
};

// ━━━ Icons ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
  chevRight: <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1.5l3 2.5-3 2.5"/></svg>,
  motion: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="1" y="1" width="12" height="12" rx="2"/><path d="M4 10l3-3 2 1.5L12 5"/></svg>,
  settings: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="2"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M11.2 2.8l-1 1M3.8 10.2l-1 1"/></svg>,
  generate: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 2l-1 3.5L1 6.5l3.5 1L5.5 11l1-3.5L10 6.5 6.5 5.5z"/><path d="M10.5 1l-.5 1.5L8.5 3l1.5.5.5 1.5.5-1.5L13 3l-1.5-.5z"/></svg>,
  link: <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M4.5 6.5a2.5 2.5 0 003.5 0l1-1a2.5 2.5 0 00-3.5-3.5l-.5.5"/><path d="M6.5 4.5a2.5 2.5 0 00-3.5 0l-1 1a2.5 2.5 0 003.5 3.5l.5-.5"/></svg>,
  eye: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M1 6s2-3.5 5-3.5S11 6 11 6s-2 3.5-5 3.5S1 6 1 6z"/><circle cx="6" cy="6" r="1.5"/></svg>,
  check: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.5l2 2 4-4.5"/></svg>,
  arrowRight: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5h6M6 3l2 2-2 2"/></svg>,
  bridge: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M1 8c0-3 2-5 5-5s5 2 5 5"/><path d="M3 8V6M6 8V3M9 8V6"/></svg>,
  paintbrush: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 1.5l3 3-5 5H2.5V7.5z"/><path d="M6.5 2.5l3 3"/></svg>,
};

// ━━━ Rail (same as v5) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RailItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 44, padding: "7px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: active ? C.railActive : "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: active ? C.textPrimary : C.textTertiary, transition: "all 0.15s" }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#151720" }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}>
      {icon}<span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.03em" }}>{label}</span>
    </button>
  );
}

function SettingsPill({ children }) {
  return (<button style={{ height: 28, padding: "0 8px", borderRadius: 6, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.textTertiary, fontSize: 11, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>{children}</button>);
}

function IconBtn({ icon, title, active }) {
  return (
    <button title={title} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: active ? `${C.accent}15` : "transparent", color: active ? C.accent : C.textTertiary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.cardBorder; e.currentTarget.style.color = C.textSecondary } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textTertiary } }}>
      {icon}
    </button>
  );
}

// ━━━ Shot Visual Strip ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The visual continuity chain — always visible, shows what came before
function ShotVisualStrip({ shots, activeShotIndex, onSelectShot }) {
  return (
    <div style={{ padding: "10px 14px 6px", borderBottom: `1px solid ${C.railBorder}` }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textFaint }}>Sequence</span>
        <span style={{ fontSize: 9, color: C.textFaint }}>·</span>
        <span style={{ fontSize: 10, color: C.textTertiary }}>{shots.length} shots</span>
        <div style={{ flex: 1 }} />
        <button style={{ fontSize: 10, color: C.textTertiary, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontFamily: "inherit" }}>
          {I.plus} <span>Add shot</span>
        </button>
      </div>

      {/* Thumbnail chain */}
      <div style={{ display: "flex", gap: 0, alignItems: "center", overflowX: "auto", paddingBottom: 4 }}>
        {shots.map((shot, i) => {
          const isActive = i === activeShotIndex;
          const isComplete = shot.status === "complete";
          const isGenerating = shot.status === "generating";

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {/* Connector arrow between shots */}
              {i > 0 && (
                <div style={{ display: "flex", alignItems: "center", padding: "0 2px" }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 8,
                    background: shot.continuityMode === "bridge" ? `${C.cyan}15` : `${C.accent}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${shot.continuityMode === "bridge" ? `${C.cyan}33` : `${C.accent}33`}`,
                  }}>
                    <span style={{ color: shot.continuityMode === "bridge" ? C.cyan : C.accent, display: "flex" }}>
                      {shot.continuityMode === "bridge" ? I.bridge : I.paintbrush}
                    </span>
                  </div>
                </div>
              )}

              {/* Shot thumbnail */}
              <button
                onClick={() => onSelectShot(i)}
                style={{
                  width: 80, height: 52, borderRadius: 8, padding: 0,
                  border: `2px solid ${isActive ? C.accent : isGenerating ? `${C.amber}55` : C.cardBorder}`,
                  background: C.cardBg, cursor: "pointer",
                  position: "relative", overflow: "hidden",
                  boxShadow: isActive ? `0 0 12px ${C.accent}33` : "none",
                  transition: "all 0.15s",
                  outline: "none",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = C.cardBorderHover }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = isActive ? C.accent : isGenerating ? `${C.amber}55` : C.cardBorder }}
              >
                {/* Gradient thumbnail (simulated frame) */}
                {shot.thumbnail && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `linear-gradient(135deg, ${shot.thumbnail})`,
                    opacity: isActive ? 1 : 0.7,
                  }} />
                )}

                {/* Empty state */}
                {!shot.thumbnail && !isGenerating && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: C.textFaint, fontSize: 10 }}>{i + 1}</span>
                  </div>
                )}

                {/* Generating spinner */}
                {isGenerating && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${C.bg}88` }}>
                    <div style={{ width: 14, height: 14, border: `2px solid ${C.amber}33`, borderTopColor: C.amber, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  </div>
                )}

                {/* Shot number badge */}
                <div style={{
                  position: "absolute", top: 3, left: 3,
                  fontSize: 8, fontWeight: 700, color: isActive ? "#fff" : C.textTertiary,
                  background: isActive ? `${C.accent}cc` : `${C.bg}cc`,
                  padding: "1px 4px", borderRadius: 3,
                  backdropFilter: "blur(4px)",
                }}>
                  {i + 1}
                </div>

                {/* Status indicator */}
                {isComplete && (
                  <div style={{
                    position: "absolute", bottom: 3, right: 3,
                    width: 12, height: 12, borderRadius: 6,
                    background: `${C.green}22`, border: `1px solid ${C.green}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ color: C.green, display: "flex" }}>{I.check}</span>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ━━━ Previous Shot Context ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shows what continuity will reference — always visible when editing
function PreviousShotContext({ shot, continuityMode }) {
  if (!shot) return null;
  return (
    <div style={{
      border: `1px solid ${C.cardBorder}`, borderRadius: 10,
      background: C.cardBg, overflow: "hidden",
    }}>
      {/* Label */}
      <div style={{
        padding: "6px 10px", display: "flex", alignItems: "center", gap: 5,
        borderBottom: `1px solid ${C.cardBorder}`,
        background: `${C.bg}88`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint }}>Previous shot</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: C.textTertiary }}>Shot {shot.index}</span>
      </div>

      {/* Thumbnail */}
      <div style={{
        height: 90, background: `linear-gradient(135deg, ${shot.thumbnail})`,
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />

        {/* Continuity indicator overlay */}
        <div style={{
          position: "absolute", bottom: 6, left: 6, right: 6,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 600, color: continuityMode === "bridge" ? C.cyan : C.accent,
            background: `${C.bg}dd`, padding: "2px 6px", borderRadius: 4,
            display: "flex", alignItems: "center", gap: 3,
            backdropFilter: "blur(4px)",
          }}>
            {continuityMode === "bridge" ? I.bridge : I.paintbrush}
            {continuityMode === "bridge" ? "Last frame →" : "Style ref →"}
          </div>
        </div>
      </div>

      {/* Truncated prompt */}
      <div style={{ padding: "6px 10px" }}>
        <div style={{
          fontSize: 10, color: C.textTertiary, lineHeight: 1.5,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {shot.prompt}
        </div>
      </div>
    </div>
  );
}

// ━━━ Intent-Based Continuity Controls ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Replaces StyleReferenceControls — creative intent, not pipeline mechanics
function ContinuityIntentPicker({ mode, onChangeMode, strength, onChangeStrength }) {
  const options = [
    {
      id: "bridge",
      label: "Continue scene",
      desc: "Next shot starts where this one ended",
      icon: I.bridge,
      color: C.cyan,
    },
    {
      id: "style",
      label: "New angle, same look",
      desc: "Different framing, consistent colors & style",
      icon: I.paintbrush,
      color: C.accent,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, padding: "0 2px" }}>
        Continuity
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {options.map(opt => {
          const isActive = mode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChangeMode(opt.id)}
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 8,
                border: `1.5px solid ${isActive ? `${opt.color}55` : C.cardBorder}`,
                background: isActive ? `${opt.color}0a` : C.cardBg,
                cursor: "pointer", textAlign: "left",
                transition: "all 0.15s",
                outline: "none",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = C.cardBorderHover }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = isActive ? `${opt.color}55` : C.cardBorder }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ color: isActive ? opt.color : C.textTertiary, display: "flex" }}>{opt.icon}</span>
                <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 500, color: isActive ? C.textPrimary : C.textSecondary }}>{opt.label}</span>
              </div>
              <div style={{ fontSize: 9, color: C.textTertiary, lineHeight: 1.4, paddingLeft: 17 }}>{opt.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Strength slider — contextual label */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 2px 0" }}>
        <span style={{ fontSize: 10, color: C.textTertiary, whiteSpace: "nowrap" }}>
          {mode === "bridge" ? "Temporal match" : "Style fidelity"}
        </span>
        <div style={{ flex: 1, position: "relative", height: 4, background: C.cardBorder, borderRadius: 2 }}>
          <div style={{
            width: `${strength}%`, height: "100%", borderRadius: 2,
            background: mode === "bridge" ? C.cyan : C.accent,
            transition: "width 0.15s",
          }} />
          <input
            type="range" min="0" max="100" value={strength}
            onChange={e => onChangeStrength(Number(e.target.value))}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              opacity: 0, cursor: "pointer", margin: 0,
            }}
          />
        </div>
        <span style={{ fontSize: 10, color: C.textFaint, fontVariantNumeric: "tabular-nums", minWidth: 24, textAlign: "right" }}>{strength}%</span>
      </div>
    </div>
  );
}

// ━━━ Pipeline Status ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Surfaces backend work instead of just a spinner
function PipelineStatus({ status, mechanism, styleScore }) {
  if (!status || status === "idle") return null;

  const stages = {
    "extracting-frame": { label: "Extracting bridge frame…", color: C.cyan, progress: 15 },
    "generating-keyframe": { label: "Creating style-matched keyframe…", color: C.accent, progress: 35 },
    "generating-video": { label: "Generating video…", color: C.amber, progress: 65 },
    "quality-check": { label: "Checking quality gate…", color: C.green, progress: 85 },
    "complete": { label: mechanism === "frame-bridge" ? "Connected via frame bridge" : "Style-matched keyframe used", color: C.green, progress: 100 },
    "retrying": { label: "Style degraded — retrying…", color: C.red, progress: 50 },
  };

  const s = stages[status] || { label: status, color: C.textTertiary, progress: 50 };

  return (
    <div style={{
      padding: "8px 10px", borderRadius: 8,
      border: `1px solid ${s.color}22`,
      background: `${s.color}05`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        {status === "complete" ? (
          <span style={{ color: C.green, display: "flex" }}>{I.check}</span>
        ) : (
          <div style={{ width: 10, height: 10, border: `1.5px solid ${s.color}44`, borderTopColor: s.color, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        )}
        <span style={{ fontSize: 10, fontWeight: 600, color: s.color }}>{s.label}</span>
        {styleScore && status === "complete" && (
          <>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 9, color: C.textTertiary }}>Style: {styleScore}%</span>
          </>
        )}
      </div>
      <div style={{ height: 2, borderRadius: 1, background: `${C.cardBorder}`, overflow: "hidden" }}>
        <div style={{ width: `${s.progress}%`, height: "100%", borderRadius: 1, background: s.color, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}


// ━━━ MAIN LAYOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function SequenceWorkspaceMockup() {
  const [railPanel, setRailPanel] = useState("tool");
  const [activeShotIndex, setActiveShotIndex] = useState(2);
  const [continuityMode, setContinuityMode] = useState("bridge");
  const [continuityStrength, setContinuityStrength] = useState(75);
  const [promptText, setPromptText] = useState(
    "Close-up: her fingers trail through the wet sand as the wave recedes, golden light refracting through the water droplets, rack focus from hand to horizon"
  );
  const [pipelineStatus, setPipelineStatus] = useState("idle");
  const [selectedModel, setSelectedModel] = useState("sora-2");
  const textareaRef = useRef(null);

  // Simulated shot data
  const shots = [
    {
      index: 1, status: "complete",
      thumbnail: "#1a3a2a, #0a2a1a",
      prompt: "Wide establishing shot: pristine beach at golden hour, gentle waves rolling in, warm backlight silhouetting distant cliffs, cinematic letterboxing",
      continuityMode: null,
    },
    {
      index: 2, status: "complete",
      thumbnail: "#2a1a3a, #1a0a2a",
      prompt: "A woman in her 30s walks barefoot along the shoreline, lateral tracking shot, warm backlight catching spray from gentle waves, shallow depth of field, anamorphic lens flare",
      continuityMode: "bridge",
    },
    {
      index: 3, status: "idle",
      thumbnail: null,
      prompt: promptText,
      continuityMode: "bridge",
    },
    {
      index: 4, status: "idle",
      thumbnail: null,
      prompt: "",
      continuityMode: "style",
    },
  ];

  const currentShot = shots[activeShotIndex];
  const previousShot = activeShotIndex > 0 ? shots[activeShotIndex - 1] : null;

  const models = [
    { id: "sora-2", label: "Sora 2", credits: 80 },
    { id: "veo-3", label: "Veo 3", credits: 30 },
  ];
  const currentModel = models.find(m => m.id === selectedModel);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [promptText]);

  // Demo: cycle through pipeline states
  const handleGenerate = () => {
    const stages = ["extracting-frame", "generating-keyframe", "generating-video", "quality-check", "complete"];
    let i = 0;
    setPipelineStatus(stages[0]);
    const interval = setInterval(() => {
      i++;
      if (i >= stages.length) { clearInterval(interval); return; }
      setPipelineStatus(stages[i]);
    }, 1500);
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#080910", padding: 40, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: `0 0 80px ${C.accentGlow}, 0 0 0 1px ${C.railBorder}` }}>
        <div style={{ position: "absolute", top: -100, left: -50, width: 300, height: 300, background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ display: "flex", height: 820, position: "relative" }}>

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

          {/* ═══ SEQUENCE PANEL ═══ */}
          <div style={{ width: 440, background: C.panelBg, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Header bar — sequence mode indicator */}
            <div style={{ height: 48, borderBottom: `1px solid ${C.railBorder}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  padding: "3px 8px", borderRadius: 4,
                  background: `${C.accent}15`, border: `1px solid ${C.accent}33`,
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: C.accent, display: "flex", alignItems: "center", gap: 4,
                }}>
                  {I.link} Sequence
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>Beach scene</span>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: C.textTertiary }}>4 shots</span>
            </div>

            {/* ═══ SHOT VISUAL STRIP ═══ */}
            <ShotVisualStrip
              shots={shots}
              activeShotIndex={activeShotIndex}
              onSelectShot={setActiveShotIndex}
            />

            {/* ═══ SCROLLABLE CONTENT ═══ */}
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Previous shot context — what you're continuing from */}
              {previousShot && (
                <PreviousShotContext
                  shot={previousShot}
                  continuityMode={currentShot.continuityMode || continuityMode}
                />
              )}

              {/* Intent-based continuity controls */}
              {previousShot && (
                <ContinuityIntentPicker
                  mode={continuityMode}
                  onChangeMode={setContinuityMode}
                  strength={continuityStrength}
                  onChangeStrength={setContinuityStrength}
                />
              )}

              {/* ═══ CURRENT SHOT EDITOR ═══ */}
              <div
                style={{
                  border: `1px solid ${C.cardBorder}`, borderRadius: 12,
                  background: C.cardBg, overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.currentTarget.style.borderColor = C.cardBorderFocus}
                onBlur={e => e.currentTarget.style.borderColor = C.cardBorder}
              >
                {/* Shot label */}
                <div style={{
                  padding: "8px 12px", display: "flex", alignItems: "center",
                  borderBottom: `1px solid ${C.cardBorder}`,
                  background: `${C.bg}66`,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 5,
                    background: `${C.accent}22`, border: `1px solid ${C.accent}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: C.accent,
                  }}>
                    {activeShotIndex + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary, marginLeft: 8 }}>Shot {activeShotIndex + 1} prompt</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: C.textFaint, fontVariantNumeric: "tabular-nums" }}>{promptText.length} chars</span>
                </div>

                {/* Prompt editor */}
                <div style={{ padding: "10px 12px" }}>
                  <textarea
                    ref={textareaRef}
                    value={promptText}
                    onChange={e => setPromptText(e.target.value)}
                    placeholder="Describe this shot..."
                    style={{
                      width: "100%", minHeight: 88, resize: "none",
                      border: "none", background: "transparent",
                      color: C.textPrimary, fontSize: 13, lineHeight: 1.65,
                      fontFamily: "inherit", outline: "none", padding: 0,
                    }}
                  />
                </div>

                {/* Action bar */}
                <div style={{ height: 38, borderTop: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", padding: "0 8px", gap: 2 }}>
                  <IconBtn icon={I.copy} title="Copy" />
                  <IconBtn icon={I.trash} title="Delete shot" />
                  <div style={{ width: 1, height: 14, background: C.cardBorder, margin: "0 4px" }} />
                  <IconBtn icon={I.eye} title="Preview" />
                  <div style={{ flex: 1 }} />
                  <button
                    style={{
                      height: 26, padding: "0 10px", borderRadius: 6,
                      border: `1px solid ${C.accent}44`, background: `${C.accent}11`,
                      color: C.accent, fontSize: 11, fontWeight: 600,
                      fontFamily: "inherit", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${C.accent}22`; e.currentTarget.style.borderColor = `${C.accent}88` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${C.accent}11`; e.currentTarget.style.borderColor = `${C.accent}44` }}
                  >
                    {I.sparkle} AI Enhance
                  </button>
                </div>
              </div>

              {/* Pipeline status — surfaces backend work */}
              <PipelineStatus
                status={pipelineStatus}
                mechanism={continuityMode === "bridge" ? "frame-bridge" : "style-match"}
                styleScore={pipelineStatus === "complete" ? 84 : null}
              />
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
            <div style={{
              height: 64, borderTop: `1px solid ${C.railBorder}`,
              display: "flex", alignItems: "center", padding: "0 14px", gap: 10,
              background: `linear-gradient(180deg, ${C.panelBg} 0%, ${C.bg} 100%)`,
            }}>
              {/* Model selector */}
              <button style={{
                height: 36, padding: "0 12px", borderRadius: 8,
                border: `1px solid ${C.cardBorder}`, background: C.cardBg,
                color: C.textPrimary, fontSize: 12, fontWeight: 600,
                fontFamily: "inherit", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}>
                {currentModel?.label}{I.chevDown}
              </button>
              <span style={{ fontSize: 11, color: C.textTertiary, fontVariantNumeric: "tabular-nums" }}>· {currentModel?.credits} cr</span>
              <div style={{ flex: 1 }} />

              <button
                onClick={handleGenerate}
                style={{
                  height: 38, padding: "0 20px", borderRadius: 10,
                  border: "none",
                  background: `linear-gradient(135deg, ${C.accent}, #8B5CF6)`,
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  fontFamily: "inherit", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: `0 2px 12px ${C.accent}55, 0 0 0 1px ${C.accent}33`,
                  transition: "all 0.2s", letterSpacing: "0.02em",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px ${C.accent}77, 0 0 0 1px ${C.accent}55`; e.currentTarget.style.transform = "translateY(-1px)" }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 12px ${C.accent}55, 0 0 0 1px ${C.accent}33`; e.currentTarget.style.transform = "none" }}
              >
                {I.generate} Generate Shot 3
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ANNOTATIONS ═══ */}
      <div style={{ width: 300, marginLeft: 40, display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{ background: C.cardBg, border: `1px solid ${C.accent}44`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 10, letterSpacing: "0.04em" }}>PARADIGM SHIFT: SEQUENCE MODE</div>
          <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7 }}>
            When <code style={{ fontSize: 10, background: C.bg, padding: "1px 5px", borderRadius: 3, color: C.textPrimary }}>isSequenceMode</code> is true, the panel renders <strong style={{ color: C.textPrimary }}>SequenceWorkspace</strong> instead of the standard single-shot layout.
          </div>
          <div style={{ height: 6 }} />
          <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7 }}>
            Same rail. Same footer. Same generate button. <strong style={{ color: C.textPrimary }}>Different editing paradigm inside the panel.</strong>
          </div>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 10 }}>3 NEW COMPONENTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "ShotVisualStrip", desc: "Thumbnail chain with continuity connectors. Always shows what came before. Click to navigate.", color: C.cyan, lines: "~120" },
              { label: "ShotEditorWithContext", desc: "Previous shot frame + current prompt. You always see what you're continuing from.", color: C.accent, lines: "~150" },
              { label: "ContinuityIntentPicker", desc: "'Continue scene' vs 'New angle, same look'. Maps to frame-bridge / style-match under the hood.", color: C.green, lines: "~80" },
            ].map(item => (
              <div key={item.label} style={{ padding: "6px 8px", background: C.bg, borderRadius: 6, border: `1px solid ${C.cardBorder}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: item.color }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: item.color }}>{item.label}</div>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 9, color: C.textFaint }}>{item.lines} lines</span>
                </div>
                <div style={{ fontSize: 10, color: C.textTertiary, lineHeight: 1.5, paddingLeft: 11 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 10 }}>PIPELINE SURFACING</div>
          <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7, marginBottom: 8 }}>
            Click <strong style={{ color: C.textPrimary }}>Generate</strong> to see the pipeline stages animate. Backend work that was invisible is now visible:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              { stage: "Extracting bridge frame", color: C.cyan },
              { stage: "Creating style-matched keyframe", color: C.accent },
              { stage: "Generating video", color: C.amber },
              { stage: "Checking quality gate", color: C.green },
            ].map(s => (
              <div key={s.stage} style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 0" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
                <span style={{ fontSize: 10, color: C.textTertiary }}>{s.stage}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>LTX PATTERN ADAPTED</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, padding: "8px", background: C.bg, borderRadius: 8, border: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.textTertiary, marginBottom: 4 }}>LTX STUDIO</div>
              <div style={{ fontSize: 10, color: C.textFaint, lineHeight: 1.6 }}>
                Top-down script→shots<br/>
                Grid of all scenes<br/>
                Explicit character lib<br/>
                Their own model only
              </div>
            </div>
            <div style={{ flex: 1, padding: "8px", background: C.bg, borderRadius: 8, border: `1px solid ${C.accent}33` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.accent, marginBottom: 4 }}>PROMPTCANVAS</div>
              <div style={{ fontSize: 10, color: C.textTertiary, lineHeight: 1.6 }}>
                Bottom-up shot→chain<br/>
                Visual strip + context<br/>
                Automatic continuity<br/>
                Multi-model selection
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
