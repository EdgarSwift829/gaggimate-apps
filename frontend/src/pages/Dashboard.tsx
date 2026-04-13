import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getDashboard } from "../api";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card"><p style={{ color: "var(--accent)" }}>エラー: {error}</p></div>;
  if (!data) return <div className="card"><p style={{ color: "var(--text-muted)" }}>読み込み中...</p></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-24">
        <h1>分析ダッシュボード</h1>
        <div className="flex gap-8">
          <Link to="/compare" className="btn btn-secondary">ショット比較</Link>
          <Link to="/trends" className="btn btn-secondary">トレンド</Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="status-grid mb-16">
        <div className="stat">
          <div className="value">{data.total_shots ?? "--"}</div>
          <div className="label">総ショット数</div>
        </div>
        <div className="stat">
          <div className="value">{data.avg_score != null ? Number(data.avg_score).toFixed(1) : "--"}</div>
          <div className="label">平均スコア</div>
        </div>
        <div className="stat">
          <div className="value">{data.favorite_bean ?? "--"}</div>
          <div className="label">お気に入りの豆</div>
        </div>
        <div className="stat">
          <div className="value">{data.most_used_recipe ?? "--"}</div>
          <div className="label">最も使用したレシピ</div>
        </div>
      </div>

      {/* Score trend */}
      {data.score_trend && data.score_trend.length > 0 && (
        <div className="card">
          <h3>スコアトレンド</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.score_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#999" />
              <YAxis domain={[0, 5]} stroke="#999" />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #444" }} />
              <Line type="monotone" dataKey="score" stroke="#e94560" strokeWidth={2} dot={{ r: 3 }} name="スコア" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent flags/issues */}
      {data.recent_flags && data.recent_flags.length > 0 && (
        <div className="card">
          <h3>最近の問題点</h3>
          <table>
            <thead>
              <tr>
                <th>ショット</th>
                <th>日時</th>
                <th>問題</th>
                <th>スコア</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_flags.map((flag: any, i: number) => (
                <tr key={i}>
                  <td>
                    <Link to={`/shot/${flag.shot_id}`} style={{ color: "var(--blue)" }}>
                      #{flag.shot_id}
                    </Link>
                  </td>
                  <td>{flag.timestamp?.slice(0, 16).replace("T", " ") ?? "-"}</td>
                  <td>{flag.issue ?? "-"}</td>
                  <td>{flag.score ? "★".repeat(flag.score) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
