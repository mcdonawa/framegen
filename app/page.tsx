"use client";

import { useState, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type CategoryKey = "video" | "image" | "audio" | "other";

interface Model {
  id: string;
  label: string;
  cost: string;
  desc: string;
}

interface CategoryDef {
  label: string;
  color: string;
  glyph: string;
  hasDuration?: boolean;
  hasAspectRatio?: boolean;
  hasNumImages?: boolean;
  models: Model[];
}

interface OutputResult {
  type: "video" | "image" | "audio" | "3d";
  url: string;
  urls?: string[];
}

interface HistoryItem {
  id: string;
  output: OutputResult;
  prompt: string;
  model: string;
  accent: string;
  category: CategoryKey;
}

// ─── Model Registry ─────────────────────────────────────────────────────────
// NOTE: Verify model IDs at fal.ai/models — they occasionally change slugs
const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  video: {
    label: "VIDEO",
    color: "#FF2D55",
    glyph: "▶",
    hasDuration: true,
    hasAspectRatio: true,
    models: [
      { id: "fal-ai/ltx-video", label: "LTX-2.3 Fast", cost: "$0.04/s", desc: "Open source · 1080p · Fastest generation" },
      { id: "fal-ai/minimax/hailuo-02/standard/text-to-video", label: "Hailuo-02 Standard", cost: "$0.045/s", desc: "Best budget quality · 768p" },
      { id: "fal-ai/minimax/hailuo-02/pro/text-to-video", label: "Hailuo-02 Pro", cost: "$0.08/s", desc: "Cinematic motion · 1080p" },
      { id: "fal-ai/kling-video/v1.6/standard/text-to-video", label: "Kling 2.5 Standard", cost: "$0.10/s", desc: "Excellent motion physics" },
      { id: "fal-ai/wan/v2.2/t2v-720p", label: "Wan 2.2 720p", cost: "$0.05/s", desc: "Open source · Cinematic MoE architecture" },
      { id: "fal-ai/runway-gen4-turbo/text-to-video", label: "Runway Gen-4 Turbo", cost: "$0.05/s", desc: "Runway quality at budget rate" },
      { id: "fal-ai/runway-gen4.5/text-to-video", label: "Runway Gen-4.5", cost: "$0.25/s", desc: "#1 ranked globally · Cinema grade" },
      { id: "fal-ai/veo3", label: "Veo 3.1 Fast", cost: "$0.15/s", desc: "Google · Spatial audio · 1080p" },
      { id: "fal-ai/veo3-4k", label: "Veo 3.1 — 4K", cost: "$0.40/s", desc: "Google · Native 4K · Spatial audio" },
    ],
  },
  image: {
    label: "IMAGE",
    color: "#0A84FF",
    glyph: "◼",
    hasAspectRatio: true,
    hasNumImages: true,
    models: [
      { id: "fal-ai/flux/schnell", label: "FLUX Schnell", cost: "$0.003/img", desc: "Fastest · Great for rapid iteration" },
      { id: "fal-ai/flux/dev", label: "FLUX Dev", cost: "$0.025/img", desc: "High quality · Open source" },
      { id: "fal-ai/flux-pro/v1.1", label: "FLUX 1.1 Pro", cost: "$0.04/img", desc: "Professional grade output" },
      { id: "fal-ai/recraft-v3", label: "Recraft V3", cost: "$0.04/img", desc: "Best for design & branding" },
      { id: "fal-ai/ideogram/v2", label: "Ideogram V2", cost: "$0.08/img", desc: "Best text rendering in images" },
      { id: "fal-ai/stable-diffusion-v35-large", label: "SD 3.5 Large", cost: "$0.065/img", desc: "Stable Diffusion flagship model" },
      { id: "fal-ai/aura-flow", label: "AuraFlow", cost: "$0.01/img", desc: "Fast open source · 1024px" },
    ],
  },
  audio: {
    label: "AUDIO",
    color: "#30D158",
    glyph: "♫",
    hasDuration: true,
    models: [
      { id: "fal-ai/stable-audio", label: "Stable Audio", cost: "$0.05/gen", desc: "Music & sound design" },
      { id: "fal-ai/mmaudio-v2", label: "MMAudio V2", cost: "$0.04/gen", desc: "High-quality audio generation" },
      { id: "fal-ai/elevenlabs/sound-effects", label: "ElevenLabs SFX", cost: "$0.03/gen", desc: "Realistic sound effects" },
    ],
  },
  other: {
    label: "3D & OTHER",
    color: "#FF9F0A",
    glyph: "◈",
    models: [
      { id: "fal-ai/trellis", label: "Trellis 3D", cost: "$0.10/gen", desc: "Image → 3D model (GLB/OBJ)" },
      { id: "fal-ai/hunyuan3d-v2", label: "Hunyuan3D V2", cost: "$0.08/gen", desc: "Text or image → 3D model" },
      { id: "fal-ai/stable-video-diffusion", label: "SVD", cost: "$0.06/gen", desc: "Classic image → video · Stable Diffusion" },
    ],
  },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Page() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("video");
  const [selectedModel, setSelectedModel] = useState<Model>(CATEGORIES.video.models[0]);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [numImages, setNumImages] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState<OutputResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cat = CATEGORIES[activeCategory];
  const accent = cat.color;

  const switchCategory = (key: CategoryKey) => {
    setActiveCategory(key);
    setSelectedModel(CATEGORIES[key].models[0]);
    setOutput(null);
    setError(null);
  };

  const estimateCost = () => {
    const rate = parseFloat(selectedModel.cost.replace(/[^0-9.]/g, ""));
    if (selectedModel.cost.includes("/s")) return `~$${(rate * duration).toFixed(3)}`;
    if (selectedModel.cost.includes("/img")) return `~$${(rate * numImages).toFixed(3)}`;
    return selectedModel.cost;
  };

  const generate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setOutput(null);
    setError(null);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      const input: Record<string, unknown> = { model: selectedModel.id, prompt };
      if (cat.hasDuration) input.duration = duration;
      if (cat.hasAspectRatio) input.aspect_ratio = aspectRatio;
      if (cat.hasNumImages && numImages > 1) input.num_images = numImages;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setOutput(data.output);
      setHistory((h) =>
        [
          {
            id: crypto.randomUUID(),
            output: data.output,
            prompt,
            model: selectedModel.label,
            accent,
            category: activeCategory,
          },
          ...h,
        ].slice(0, 30)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#08080B",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          justifyContent: "space-between",
          borderBottom: "1px solid #18181F",
          background: "#0A0A0E",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <polygon points="10,0 20,10 10,20 0,10" fill={accent} />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              letterSpacing: "0.1em",
              color: "#FFFFFF",
            }}
          >
            FRAMEGEN
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, alignItems: "center" }}>
          <span style={{ color: "#3A3A44" }}>
            {selectedModel.label}
          </span>
          <span
            style={{
              color: accent,
              fontFamily: "var(--font-display)",
              fontSize: 13,
              letterSpacing: "0.05em",
            }}
          >
            {estimateCost()}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Sidebar ── */}
        <aside
          style={{
            width: 230,
            display: "flex",
            flexDirection: "column",
            background: "#09090D",
            borderRight: "1px solid #18181F",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {/* Category Tabs */}
          <div
            style={{
              padding: "10px 8px",
              borderBottom: "1px solid #18181F",
              flexShrink: 0,
            }}
          >
            {(Object.entries(CATEGORIES) as [CategoryKey, CategoryDef][]).map(([key, c]) => (
              <button
                key={key}
                onClick={() => switchCategory(key)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  marginBottom: 2,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  letterSpacing: "0.07em",
                  transition: "all 0.15s",
                  background: activeCategory === key ? `${c.color}1A` : "transparent",
                  color: activeCategory === key ? c.color : "#4A4A55",
                  borderLeft: `3px solid ${activeCategory === key ? c.color : "transparent"}`,
                }}
              >
                <span style={{ fontSize: 15 }}>{c.glyph}</span>
                {c.label}
              </button>
            ))}
          </div>

          {/* Model List */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px",
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.15em",
                color: "#2E2E38",
                padding: "4px 6px 8px",
                fontFamily: "var(--font-display)",
              }}
            >
              MODELS
            </div>
            {CATEGORIES[activeCategory].models.map((model) => {
              const isActive = selectedModel.label === model.label;
              return (
                <button
                  key={model.id + model.label}
                  onClick={() => setSelectedModel(model)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    marginBottom: 3,
                    borderRadius: 6,
                    border: `1px solid ${isActive ? `${accent}35` : "transparent"}`,
                    cursor: "pointer",
                    textAlign: "left",
                    background: isActive ? `${accent}0F` : "transparent",
                    transition: "all 0.12s",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isActive ? accent : "#C0C0CC",
                      marginBottom: 2,
                      fontFamily: "var(--font-body), sans-serif",
                    }}
                  >
                    {model.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#44444E", lineHeight: 1.4 }}>
                    {model.desc}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: isActive ? accent : "#34343E",
                      marginTop: 4,
                      fontWeight: 700,
                      fontFamily: "var(--font-display)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {model.cost}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Main Panel ── */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Prompt + Controls */}
          <div
            style={{
              padding: "18px 24px 16px",
              borderBottom: "1px solid #18181F",
              flexShrink: 0,
              background: "#0A0A0E",
            }}
          >
            {/* Prompt */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) generate();
              }}
              placeholder={
                activeCategory === "video"
                  ? "Describe your scene — camera movements, lighting, action..."
                  : activeCategory === "image"
                  ? "Describe the image you want to generate..."
                  : activeCategory === "audio"
                  ? "Describe the audio, music style, or sound effect..."
                  : "Describe the 3D object or scene..."
              }
              rows={3}
              style={{
                width: "100%",
                background: "#111116",
                border: `1px solid ${prompt.trim() ? `${accent}28` : "#1C1C24"}`,
                borderRadius: 10,
                padding: "13px 15px",
                color: "#F2F2F7",
                fontSize: 14,
                lineHeight: 1.65,
                fontFamily: "var(--font-body), sans-serif",
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = `${accent}50`)}
              onBlur={(e) => (e.target.style.borderColor = prompt.trim() ? `${accent}28` : "#1C1C24")}
            />

            {/* Params + Generate */}
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {/* Duration */}
              {cat.hasDuration && (
                <ParamGroup label="DURATION" accent={accent}>
                  {[3, 5, 7, 10].map((d) => (
                    <PillButton
                      key={d}
                      active={duration === d}
                      accent={accent}
                      onClick={() => setDuration(d)}
                    >
                      {d}s
                    </PillButton>
                  ))}
                </ParamGroup>
              )}

              {/* Aspect Ratio */}
              {cat.hasAspectRatio && (
                <ParamGroup label="RATIO" accent={accent}>
                  {["16:9", "9:16", "1:1"].map((r) => (
                    <PillButton
                      key={r}
                      active={aspectRatio === r}
                      accent={accent}
                      onClick={() => setAspectRatio(r)}
                    >
                      {r}
                    </PillButton>
                  ))}
                </ParamGroup>
              )}

              {/* Num Images */}
              {cat.hasNumImages && (
                <ParamGroup label="COUNT" accent={accent}>
                  {[1, 2, 4].map((n) => (
                    <PillButton
                      key={n}
                      active={numImages === n}
                      accent={accent}
                      onClick={() => setNumImages(n)}
                    >
                      {n}
                    </PillButton>
                  ))}
                </ParamGroup>
              )}

              <div style={{ flex: 1 }} />

              {/* Generate Button */}
              <button
                onClick={generate}
                disabled={isGenerating || !prompt.trim()}
                style={{
                  padding: "11px 30px",
                  borderRadius: 8,
                  border: "none",
                  cursor: isGenerating || !prompt.trim() ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)",
                  fontSize: 15,
                  letterSpacing: "0.1em",
                  background: isGenerating || !prompt.trim() ? "#1C1C24" : accent,
                  color: isGenerating || !prompt.trim() ? "#3A3A44" : "#000000",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isGenerating ? (
                  <>GENERATING — {elapsed}s</>
                ) : (
                  <>GENERATE {cat.label}</>
                )}
                {isGenerating && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      height: 2,
                      width: "40%",
                      background: accent,
                      animation: "slide 1.8s ease-in-out infinite",
                    }}
                  />
                )}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  marginTop: 10,
                  padding: "9px 13px",
                  background: "#150505",
                  border: "1px solid #FF2D5530",
                  borderRadius: 7,
                  color: "#FF6B82",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                ⚠ {error}
              </div>
            )}
          </div>

          {/* ── Output Area ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div
              style={{
                flex: 1,
                padding: "20px 24px",
                overflowY: "auto",
                display: "flex",
                alignItems: output ? "flex-start" : "center",
                justifyContent: "center",
              }}
            >
              {output ? (
                <OutputDisplay output={output} accent={accent} />
              ) : (
                <EmptyState isGenerating={isGenerating} accent={accent} cat={cat} />
              )}
            </div>

            {/* ── History Strip ── */}
            {history.length > 0 && (
              <div
                style={{
                  height: 82,
                  borderTop: "1px solid #18181F",
                  background: "#0A0A0E",
                  padding: "10px 24px",
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: "#2E2E38",
                    letterSpacing: "0.15em",
                    fontFamily: "var(--font-display)",
                    flexShrink: 0,
                    marginRight: 4,
                  }}
                >
                  HISTORY
                </span>
                {history.map((item) => (
                  <HistoryThumb
                    key={item.id}
                    item={item}
                    onClick={() => setOutput(item.output)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2A35; border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────────────────

function ParamGroup({
  label,
  accent,
  children,
}: {
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          color: accent,
          fontFamily: "var(--font-display)",
          opacity: 0.7,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 3 }}>{children}</div>
    </div>
  );
}

function PillButton({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 11px",
        borderRadius: 5,
        border: "none",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: active ? 700 : 400,
        fontFamily: "var(--font-body), sans-serif",
        background: active ? accent : "#18181F",
        color: active ? "#000" : "#4A4A55",
        transition: "all 0.1s",
      }}
    >
      {children}
    </button>
  );
}

function OutputDisplay({ output, accent }: { output: OutputResult; accent: string }) {
  if (output.type === "video") {
    return (
      <div style={{ width: "100%", maxWidth: 900 }}>
        <video
          src={output.url}
          controls
          autoPlay
          loop
          style={{
            width: "100%",
            borderRadius: 10,
            display: "block",
            border: `1px solid ${accent}25`,
            background: "#000",
          }}
        />
        <DownloadRow url={output.url} label="video.mp4" accent={accent} />
      </div>
    );
  }

  if (output.type === "image") {
    const urls = output.urls || [output.url];
    return (
      <div style={{ width: "100%", maxWidth: 900 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: urls.length > 1 ? "1fr 1fr" : "1fr",
            gap: 10,
          }}
        >
          {urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`Generated image ${i + 1}`}
              style={{
                width: "100%",
                borderRadius: 10,
                display: "block",
                border: `1px solid ${accent}25`,
              }}
            />
          ))}
        </div>
        <DownloadRow url={output.url} label="image.png" accent={accent} />
      </div>
    );
  }

  if (output.type === "audio") {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          background: "#111116",
          borderRadius: 14,
          padding: "32px 28px",
          border: `1px solid ${accent}20`,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            letterSpacing: "0.1em",
            color: accent,
            marginBottom: 20,
          }}
        >
          ♫ AUDIO READY
        </div>
        {/* Decorative waveform bars */}
        <div
          style={{
            display: "flex",
            gap: 3,
            alignItems: "center",
            height: 40,
            marginBottom: 20,
          }}
        >
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${20 + Math.sin(i * 0.8) * 15 + Math.random() * 10}px`,
                background: accent,
                borderRadius: 2,
                opacity: 0.5 + Math.random() * 0.5,
              }}
            />
          ))}
        </div>
        <audio
          src={output.url}
          controls
          style={{ width: "100%", accentColor: accent }}
        />
        <DownloadRow url={output.url} label="audio.wav" accent={accent} />
      </div>
    );
  }

  // 3D
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 500,
        background: "#111116",
        borderRadius: 14,
        padding: "40px 28px",
        border: `1px solid ${accent}20`,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>◈</div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          letterSpacing: "0.1em",
          color: accent,
          marginBottom: 8,
        }}
      >
        3D MODEL READY
      </div>
      <div style={{ fontSize: 12, color: "#44444E", marginBottom: 24 }}>
        Open in Blender, Cinema 4D, or any 3D viewer
      </div>
      <DownloadRow url={output.url} label="model.glb" accent={accent} />
    </div>
  );
}

function DownloadRow({ url, label, accent }: { url: string; label: string; accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
      }}
    >
      <a
        href={url}
        download={label}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: "7px 16px",
          borderRadius: 6,
          background: accent,
          color: "#000",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textDecoration: "none",
          fontFamily: "var(--font-display)",
        }}
      >
        ↓ DOWNLOAD
      </a>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 10,
          color: "#3A3A44",
          textDecoration: "none",
          letterSpacing: "0.05em",
          fontFamily: "var(--font-display)",
        }}
      >
        OPEN IN NEW TAB ↗
      </a>
    </div>
  );
}

function EmptyState({
  isGenerating,
  accent,
  cat,
}: {
  isGenerating: boolean;
  accent: string;
  cat: CategoryDef;
}) {
  if (isGenerating) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: `2px solid #1C1C24`,
            borderTopColor: accent,
            margin: "0 auto 20px",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            letterSpacing: "0.1em",
            color: accent,
            marginBottom: 8,
          }}
        >
          GENERATING {cat.label}
        </div>
        <div style={{ fontSize: 12, color: "#3A3A44" }}>
          This usually takes 1–4 minutes
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", userSelect: "none" }}>
      <div
        style={{
          fontSize: 72,
          color: accent,
          opacity: 0.08,
          fontFamily: "var(--font-display)",
          letterSpacing: "0.05em",
          lineHeight: 1,
          marginBottom: 20,
        }}
      >
        {cat.glyph}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          letterSpacing: "0.12em",
          color: "#2A2A32",
        }}
      >
        OUTPUT WILL APPEAR HERE
      </div>
      <div style={{ fontSize: 11, color: "#22222A", marginTop: 6 }}>
        ⌘ + Enter to generate
      </div>
    </div>
  );
}

function HistoryThumb({ item, onClick }: { item: HistoryItem; onClick: () => void }) {
  const isVideo = item.output.type === "video";
  const isImage = item.output.type === "image";

  return (
    <div
      onClick={onClick}
      title={item.prompt}
      style={{
        width: 90,
        height: 56,
        borderRadius: 6,
        overflow: "hidden",
        flexShrink: 0,
        cursor: "pointer",
        border: `1px solid ${item.accent}30`,
        background: "#111116",
        position: "relative",
        transition: "border-color 0.15s, transform 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = item.accent;
        e.currentTarget.style.transform = "scale(1.04)";
        const v = e.currentTarget.querySelector("video");
        if (v) v.play();
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${item.accent}30`;
        e.currentTarget.style.transform = "scale(1)";
        const v = e.currentTarget.querySelector("video");
        if (v) v.pause();
      }}
    >
      {isVideo && (
        <video
          src={item.output.url}
          muted
          loop
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.output.url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {!isVideo && !isImage && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            fontSize: 20,
            color: item.accent,
            opacity: 0.5,
          }}
        >
          {CATEGORIES[item.category].glyph}
        </div>
      )}
    </div>
  );
}
