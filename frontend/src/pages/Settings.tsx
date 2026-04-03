import { useEffect, useState } from "react";
import { getHealth } from "../api";

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; gaggimate_connected: boolean } | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div>
      <h1 className="mb-24">設定</h1>

      <div className="card">
        <h3>接続状態</h3>
        <table>
          <tbody>
            <tr>
              <td>バックエンドサーバー</td>
              <td style={{ color: health ? "#2ecc71" : "#e74c3c" }}>
                {health ? "接続中" : "未接続"}
              </td>
            </tr>
            <tr>
              <td>GaggiMate Pro</td>
              <td style={{ color: health?.gaggimate_connected ? "#2ecc71" : "#e74c3c" }}>
                {health?.gaggimate_connected ? "接続中" : "未接続"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>GaggiMate接続設定</h3>
        <div className="form-group">
          <label>GaggiMate ホスト</label>
          <input defaultValue="localhost" placeholder="gaggimate.local or IP" />
        </div>
        <div className="form-group">
          <label>WebSocket ポート</label>
          <input type="number" defaultValue="8765" />
        </div>
      </div>

      <div className="card">
        <h3>LM Studio接続設定</h3>
        <div className="form-group">
          <label>API URL</label>
          <input defaultValue="http://localhost:1234/v1" />
        </div>
        <div className="form-group">
          <label>モデル</label>
          <input defaultValue="local-model" />
        </div>
      </div>

      <div className="card">
        <h3>通知設定</h3>
        <div className="form-group">
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" />
            抽出完了時にWeb Push通知
          </label>
        </div>
        <div className="form-group">
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" />
            LLM提案完了時に通知
          </label>
        </div>
      </div>
    </div>
  );
}
