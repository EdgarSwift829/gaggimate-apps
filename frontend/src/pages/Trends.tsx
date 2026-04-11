import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getTrends } from "../api";

type GroupBy = "bean" | "recipe";

export default function Trends() {
  const [groupBy, setGroupBy] = useState<GroupBy>("bean");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTrends(groupBy)
      .then((result) => setData(result.groups ?? result ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [groupBy]);

  return (
    <div>
      <div className="flex justify-between items-center mb-24">
        <h1>パフォーマンストレンド</h1>
        <div className="flex gap-8">
          <button
            className={`btn ${groupBy === "bean" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setGroupBy("bean")}
          >
            豆別
          </button>
          <button
            className={`btn ${groupBy === "recipe" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setGroupBy("recipe")}
          >
            レシピ別
          </button>
        </div>
      </div>

      {error && <div className="card"><p style={{ color: "var(--accent)" }}>エラー: {error}</p></div>}
      {loading && <div className="card"><p style={{ color: "var(--text-muted)" }}>読み込み中...</p></div>}

      {!loading && data.length > 0 && (
        <>
          {/* Bar chart */}
          <div className="card">
            <h3>{groupBy === "bean" ? "豆" : "レシピ"}別 平均スコア</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#999" />
                <YAxis domain={[0, 5]} stroke="#999" />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #444" }} />
                <Legend />
                <Bar dataKey="avg_score" fill="#e94560" name="平均スコア" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="card">
            <h3>詳細データ</h3>
            <table>
              <thead>
                <tr>
                  <th>{groupBy === "bean" ? "豆" : "レシピ"}</th>
                  <th>ショット数</th>
                  <th>平均スコア</th>
                  <th>平均時間</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any, i: number) => (
                  <tr key={i}>
                    <td>{row.name ?? "-"}</td>
                    <td>{row.shot_count ?? 0}</td>
                    <td>{row.avg_score != null ? Number(row.avg_score).toFixed(2) : "-"}</td>
                    <td>{row.avg_duration != null ? Number(row.avg_duration).toFixed(1) + "s" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="card">
          <p style={{ color: "var(--text-muted)", textAlign: "center" }}>データがありません</p>
        </div>
      )}
    </div>
  );
}
