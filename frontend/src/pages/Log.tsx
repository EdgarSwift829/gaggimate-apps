import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getShots, type Shot } from "../api";

export default function LogPage() {
  const [shots, setShots] = useState<Shot[]>([]);

  useEffect(() => {
    getShots(100).then(setShots).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="mb-24">ショットログ</h1>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>日時</th>
              <th>時間</th>
              <th>抽出量</th>
              <th>収率</th>
              <th>スコア</th>
              <th>豆</th>
              <th>レシピ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shots.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>ショットデータがありません</td></tr>
            )}
            {shots.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.timestamp?.slice(0, 16).replace("T", " ")}</td>
                <td>{s.duration?.toFixed(1)}s</td>
                <td>{s.yield_g?.toFixed(1) ?? "-"}g</td>
                <td>{s.yield_ratio?.toFixed(2) ?? "-"}x</td>
                <td>{s.score ? "★".repeat(s.score) : "-"}</td>
                <td>{s.bean_name ?? "-"}</td>
                <td>{s.recipe_name ?? "-"}</td>
                <td><Link to={`/shot/${s.id}`} className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }}>詳細</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
