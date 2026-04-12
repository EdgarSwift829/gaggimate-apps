import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getShots, compareShots, type Shot } from "../api";

const COLORS = ["#e94560", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6"];

export default function Compare() {
  const [searchParams] = useSearchParams();
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // クエリパラメータ ?ids=1,2,3 から初期選択を設定し、自動比較を実行
  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
      if (ids.length >= 2) {
        const limited = ids.slice(0, 3);
        setSelectedIds(limited);
        // 自動比較実行
        setLoading(true);
        setError(null);
        compareShots(limited)
          .then((data) => setComparison(data))
          .catch((e: unknown) => setError(e instanceof Error ? e.message : "比較に失敗しました"))
          .finally(() => setLoading(false));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getShots(100).then(setShots).catch(() => {});
  }, []);

  const toggleShot = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const data = await compareShots(selectedIds);
      setComparison(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Build merged timeseries for overlay chart
  const buildChartData = () => {
    if (!comparison?.shots) return [];
    const maxLen = Math.max(...comparison.shots.map((s: any) => s.timeseries?.length ?? 0));
    const merged: any[] = [];
    for (let i = 0; i < maxLen; i++) {
      const point: any = {};
      comparison.shots.forEach((s: any) => {
        const ts = s.timeseries?.[i];
        if (i === 0 || ts) {
          point.t = ts?.t ?? i;
          point[`pressure_${s.shot_id}`] = ts?.pressure ?? null;
        }
      });
      merged.push(point);
    }
    return merged;
  };

  const chartData = comparison ? buildChartData() : [];

  return (
    <div>
      <h1 className="mb-24">ショット比較</h1>

      {/* Shot selector */}
      <div className="card">
        <h3>ショットを選択 (2-3件)</h3>
        <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>#</th>
                <th>日時</th>
                <th>豆</th>
                <th>スコア</th>
                <th>レシピ</th>
              </tr>
            </thead>
            <tbody>
              {shots.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => toggleShot(s.id)}
                  style={{ cursor: "pointer", background: selectedIds.includes(s.id) ? "var(--surface-hover)" : undefined }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleShot(s.id)}
                    />
                  </td>
                  <td>{s.id}</td>
                  <td>{s.timestamp?.slice(0, 16).replace("T", " ")}</td>
                  <td>{s.bean_name ?? "-"}</td>
                  <td>{s.score ? "★".repeat(s.score) : "-"}</td>
                  <td>{s.recipe_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleCompare}
          disabled={selectedIds.length < 2 || loading}
        >
          {loading ? "比較中..." : `比較する (${selectedIds.length}件選択)`}
        </button>
      </div>

      {error && <div className="card"><p style={{ color: "var(--accent)" }}>エラー: {error}</p></div>}

      {/* Comparison chart */}
      {comparison && (
        <>
          <div className="card">
            <h3>圧力カーブ比較</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="t" stroke="#999" label={{ value: "時間 (s)", position: "insideBottom", offset: -5, fill: "#999" }} />
                <YAxis domain={[0, 12]} stroke="#999" label={{ value: "圧力 (bar)", angle: -90, position: "insideLeft", fill: "#999" }} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #444" }} />
                <Legend />
                {comparison.shots.map((s: any, idx: number) => (
                  <Line
                    key={s.shot_id}
                    type="monotone"
                    dataKey={`pressure_${s.shot_id}`}
                    stroke={COLORS[idx % COLORS.length]}
                    name={`#${s.shot_id} ${s.bean_name ?? ""}`}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Shot metadata legend */}
          <div className="card">
            <h3>ショット詳細</h3>
            <table>
              <thead>
                <tr>
                  <th>色</th>
                  <th>#</th>
                  <th>日時</th>
                  <th>豆</th>
                  <th>スコア</th>
                  <th>時間</th>
                  <th>抽出量</th>
                </tr>
              </thead>
              <tbody>
                {comparison.shots.map((s: any, idx: number) => (
                  <tr key={s.shot_id}>
                    <td><span style={{ display: "inline-block", width: 16, height: 16, borderRadius: 4, background: COLORS[idx % COLORS.length] }} /></td>
                    <td>{s.shot_id}</td>
                    <td>{s.timestamp?.slice(0, 16).replace("T", " ") ?? "-"}</td>
                    <td>{s.bean_name ?? "-"}</td>
                    <td>{s.score ? "★".repeat(s.score) : "-"}</td>
                    <td>{s.duration?.toFixed(1) ?? "-"}s</td>
                    <td>{s.yield_g?.toFixed(1) ?? "-"}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
