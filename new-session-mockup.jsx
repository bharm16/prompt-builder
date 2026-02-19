import { useState, useRef, useEffect } from "react";

const MODELS = [
  { id: "sora-2", label: "Sora 2", cost: 80 },
  { id: "veo-4", label: "Veo 4", cost: 30 },
  { id: "kling-2.1", label: "Kling 2.1", cost: 35 },
  { id: "luma-ray3", label: "Luma Ray 3", cost: 40 },
  { id: "wan-2.2", label: "Wan 2.2", cost: 5 },
];
const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const DURATIONS = [4, 5, 6, 8, 10];
const STORYBOARD_COST = 4;

/* ── Reusable mini-dropdown ── */
function MiniDropdown({ value, options, onChange, icon, formatLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = formatLabel ? formatLabel(value) : String(value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 30, borderRadius: 8, padding: "0 10px",
          fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
          color: "#555B6E", background: "none", border: "none",
          cursor: "pointer", transition: "color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#8B92A5";
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)";
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.color = "#555B6E";
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      >
        {icon}
        {label}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: -2, opacity: 0.5 }}>
          <path d="M2 3L4 5L6 3" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "100%", left: 0, marginBottom: 6,
          minWidth: 80, borderRadius: 10, overflow: "hidden", zIndex: 50,
          backgroundColor: "#1A1C22", boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
        }}>
          {options.map((opt) => {
            const optLabel = formatLabel ? formatLabel(opt) : String(opt);
            const isActive = opt === value;
            return (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  display: "flex", width: "100%", alignItems: "center",
                  padding: "7px 12px", fontSize: 11, fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#E2E6EF" : "#8B92A5",
                  backgroundColor: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "none", cursor: "pointer", textAlign: "left",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.color = "#E2E6EF";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#8B92A5";
                  }
                }}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Model selector (bottom bar) ── */
function ModelSelector({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const model = MODELS.find((m) => m.id === selected) || MODELS[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 32, borderRadius: 8, padding: "0 12px",
          fontSize: 12, backgroundColor: "rgba(255,255,255,0.04)",
          border: "none", cursor: "pointer", transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
      >
        <span style={{ color: "#555B6E", fontWeight: 400 }}>Model</span>
        <span style={{ color: "#C8CDD8", fontWeight: 600 }}>{model.label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#8B92A5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4L5 6L7 4" /></svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", bottom: "100%", left: 0, marginBottom: 8,
          minWidth: 180, borderRadius: 12, overflow: "hidden", zIndex: 50,
          backgroundColor: "#1A1C22", boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}>
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => { onChange(m.id); setOpen(false); }}
              style={{
                display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", fontSize: 12, fontWeight: 500,
                color: m.id === selected ? "#E2E6EF" : "#8B92A5",
                backgroundColor: m.id === selected ? "rgba(255,255,255,0.06)" : "transparent",
                border: "none", cursor: "pointer", transition: "all 0.1s",
              }}
              onMouseEnter={(e) => {
                if (m.id !== selected) {
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.color = "#E2E6EF";
                }
              }}
              onMouseLeave={(e) => {
                if (m.id !== selected) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#8B92A5";
                }
              }}
            >
              <span>{m.label}</span>
              <span style={{ fontSize: 10, color: "#555B6E" }}>{m.cost} cr</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Ghost button (non-dropdown controls) ── */
function BarBtn({ children, accent, onClick }) {
  const base = accent ? "#B3AFFD" : "#555B6E";
  const hover = accent ? "#C4BFFF" : "#8B92A5";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 30, borderRadius: 8, padding: "0 10px",
        fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
        color: base, background: "none", border: "none",
        cursor: "pointer", transition: "color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = hover;
        if (!accent) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = base;
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

/* ── Page ── */
export default function NewSessionPage() {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("sora-2");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(4);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  const model = MODELS.find((m) => m.id === selectedModel) || MODELS[0];
  const hasPrompt = prompt.trim().length > 0;
  const isWan = selectedModel === "wan-2.2";
  const creditCost = model.cost;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [prompt]);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#0D0E12", fontFamily: '"Normal", Inter, system-ui, sans-serif' }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ flex: 1.3 }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px" }}>
          {/* Video wordmark */}
          <div style={{ marginBottom: 32, display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="3" stroke="#555B6E" strokeWidth="1.5" />
              <path d="M10 9.5L15.5 12.5L10 15.5V9.5Z" fill="#555B6E" />
            </svg>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "#555B6E" }}>Video</span>
          </div>

          {/* Prompt container */}
          <div style={{ width: "100%", maxWidth: 640 }}>
            <div style={{
              borderRadius: 16, backgroundColor: "#15161B",
              boxShadow: isFocused
                ? "0 0 0 1px rgba(108,92,231,0.12), 0 8px 32px rgba(0,0,0,0.4)"
                : "0 4px 24px rgba(0,0,0,0.25)",
              transition: "box-shadow 0.2s",
            }}>
              {/* Textarea */}
              <div style={{ position: "relative", padding: "20px 20px 12px" }}>
                {!prompt && (
                  <div style={{ position: "absolute", left: 20, top: 20, color: "#4B5063", fontSize: 15, lineHeight: 1.7, pointerEvents: "none" }}>
                    Describe a video and click generate...
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && hasPrompt) e.preventDefault();
                  }}
                  rows={2}
                  style={{ width: "100%", resize: "none", backgroundColor: "transparent", outline: "none", color: "#E2E6EF", fontSize: 15, lineHeight: 1.7, caretColor: "#6C5CE7", border: "none", fontFamily: "inherit" }}
                />
              </div>

              {/* Settings row */}
              <div style={{ display: "flex", alignItems: "center", padding: "0 14px 12px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
                {/* Left controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, minWidth: 0 }}>
                  <BarBtn>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="2" width="11" height="10" rx="2" /><circle cx="5" cy="5.5" r="1.2" /><path d="M1.5 10l3-3.5 2.5 2.5 2-1.5 3.5 2.5" /></svg>
                    Start frame
                  </BarBtn>
                  <BarBtn>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 5.5V11a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V5.5" /><path d="M1 3.5a1 1 0 011-1h10a1 1 0 011 1v1a1 1 0 01-1 1H2a1 1 0 01-1-1v-1z" /></svg>
                    Assets
                  </BarBtn>

                  {/* Aspect ratio dropdown */}
                  <MiniDropdown
                    value={aspectRatio}
                    options={ASPECT_RATIOS}
                    onChange={setAspectRatio}
                    icon={<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2" width="9" height="7" rx="1.5" /></svg>}
                  />

                  {/* Duration dropdown */}
                  <MiniDropdown
                    value={duration}
                    options={DURATIONS}
                    onChange={setDuration}
                    formatLabel={(v) => `${v}s`}
                    icon={<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><circle cx="5.5" cy="5.5" r="4.5" /><path d="M5.5 3v3l2 1" /></svg>}
                  />

                  <BarBtn accent>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 2l-1 3.5L1 6.5l3.5 1L5.5 11l1-3.5L10 6.5 6.5 5.5z" /><path d="M10.5 1l-.5 1.5L8.5 3l1.5.5.5 1.5.5-1.5L13 3l-1.5-.5z" /></svg>
                    Enhance
                  </BarBtn>
                </div>

                {/* Right: Preview + Generate */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}>
                  <button
                    disabled={!hasPrompt}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      height: 34, borderRadius: 9, padding: "0 14px",
                      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                      border: "1px solid #22252C", backgroundColor: "transparent",
                      color: hasPrompt ? "#8B92A5" : "#3A3E4C",
                      cursor: hasPrompt ? "pointer" : "not-allowed",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!hasPrompt) return;
                      e.currentTarget.style.borderColor = "#3A3D46";
                      e.currentTarget.style.color = "#E2E6EF";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#22252C";
                      e.currentTarget.style.color = hasPrompt ? "#8B92A5" : "#3A3E4C";
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2.5" width="5" height="4" rx="0.8" /><rect x="7" y="2.5" width="5" height="4" rx="0.8" /><rect x="1" y="7.5" width="5" height="4" rx="0.8" /><rect x="7" y="7.5" width="5" height="4" rx="0.8" /></svg>
                    Preview · {STORYBOARD_COST} cr
                  </button>

                  <button
                    disabled={!hasPrompt}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      height: 34, borderRadius: 9, padding: "0 18px",
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap",
                      border: isWan ? "1px solid #E2E6EF" : "none",
                      backgroundColor: isWan ? "transparent" : "#E2E6EF",
                      color: isWan ? "#E2E6EF" : "#0D0E12",
                      opacity: hasPrompt ? 1 : 0.6,
                      cursor: hasPrompt ? "pointer" : "not-allowed",
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => { if (hasPrompt) e.currentTarget.style.opacity = "0.85"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = hasPrompt ? "1" : "0.6"; }}
                  >
                    {isWan ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1v3M6 8v3M9 3L7.5 5.5M4.5 6.5L3 9M3 3l1.5 2.5M7.5 6.5L9 9" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 2l-1 3.5L1 6.5l3.5 1L5.5 11l1-3.5L10 6.5 6.5 5.5z" /><path d="M10.5 1l-.5 1.5L8.5 3l1.5.5.5 1.5.5-1.5L13 3l-1.5-.5z" /></svg>
                    )}
                    {isWan ? `Draft · ${creditCost} cr` : `Generate · ${creditCost} cr`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 2 }} />
      </div>

      {/* Bottom bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 16px", flexShrink: 0 }}>
        <ModelSelector selected={selectedModel} onChange={setSelectedModel} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#34D399" }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: "#555B6E" }}>0 cr</span>
        </div>
      </div>
    </div>
  );
}
