import { useEffect, useState } from "react";
import { getHealth } from "../api";

interface LLMTestResult {
  connected: boolean;
  base_url: string;
  configured_model?: string;
  available_models?: string[];
  error?: string;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; gaggimate_connected: boolean } | null>(null);
  const [llmResult, setLlmResult] = useState<LLMTestResult | null>(null);
  const [llmTesting, setLlmTesting] = useState(false);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const testLLM = async () => {
    setLlmTesting(true);
    try {
      const res = await fetch("http://localhost:8000/api/llm/test");
      const data = await res.json();
      setLlmResult(data);
    } catch {
      setLlmResult({ connected: false, base_url: "", error: "バックエンドに接続できません" });
    }
    setLlmTesting(false);
  };

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
            <tr>
              <td>LM Studio</td>
              <td style={{ color: llmResult?.connected ? "#2ecc71" : llmResult ? "#e74c3c" : "#999" }}>
                {llmResult ? (llmResult.connected ? "接続中" : "未接続") : "未テスト"}
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
        <button className="btn btn-primary" onClick={testLLM} disabled={llmTesting} style={{ marginTop: 8 }}>
          {llmTesting ? "テスト中..." : "LM Studio 接続テスト"}
        </button>
        {llmResult && (
          <div style={{ marginTop: 12, padding: 12, background: "var(--surface)", borderRadius: "var(--radius)", border: `1px solid ${llmResult.connected ? "#2ecc71" : "#e74c3c"}` }}>
            {llmResult.connected ? (
              <>
                <div style={{ color: "#2ecc71", marginBottom: 8 }}>接続OK</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  URL: {llmResult.base_url}<br />
                  利用可能モデル: {llmResult.available_models?.join(", ") || "なし"}
                </div>
              </>
            ) : (
              <>
                <div style={{ color: "#e74c3c", marginBottom: 8 }}>接続失敗</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {llmResult.error}<br />
                  LM Studioが起動しているか確認してください
                </div>
              </>
            )}
          </div>
        )}
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
