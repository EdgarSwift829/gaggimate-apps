import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getShot, saveFeedback, getBeans, type Bean, type TimeseriesPoint } from "../api";

export default function ShotResult() {
  const { id } = useParams<{ id: string }>();
  const shotId = Number(id);
  const [shot, setShot] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [beanName, setBeanName] = useState("");
  const [doseG, setDoseG] = useState("18.0");
  const [yieldG, setYieldG] = useState("");
  const [clicks, setClicks] = useState("");
  const [score, setScore] = useState(3);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!shotId) return;
    getShot(shotId).then((data) => {
      setShot(data);
      setTimeseries(data.timeseries || []);
      if (data.yield_g) setYieldG(String(data.yield_g));
    });
    getBeans().then(setBeans).catch(() => {});
  }, [shotId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveFeedback(shotId, {
        bean_name: beanName || undefined,
        dose_g: parseFloat(doseG),
        yield_g: yieldG ? parseFloat(yieldG) : undefined,
        clicks: clicks ? parseInt(clicks) : undefined,
        score,
        feedback,
      }) as { suggestion?: string };
      setSuggestion(result.suggestion ?? null);
    } catch (e) {
      alert("保存に失敗しました");
    }
    setSaving(false);
  };

  return (
    <div>
      <h1 className="mb-24">ショット結果 #{shotId}</h1>

      {/* サマリー */}
      <div className="status-grid mb-16">
        <div className="stat">
          <div className="value">{String(shot?.duration ?? "--")}s</div>
          <div className="label">抽出時間</div>
        </div>
        <div className="stat">
          <div className="value">{String(shot?.yield_g ?? "--")}g</div>
          <div className="label">抽出量</div>
        </div>
        <div className="stat">
          <div className="value">{String(shot?.yield_ratio ?? "--")}x</div>
          <div className="label">収率</div>
        </div>
      </div>

      {/* グラフ */}
      <div className="card">
        <h3>圧力カーブ</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={timeseries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="t" stroke="#999" />
            <YAxis yAxisId="p" stroke="#e94560" domain={[0, 12]} />
            <YAxis yAxisId="w" orientation="right" stroke="#2ecc71" />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #444" }} />
            <Legend />
            <Line yAxisId="p" type="monotone" dataKey="pressure" stroke="#e94560" name="圧力" dot={false} strokeWidth={2} />
            <Line yAxisId="p" type="monotone" dataKey="flow" stroke="#3498db" name="フロー" dot={false} />
            <Line yAxisId="w" type="monotone" dataKey="weight" stroke="#2ecc71" name="重量" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* フィードバックフォーム */}
      <div className="card">
        <h3>フィードバック入力</h3>

        <div className="form-group">
          <label>豆の種類</label>
          <input
            list="bean-list"
            value={beanName}
            onChange={(e) => setBeanName(e.target.value)}
            placeholder="例: Ethiopia Yirgacheffe"
          />
          <datalist id="bean-list">
            {beans.map((b) => <option key={b.id} value={b.name} />)}
          </datalist>
        </div>

        <div className="flex gap-16">
          <div className="form-group" style={{ flex: 1 }}>
            <label>ドーズ (g)</label>
            <input type="number" step="0.1" value={doseG} onChange={(e) => setDoseG(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>抽出量 (g)</label>
            <input type="number" step="0.1" value={yieldG} onChange={(e) => setYieldG(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>クリック数</label>
            <input type="number" value={clicks} onChange={(e) => setClicks(e.target.value)} placeholder="例: 20" />
          </div>
        </div>

        <div className="form-group">
          <label>スコア</label>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className={s <= score ? "active" : ""} onClick={() => setScore(s)}>
                ★
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>感想</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="例: 酸っぱかった、苦みが強い、バランス良い..."
          />
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: "100%" }}>
          {saving ? "分析中..." : "保存 & LLM分析"}
        </button>
      </div>

      {/* LLM改善提案 */}
      {suggestion && (
        <div className="card">
          <h3>改善提案</h3>
          <div className="suggestion">{suggestion}</div>
        </div>
      )}
    </div>
  );
}
