import { useEffect, useState } from "react";
import { getRecipes, toggleFavorite, toggleArchive, customizeRecipe, updateRecipe, deleteRecipe, getRecipeUsage, importRecipe, type Recipe } from "../api";

// ---------------------------------------------------------------------------
// Profile types (GaggiMate JSON structure)
// ---------------------------------------------------------------------------

interface PhasePump {
  pressure: number | null;
  flow: number | null;
}

interface Phase {
  name: string;
  phase: string;
  valve?: number;
  duration: number;
  pump: PhasePump;
  transition?: { type: string; duration: number };
  targets?: Record<string, number>;
}

interface ProfileJSON {
  id?: string;
  label?: string;
  type?: string;
  temperature: number;
  description?: string;
  is_favorite?: boolean;
  version?: number;
  stop_on_weight?: number;
  dose_g?: number;
  yield_g?: number;
  phases: Phase[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseProfileJSON(jsonStr: string): ProfileJSON | null {
  try {
    const data = JSON.parse(jsonStr);
    if (typeof data === "object" && data !== null && Array.isArray(data.phases)) {
      return data as ProfileJSON;
    }
  } catch { /* ignore */ }
  return null;
}

const PHASE_COLORS: Record<string, string> = {
  preinfusion: "#3498db",
  brew: "#e94560",
  decline: "#f39c12",
  idle: "#555",
};

// ---------------------------------------------------------------------------
// SliderRow component
// ---------------------------------------------------------------------------

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  color?: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, unit, color = "#e94560", onChange }: SliderRowProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color }}>{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%",
          height: 40,
          accentColor: color,
          cursor: "pointer",
          WebkitAppearance: "none",
          appearance: "none",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginTop: 2 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfileVisualEditor component
// ---------------------------------------------------------------------------

interface ProfileVisualEditorProps {
  profile: ProfileJSON;
  onChange: (p: ProfileJSON) => void;
}

function ProfileVisualEditor({ profile, onChange }: ProfileVisualEditorProps) {
  const update = (patch: Partial<ProfileJSON>) => onChange({ ...profile, ...patch });

  const updatePhase = (idx: number, patch: Partial<Phase>) => {
    const phases = profile.phases.map((ph, i) => i === idx ? { ...ph, ...patch } : ph);
    onChange({ ...profile, phases });
  };

  const updatePump = (idx: number, patch: Partial<PhasePump>) => {
    const phases = profile.phases.map((ph, i) =>
      i === idx ? { ...ph, pump: { ...ph.pump, ...patch } } : ph
    );
    onChange({ ...profile, phases });
  };

  const addPhase = () => {
    const newPhase: Phase = {
      name: "New Phase",
      phase: "brew",
      valve: 1,
      duration: 10,
      pump: { pressure: 9.0, flow: null },
      transition: { type: "ramp", duration: 2 },
      targets: {},
    };
    onChange({ ...profile, phases: [...profile.phases, newPhase] });
  };

  const removePhase = (idx: number) => {
    if (profile.phases.length <= 1) return;
    onChange({ ...profile, phases: profile.phases.filter((_, i) => i !== idx) });
  };

  // Pressure bar chart preview
  const maxDuration = profile.phases.reduce((s, p) => s + p.duration, 0) || 1;

  return (
    <div>
      {/* Temperature */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12, color: "#f39c12" }}>ボイラー温度</h4>
        <SliderRow
          label="抽出温度"
          value={profile.temperature}
          min={85}
          max={100}
          step={0.5}
          unit="°C"
          color="#f39c12"
          onChange={(v) => update({ temperature: v })}
        />
      </div>

      {/* Weight control */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12, color: "#2ecc71" }}>重量制御</h4>

        {/* dose_g / yield_g inputs */}
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>ドーズ量 (g)</label>
            <input
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={profile.dose_g ?? 0}
              onChange={(e) => {
                const dose = parseFloat(e.target.value) || 0;
                update({ dose_g: dose });
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid #444",
                borderRadius: "var(--radius)",
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {[16, 18, 25].map((g) => (
                <button
                  key={g}
                  onClick={() => update({ dose_g: g })}
                  style={{
                    flex: 1,
                    padding: "3px 0",
                    fontSize: 12,
                    borderRadius: "var(--radius)",
                    border: `1px solid ${profile.dose_g === g ? "#2ecc71" : "#444"}`,
                    background: profile.dose_g === g ? "rgba(46,204,113,0.15)" : "var(--surface)",
                    color: profile.dose_g === g ? "#2ecc71" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {g}g
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>目標抽出量 (g)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={profile.yield_g ?? 0}
              onChange={(e) => {
                const yld = parseFloat(e.target.value) || 0;
                update({ yield_g: yld, stop_on_weight: yld });
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid #444",
                borderRadius: "var(--radius)",
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>抽出比率</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#2ecc71" }}>
              {profile.dose_g && profile.dose_g > 0
                ? `${((profile.yield_g ?? 0) / profile.dose_g).toFixed(1)}:1`
                : "--"}
            </span>
          </div>
        </div>

        {/* stop_on_weight slider */}
        <SliderRow
          label="重量自動停止 (0で無効)"
          value={profile.stop_on_weight ?? 0}
          min={0}
          max={100}
          step={1}
          unit="g"
          color="#2ecc71"
          onChange={(v) => update({ stop_on_weight: v })}
        />
        {(profile.stop_on_weight ?? 0) === 0 && (
          <p style={{ fontSize: 11, color: "#666", marginTop: -8, marginBottom: 8 }}>
            stop_on_weight = 0 で自動停止無効
          </p>
        )}
      </div>

      {/* Pressure curve preview */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>圧力カーブ プレビュー</h4>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, background: "#0d1117", padding: "8px 4px", borderRadius: 6 }}>
          {profile.phases.map((ph, i) => {
            const widthPct = (ph.duration / maxDuration) * 100;
            const pressure = ph.pump.pressure ?? 0;
            const heightPct = (pressure / 12) * 100;
            const color = PHASE_COLORS[ph.phase] ?? "#888";
            return (
              <div
                key={i}
                style={{
                  flex: `0 0 ${widthPct}%`,
                  height: `${heightPct}%`,
                  background: color,
                  borderRadius: "3px 3px 0 0",
                  opacity: 0.85,
                  position: "relative",
                  minHeight: 4,
                }}
                title={`${ph.name}: ${pressure}bar × ${ph.duration}s`}
              >
                <span style={{ position: "absolute", top: -18, left: 0, fontSize: 10, color, whiteSpace: "nowrap" }}>
                  {pressure?.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(PHASE_COLORS).filter(([k]) => k !== "idle").map(([phase, color]) => (
            <span key={phase} style={{ fontSize: 11, color, display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: "inline-block" }} />
              {phase}
            </span>
          ))}
        </div>
      </div>

      {/* Phases */}
      {profile.phases.map((ph, idx) => {
        const color = PHASE_COLORS[ph.phase] ?? "#888";
        return (
          <div key={idx} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                <span style={{ fontSize: 12, padding: "2px 8px", background: color, borderRadius: 10, color: "#fff", fontWeight: 600 }}>{ph.phase}</span>
                <input
                  value={ph.name}
                  onChange={(e) => updatePhase(idx, { name: e.target.value })}
                  style={{ background: "transparent", border: "none", borderBottom: "1px solid #444", color: "var(--text)", fontSize: 14, fontWeight: 600, flex: 1, outline: "none" }}
                />
              </div>
              <select
                value={ph.phase}
                onChange={(e) => updatePhase(idx, { phase: e.target.value })}
                style={{ padding: "4px 8px", background: "var(--surface)", color: "var(--text)", border: "1px solid #444", borderRadius: 6, fontSize: 12, marginLeft: 8 }}
              >
                <option value="preinfusion">preinfusion</option>
                <option value="brew">brew</option>
                <option value="decline">decline</option>
              </select>
              {profile.phases.length > 1 && (
                <button
                  onClick={() => removePhase(idx)}
                  style={{ marginLeft: 8, background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer", padding: "0 4px" }}
                  title="フェーズを削除"
                >×</button>
              )}
            </div>

            <SliderRow
              label="圧力"
              value={ph.pump.pressure ?? 0}
              min={0}
              max={12}
              step={0.5}
              unit="bar"
              color="#e94560"
              onChange={(v) => updatePump(idx, { pressure: v })}
            />

            <SliderRow
              label="時間"
              value={ph.duration}
              min={1}
              max={60}
              step={1}
              unit="s"
              color="#3498db"
              onChange={(v) => updatePhase(idx, { duration: v })}
            />

            <SliderRow
              label="フロー（nullで圧力優先）"
              value={ph.pump.flow ?? 0}
              min={0}
              max={6}
              step={0.1}
              unit="ml/s"
              color="#2ecc71"
              onChange={(v) => updatePump(idx, { flow: v === 0 ? null : v })}
            />
            {ph.pump.flow === null && (
              <p style={{ fontSize: 11, color: "#666", marginTop: -8, marginBottom: 8 }}>フロー = 0 で圧力制御モード（flow: null）</p>
            )}
          </div>
        );
      })}

      <button
        onClick={addPhase}
        className="btn btn-secondary"
        style={{ width: "100%", marginTop: 4 }}
      >
        + フェーズを追加
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditState & EditModal
// ---------------------------------------------------------------------------

interface EditState {
  id: number;
  name: string;
  profile_json: string;
}

interface EditModalProps {
  editState: EditState;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (state: EditState) => void;
}

function EditModal({ editState, saving, onClose, onSave, onChange }: EditModalProps) {
  const [tab, setTab] = useState<"visual" | "json">("visual");
  const profile = parseProfileJSON(editState.profile_json);

  const handleProfileChange = (p: ProfileJSON) => {
    onChange({ ...editState, profile_json: JSON.stringify(p, null, 2) });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "16px 0" }}>
      <div className="card" style={{ width: "min(95vw, 600px)", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3>レシピ編集</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#999", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Recipe name */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>レシピ名</label>
          <input value={editState.name} onChange={(e) => onChange({ ...editState, name: e.target.value })} />
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "1px solid #444", borderRadius: 8, overflow: "hidden" }}>
          {(["visual", "json"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "10px 0",
                background: tab === t ? "var(--accent)" : "transparent",
                color: tab === t ? "#fff" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                fontWeight: tab === t ? 700 : 400,
                fontSize: 14,
              }}
            >
              {t === "visual" ? "ビジュアル編集" : "JSON直接編集"}
            </button>
          ))}
        </div>

        {tab === "visual" ? (
          profile ? (
            <ProfileVisualEditor profile={profile} onChange={handleProfileChange} />
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              JSONを解析できませんでした。「JSON直接編集」タブで修正してください。
            </div>
          )
        ) : (
          <div className="form-group">
            <label>プロファイル JSON</label>
            <textarea
              value={editState.profile_json}
              onChange={(e) => onChange({ ...editState, profile_json: e.target.value })}
              style={{ minHeight: 300, fontFamily: "monospace", fontSize: 12 }}
            />
          </div>
        )}

        <div className="flex gap-8" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { key: "active", label: "すべて" },
  { key: "original", label: "オリジナル" },
  { key: "community", label: "コミュニティ" },
  { key: "archived", label: "アーカイブ" },
] as const;
type TabKey = typeof TABS[number]["key"];

function tabToParams(tab: TabKey): { status: string; community?: boolean } {
  switch (tab) {
    case "active":    return { status: "active" };
    case "original":  return { status: "active", community: false };
    case "community": return { status: "active", community: true };
    case "archived":  return { status: "archived" };
  }
}

// ---------------------------------------------------------------------------
// RecipesPage
// ---------------------------------------------------------------------------

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sort, setSort] = useState("created_at");
  const [favOnly, setFavOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [customizeText, setCustomizeText] = useState("");
  const [baseRecipeId, setBaseRecipeId] = useState<number | "">("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [archiveModal, setArchiveModal] = useState<{ id: number; name: string; shotCount: number } | null>(null);

  const load = () => {
    const { status, community } = tabToParams(activeTab);
    return getRecipes(sort, favOnly, status, community).then(setRecipes).catch(() => {});
  };

  useEffect(() => { load(); }, [sort, favOnly, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFav = async (id: number) => {
    await toggleFavorite(id);
    load();
  };

  const handleCustomize = async () => {
    if (!customizeText.trim()) return;
    setLoading(true);
    setSuggestion(null);
    try {
      const res = await customizeRecipe(customizeText, baseRecipeId || undefined);
      setSuggestion(res.suggestion);
    } catch {
      setSuggestion("LLM接続エラー");
    }
    setLoading(false);
  };

  const handleSaveSuggestion = async () => {
    if (!suggestion) return;
    setSaving(true);
    try {
      const name = `LLM提案 ${new Date().toLocaleDateString("ja-JP")}`;
      await importRecipe({ name, recipe_json: { suggestion, generated_at: new Date().toISOString() } });
      setSuggestion(null);
      setCustomizeText("");
      load();
      alert("レシピを保存しました");
    } catch {
      alert("保存に失敗しました");
    }
    setSaving(false);
  };

  const handleEdit = (r: Recipe) => {
    setEditState({ id: r.id, name: r.name, profile_json: r.json });
  };

  const handleEditSave = async () => {
    if (!editState) return;
    setSaving(true);
    try {
      await updateRecipe(editState.id, { name: editState.name, profile_json: editState.profile_json });
      setEditState(null);
      load();
    } catch {
      alert("更新に失敗しました");
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      const usage = await getRecipeUsage(id);
      if (usage.shot_count === 0) {
        if (!confirm(`「${name}」を削除しますか？`)) return;
        await deleteRecipe(id, false);
        load();
      } else {
        setArchiveModal({ id, name, shotCount: usage.shot_count });
      }
    } catch {
      alert("削除に失敗しました");
    }
  };

  const handleArchive = async () => {
    if (!archiveModal) return;
    try {
      await deleteRecipe(archiveModal.id, true);
      setArchiveModal(null);
      load();
    } catch {
      alert("アーカイブに失敗しました");
    }
  };

  const handleArchiveToggle = async (id: number, name: string) => {
    if (!confirm(`「${name}」をアーカイブしますか？`)) return;
    try {
      await toggleArchive(id);
      load();
    } catch (e) {
      console.error("handleArchiveToggle failed:", e);
      alert("アーカイブに失敗しました");
    }
  };

  return (
    <div>
      <h1 className="mb-24">レシピ</h1>

      {/* タブバー */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #333" }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "none",
              color: activeTab === tab.key ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              fontWeight: activeTab === tab.key ? 700 : 400,
              marginBottom: -2,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* フィルター */}
      <div className="flex gap-16 items-center mb-16">
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: "6px 12px", background: "var(--surface)", color: "var(--text)", border: "1px solid #444", borderRadius: "var(--radius)" }}>
          <option value="created_at">作成日順</option>
          <option value="avg_score">評価順</option>
          <option value="use_count">使用頻度順</option>
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
          お気に入りのみ
        </label>
      </div>

      {/* レシピ一覧 */}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>レシピ名</th>
              <th>v</th>
              <th>平均スコア</th>
              <th>使用回数</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recipes.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>レシピがありません</td></tr>
            )}
            {recipes.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`fav ${Boolean(r.is_favorite) ? "on" : "off"}`} onClick={() => handleFav(r.id)} style={{ cursor: "pointer" }}>★</span>
                </td>
                <td>{r.name}</td>
                <td style={{ color: "var(--text-muted)", fontSize: 12 }}>v{r.version}</td>
                <td>{r.avg_score?.toFixed(1) ?? "-"}</td>
                <td>{r.use_count}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.created_at?.slice(0, 10)}</td>
                <td>
                  <div className="flex gap-8">
                    {activeTab === "archived" ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => toggleArchive(r.id).then(() => load())}
                        style={{ padding: "3px 10px", fontSize: 12 }}
                      >
                        復元
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-secondary" onClick={() => handleEdit(r)} style={{ padding: "3px 10px", fontSize: 12 }}>編集</button>
                        <button className="btn btn-secondary" onClick={() => handleArchiveToggle(r.id, r.name)} style={{ padding: "3px 10px", fontSize: 12 }}>アーカイブ</button>
                        <button className="btn" onClick={() => handleDelete(r.id, r.name)} style={{ padding: "3px 10px", fontSize: 12, background: "var(--accent)", color: "#fff" }}>削除</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 編集モーダル */}
      {editState && (
        <EditModal
          editState={editState}
          saving={saving}
          onClose={() => setEditState(null)}
          onSave={handleEditSave}
          onChange={setEditState}
        />
      )}

      {/* アーカイブ確認モーダル */}
      {archiveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div className="card" style={{ width: "min(90vw, 480px)", padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>レシピの削除</h3>
            <p style={{ marginBottom: 8, lineHeight: 1.6 }}>
              「{archiveModal.name}」は <strong>{archiveModal.shotCount}件</strong> のショットで使用されています。<br />
              削除するとショット履歴との紐付けが失われます。
            </p>
            <div className="flex gap-8" style={{ justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setArchiveModal(null)}>キャンセル</button>
              <button
                className="btn btn-primary"
                onClick={handleArchive}
                style={{ background: "#f39c12" }}
              >
                アーカイブ（推奨）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LLMカスタマイズ */}
      <div className="card">
        <h3>LLMにレシピカスタマイズを依頼</h3>
        <div className="form-group">
          <label>ベースレシピ（任意）</label>
          <select value={baseRecipeId} onChange={(e) => setBaseRecipeId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "6px 12px", background: "var(--surface)", color: "var(--text)", border: "1px solid #444", borderRadius: "var(--radius)", width: "100%" }}>
            <option value="">指定しない</option>
            {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <textarea
            value={customizeText}
            onChange={(e) => setCustomizeText(e.target.value)}
            placeholder='例: 「甘みをもっと出したい」「プレインフュージョンを長くして」'
          />
        </div>
        <button className="btn btn-primary" onClick={handleCustomize} disabled={loading || !customizeText.trim()}>
          {loading ? "生成中..." : "提案を生成"}
        </button>

        {suggestion && (
          <div style={{ marginTop: 16 }}>
            <div className="suggestion">{suggestion}</div>
            <button
              className="btn btn-primary"
              onClick={handleSaveSuggestion}
              disabled={saving}
              style={{ marginTop: 12, width: "100%" }}
            >
              {saving ? "保存中..." : "このレシピを保存"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
