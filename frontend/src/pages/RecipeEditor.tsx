import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRecipes, createRecipe, updateRecipe } from "../api";

// --- Types ---
type Metric = "temp" | "pressure" | "flow";

interface ControlPoint {
  t: number;
  v: number;
}

interface RecipeEditorData {
  name: string;
  extractionTimeSec: number;
  targetVolumeMl: number;
  curves: Record<Metric, ControlPoint[]>;
}

interface PreinfusionState {
  wettingFlowMlS: number;
  wettingTimeSec: number;
  steepTimeSec: number;
}

// --- Helpers ---
const Y_MAX: Record<Metric, number> = {
  temp: 100,
  pressure: 12,
  flow: 10,
};

const Y_COLORS: Record<Metric, string> = {
  temp: "#f39c12",
  pressure: "#e94560",
  flow: "#2ecc71",
};

const GRAPH_WIDTH = 100; // % of container
const GRAPH_HEIGHT = 300; // px
const PADDING = 40;
const SVG_W = (GRAPH_WIDTH / 100) * 800; // assume container ~800px
const SVG_H = GRAPH_HEIGHT;
const PLOT_W = SVG_W - PADDING * 2;
const PLOT_H = SVG_H - PADDING * 2;

function timeToX(t: number, maxT: number): number {
  return PADDING + (t / maxT) * PLOT_W;
}

function valueToY(v: number, maxV: number): number {
  return SVG_H - PADDING - (v / maxV) * PLOT_H;
}

function xToTime(x: number, maxT: number): number {
  return Math.max(0, Math.min(maxT, ((x - PADDING) / PLOT_W) * maxT));
}

function yToValue(y: number, maxV: number): number {
  return Math.max(0, Math.min(maxV, ((SVG_H - PADDING - y) / PLOT_H) * maxV));
}

// Calculate integral of flow curve using trapezoidal rule
function calculateVolume(points: ControlPoint[]): number {
  if (points.length < 2) return 0;
  let volume = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const t1 = points[i].t;
    const t2 = points[i + 1].t;
    const v1 = points[i].v;
    const v2 = points[i + 1].v;
    const dt = t2 - t1;
    volume += ((v1 + v2) / 2) * dt; // trapezoid area
  }
  return volume;
}

// Scale flow curve to match target volume
function scaleFlowCurve(points: ControlPoint[], targetVolume: number): ControlPoint[] {
  const currentVolume = calculateVolume(points);
  if (currentVolume === 0) return points;
  const scale = targetVolume / currentVolume;
  return points.map((p) => ({ ...p, v: p.v * scale }));
}

// Linear interpolation for graph rendering
function interpolatePoints(points: ControlPoint[], step = 0.5): [number, number][] {
  if (points.length < 2) return [];
  const result: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    for (let t = p1.t; t <= p2.t; t += step) {
      const alpha = (t - p1.t) / (p2.t - p1.t);
      const v = p1.v + (p2.v - p1.v) * alpha;
      result.push([t, v]);
    }
  }
  return result;
}

// --- GraphEditor Component ---
interface GraphEditorProps {
  metric: Metric;
  points: ControlPoint[];
  extractionTimeSec: number;
  onChange: (points: ControlPoint[]) => void;
}

function GraphEditor({ metric, points, extractionTimeSec, onChange }: GraphEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const maxV = Y_MAX[metric];
  const color = Y_COLORS[metric];

  const getSvgPos = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const hitTest = (x: number, y: number) => {
    for (let i = 0; i < points.length; i++) {
      const px = timeToX(points[i].t, extractionTimeSec);
      const py = valueToY(points[i].v, maxV);
      if (Math.sqrt((x - px) ** 2 + (y - py) ** 2) < 20) return i;
    }
    return -1;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const { x, y } = getSvgPos(e);
    const hitIndex = hitTest(x, y);

    if (addMode) {
      const t = xToTime(x, extractionTimeSec);
      let v = yToValue(y, maxV);
      if (metric === "flow" && v < 0.5) v = 0;
      onChange([...points, { t, v }].sort((a, b) => a.t - b.t));
      setAddMode(false);
      return;
    }

    if (eraseMode) {
      if (hitIndex !== -1 && points.length > 2) {
        onChange(points.filter((_, i) => i !== hitIndex));
      }
      setEraseMode(false);
      return;
    }

    if (hitIndex !== -1) {
      setDraggingIndex(hitIndex);
      setSelectedIndex(hitIndex);
      dragStartPos.current = { x, y };
    } else {
      setSelectedIndex(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIndex === null || !svgRef.current) return;
    const { x, y } = getSvgPos(e);

    // スライドアウト削除判定（端点以外）
    const isOutside = x < PADDING - 20 || x > SVG_W - PADDING + 20 || y < -20 || y > SVG_H + 20;
    if (isOutside && draggingIndex !== 0 && draggingIndex !== points.length - 1) {
      setPendingDelete(draggingIndex);
      return;
    }
    setPendingDelete(null);

    const newPoints = [...points];
    if (draggingIndex === 0) {
      newPoints[0] = { t: 0, v: yToValue(y, maxV) };
    } else if (draggingIndex === points.length - 1) {
      newPoints[draggingIndex] = { t: extractionTimeSec, v: yToValue(y, maxV) };
    } else {
      let newV = yToValue(y, maxV);
      if (metric === "flow" && newV < 0.5) newV = 0;
      newPoints[draggingIndex] = { t: xToTime(x, extractionTimeSec), v: newV };
    }
    onChange(newPoints);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pendingDelete !== null) {
      onChange(points.filter((_, i) => i !== pendingDelete));
      setPendingDelete(null);
      setSelectedIndex(null);
    } else if (draggingIndex !== null && dragStartPos.current) {
      const { x, y } = getSvgPos(e);
      const moved = Math.sqrt((x - dragStartPos.current.x) ** 2 + (y - dragStartPos.current.y) ** 2);
      if (moved < 6) {
        // tap — keep selectedIndex for visual feedback
      } else {
        setSelectedIndex(null);
      }
    }
    dragStartPos.current = null;
    setDraggingIndex(null);
  };

  // Render curve
  const pathPoints: ControlPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segment = interpolatePoints([points[i], points[i + 1]], 0.5);
    pathPoints.push(...segment.map(([t, v]) => ({ t, v })));
  }
  if (points.length > 0) pathPoints.push(points[points.length - 1]);

  const pathD = pathPoints
    .map((p, i) => {
      const x = timeToX(p.t, extractionTimeSec);
      const y = valueToY(p.v, maxV);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color, fontSize: 13, fontWeight: 600 }}>
          {metric === "temp" ? "温度 ℃" : metric === "pressure" ? "気圧 bar" : "流量 ml/s"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            onClick={() => { setAddMode((v) => !v); setEraseMode(false); }}
            style={{
              padding: "4px 12px", fontSize: 13, borderRadius: "var(--radius)",
              border: `2px solid ${addMode ? "#2ecc71" : "#444"}`,
              background: addMode ? "rgba(46,204,113,0.2)" : "var(--surface)",
              color: addMode ? "#2ecc71" : "var(--text-muted)", cursor: "pointer",
            }}
          >＋ポイント</button>
          <button
            onClick={() => { setEraseMode((v) => !v); setAddMode(false); }}
            style={{
              padding: "4px 12px", fontSize: 13, borderRadius: "var(--radius)",
              border: `2px solid ${eraseMode ? "#e74c3c" : "#444"}`,
              background: eraseMode ? "rgba(231,76,60,0.2)" : "var(--surface)",
              color: eraseMode ? "#e74c3c" : "var(--text-muted)", cursor: "pointer",
            }}
          >消しゴム</button>
        </div>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={GRAPH_HEIGHT}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{
          background: "var(--surface)",
          border: `1px solid ${color}`,
          borderRadius: "var(--radius)",
          cursor: addMode ? "cell" : eraseMode ? "not-allowed" : "default",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Grid */}
        {Array.from({ length: 5 }, (_, i) => {
          const t = (extractionTimeSec / 4) * i;
          const x = timeToX(t, extractionTimeSec);
          return (
            <line
              key={`vgrid-${i}`}
              x1={x}
              y1={PADDING}
              x2={x}
              y2={SVG_H - PADDING}
              stroke="#333"
              strokeWidth="0.5"
            />
          );
        })}
        {Array.from({ length: 5 }, (_, i) => {
          const v = (maxV / 4) * i;
          const y = valueToY(v, maxV);
          return (
            <line
              key={`hgrid-${i}`}
              x1={PADDING}
              y1={y}
              x2={SVG_W - PADDING}
              y2={y}
              stroke="#333"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Axes */}
        <line x1={PADDING} y1={PADDING} x2={PADDING} y2={SVG_H - PADDING} stroke="#666" strokeWidth="1" />
        <line x1={PADDING} y1={SVG_H - PADDING} x2={SVG_W - PADDING} y2={SVG_H - PADDING} stroke="#666" strokeWidth="1" />

        {/* Curve */}
        <path d={pathD} stroke={color} strokeWidth="2" fill="none" />

        {/* Control points */}
        {points.map((p, i) => {
          const x = timeToX(p.t, extractionTimeSec);
          const y = valueToY(p.v, maxV);
          const isDeleting = i === pendingDelete;
          const isDragging = i === draggingIndex;
          const isSelected = i === selectedIndex;
          const r = isDragging ? 10 : isSelected ? 9 : 6;
          return (
            <g key={i}>
              {isSelected && !isDragging && (
                <circle cx={x} cy={y} r={14} fill={color} opacity={0.2} />
              )}
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={isDeleting ? "#e74c3c" : color}
                opacity={isDeleting ? 1 : isDragging ? 0.95 : isSelected ? 0.9 : 0.7}
                stroke={isSelected || isDragging ? "#fff" : "none"}
                strokeWidth={1.5}
                style={{ transition: "r 0.1s, fill 0.1s" }}
              />
            </g>
          );
        })}

        {/* Y-axis labels */}
        {Array.from({ length: 5 }, (_, i) => {
          const v = (maxV / 4) * i;
          const y = valueToY(v, maxV);
          return (
            <text key={`ylabel-${i}`} x={PADDING - 8} y={y + 3} fontSize="10" fill="var(--text-muted)" textAnchor="end">
              {v.toFixed(0)}
            </text>
          );
        })}

        {/* X-axis labels */}
        {Array.from({ length: 5 }, (_, i) => {
          const t = (extractionTimeSec / 4) * i;
          const x = timeToX(t, extractionTimeSec);
          return (
            <text key={`xlabel-${i}`} x={x} y={SVG_H - PADDING + 18} fontSize="10" fill="var(--text-muted)" textAnchor="middle">
              {t.toFixed(0)}s
            </text>
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
        ＋ポイント → タップ追加 | タップで選択 → ドラッグ | 消しゴム or スライドアウトで削除
      </div>
    </div>
  );
}

// --- Preinfusion Modal ---
interface PreinfusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (state: PreinfusionState) => void;
}

function PreinfusionModal({ isOpen, onClose, onApply }: PreinfusionModalProps) {
  const [state, setState] = useState<PreinfusionState>({
    wettingFlowMlS: 2,
    wettingTimeSec: 5,
    steepTimeSec: 10,
  });

  const handleApply = () => {
    onApply(state);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div className="card" style={{ width: "min(90vw, 400px)" }}>
        <h3 style={{ marginBottom: 16 }}>蒸らし設定</h3>

        <div className="form-group">
          <label>湿らし流量 (ml/s)</label>
          <input
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={state.wettingFlowMlS}
            onChange={(e) => setState({ ...state, wettingFlowMlS: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div className="form-group">
          <label>湿らし時間 (sec)</label>
          <input
            type="number"
            min="0"
            max="60"
            step="1"
            value={state.wettingTimeSec}
            onChange={(e) => setState({ ...state, wettingTimeSec: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div className="form-group">
          <label>蒸らし時間 (sec)</label>
          <input
            type="number"
            min="0"
            max="60"
            step="1"
            value={state.steepTimeSec}
            onChange={(e) => setState({ ...state, steepTimeSec: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleApply}>
            適用
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main RecipeEditor Component ---
export default function RecipeEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [recipe, setRecipe] = useState<RecipeEditorData | null>(null);
  const [name, setName] = useState("");
  const [extractionTimeSec, setExtractionTimeSec] = useState(30);
  const [targetVolumeMl, setTargetVolumeMl] = useState(40);
  const [currentMetric, setCurrentMetric] = useState<Metric>("temp");
  const [preinfusionModal, setPreinfusionModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize
  useEffect(() => {
    if (id) {
      setLoading(true);
      getRecipes()
        .then((recipes) => {
          const r = recipes.find((r) => r.id === Number(id));
          if (r) {
            try {
              const data = JSON.parse(r.json) as RecipeEditorData;
              setRecipe(data);
              setName(data.name);
              setExtractionTimeSec(data.extractionTimeSec);
              setTargetVolumeMl(data.targetVolumeMl);
            } catch {
              alert("レシピJSONが無効です");
              navigate("/recipes");
            }
          } else {
            alert("レシピが見つかりません");
            navigate("/recipes");
          }
        })
        .catch(() => {
          alert("読込に失敗しました");
          navigate("/recipes");
        })
        .finally(() => setLoading(false));
    } else {
      // New recipe
      const initialData: RecipeEditorData = {
        name: "新規レシピ",
        extractionTimeSec: 30,
        targetVolumeMl: 40,
        curves: {
          temp: [
            { t: 0, v: 90 },
            { t: 30, v: 90 },
          ],
          pressure: [
            { t: 0, v: 0 },
            { t: 5, v: 9 },
            { t: 30, v: 9 },
          ],
          flow: [
            { t: 0, v: 0 },
            { t: 30, v: 2 },
          ],
        },
      };
      setRecipe(initialData);
      setName(initialData.name);
      setExtractionTimeSec(initialData.extractionTimeSec);
      setTargetVolumeMl(initialData.targetVolumeMl);
    }
  }, [id, navigate]);

  if (!recipe || loading) return <div style={{ padding: 24 }}>読込中...</div>;

  const updateCurve = (metric: Metric, points: ControlPoint[]) => {
    const updated = { ...recipe, curves: { ...recipe.curves, [metric]: points } };

    // Auto-scale flow if we're editing it
    if (metric === "flow") {
      const scaledPoints = scaleFlowCurve(points, targetVolumeMl);
      updated.curves.flow = scaledPoints;
    }

    setRecipe(updated);
  };

  const handleAddPreinfusion = (state: PreinfusionState) => {
    const totalPreinfusionTime = state.wettingTimeSec + state.steepTimeSec;

    // Insert preinfusion segments at the start
    const offset = totalPreinfusionTime;

    // Shift existing points
    const shiftedTemp = recipe.curves.temp.map((p) => ({ ...p, t: p.t + offset }));
    const shiftedPressure = recipe.curves.pressure.map((p) => ({ ...p, t: p.t + offset }));
    const shiftedFlow = recipe.curves.flow.map((p) => ({ ...p, t: p.t + offset }));

    // Add preinfusion points
    const newTemp = [{ t: 0, v: recipe.curves.temp[0]?.v ?? 90 }, ...shiftedTemp];
    const newPressure = [
      { t: 0, v: 0 },
      { t: state.wettingTimeSec, v: 0 },
      { t: totalPreinfusionTime, v: recipe.curves.pressure[1]?.v ?? 9 },
      ...shiftedPressure.slice(1),
    ];
    const newFlow = [
      { t: 0, v: state.wettingFlowMlS },
      { t: state.wettingTimeSec, v: 0 },
      { t: totalPreinfusionTime, v: 0 },
      ...shiftedFlow.slice(1),
    ];

    const newExtractionTime = extractionTimeSec + offset;

    setRecipe({
      ...recipe,
      extractionTimeSec: newExtractionTime,
      curves: {
        temp: newTemp,
        pressure: newPressure,
        flow: newFlow,
      },
    });
    setExtractionTimeSec(newExtractionTime);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("レシピ名を入力してください");
      return;
    }

    const data: RecipeEditorData = {
      name: name.trim(),
      extractionTimeSec,
      targetVolumeMl,
      curves: recipe.curves,
    };

    setSaving(true);
    try {
      if (id) {
        await updateRecipe(Number(id), {
          name: data.name,
          profile_json: JSON.stringify(data),
        });
      } else {
        await createRecipe({
          name: data.name,
          json: JSON.stringify(data),
        });
      }
      navigate("/recipes");
    } catch {
      alert("保存に失敗しました");
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: 24 }}>{id ? "レシピ編集" : "新規レシピ作成"}</h1>

      {/* Recipe name & timing */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>基本設定</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div className="form-group">
            <label>レシピ名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>抽出時間 (sec)</label>
            <input
              type="number"
              min="10"
              max="120"
              value={extractionTimeSec}
              onChange={(e) => {
                const newTime = parseFloat(e.target.value) || 30;
                setExtractionTimeSec(newTime);
                // Update end points
                setRecipe({
                  ...recipe,
                  extractionTimeSec: newTime,
                  curves: {
                    temp: [...recipe.curves.temp.slice(0, -1), { ...recipe.curves.temp[recipe.curves.temp.length - 1], t: newTime }],
                    pressure: [...recipe.curves.pressure.slice(0, -1), { ...recipe.curves.pressure[recipe.curves.pressure.length - 1], t: newTime }],
                    flow: [...recipe.curves.flow.slice(0, -1), { ...recipe.curves.flow[recipe.curves.flow.length - 1], t: newTime }],
                  },
                });
              }}
            />
          </div>
          <div className="form-group">
            <label>目標抽出量 (ml)</label>
            <input
              type="number"
              min="10"
              max="100"
              step="1"
              value={targetVolumeMl}
              onChange={(e) => {
                const newTarget = parseFloat(e.target.value) || 40;
                setTargetVolumeMl(newTarget);
                // Auto-scale flow curve
                const scaled = scaleFlowCurve(recipe.curves.flow, newTarget);
                setRecipe({ ...recipe, targetVolumeMl: newTarget, curves: { ...recipe.curves, flow: scaled } });
              }}
            />
          </div>
        </div>
      </div>

      {/* Metric selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["temp", "pressure", "flow"] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setCurrentMetric(m)}
            style={{
              padding: "8px 16px",
              background: currentMetric === m ? Y_COLORS[m] : "var(--surface)",
              color: currentMetric === m ? "#fff" : "var(--text-muted)",
              border: `1px solid ${Y_COLORS[m]}`,
              borderRadius: "var(--radius)",
              cursor: "pointer",
              fontWeight: currentMetric === m ? 700 : 400,
            }}
          >
            {m === "temp" ? "温度" : m === "pressure" ? "気圧" : "流量"}
          </button>
        ))}
      </div>

      {/* Graph editors */}
      <div className="card" style={{ marginBottom: 20 }}>
        <GraphEditor
          metric={currentMetric}
          points={recipe.curves[currentMetric]}
          extractionTimeSec={extractionTimeSec}
          onChange={(points) => updateCurve(currentMetric, points)}
        />
      </div>

      {/* Preinfusion button */}
      <div className="card" style={{ marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={() => setPreinfusionModal(true)} style={{ width: "100%" }}>
          + 蒸らしを追加
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" onClick={() => navigate("/recipes")}>
          キャンセル
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      {/* Preinfusion modal */}
      <PreinfusionModal isOpen={preinfusionModal} onClose={() => setPreinfusionModal(false)} onApply={handleAddPreinfusion} />
    </div>
  );
}
