import { useState } from "react";

const inputStyle = {
  width: "100%",
  padding: "0.5rem",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#16213e",
  color: "#fff",
  fontSize: "0.95rem",
  boxSizing: "border-box" as const,
};

export default function Settings() {
  const [gaggiUrl, setGaggiUrl] = useState("ws://gaggimate.local/ws");
  const [mqttHost, setMqttHost] = useState("gaggimate.local");
  const [mqttPort, setMqttPort] = useState("1883");
  const [llmUrl, setLlmUrl] = useState("http://localhost:1234/v1");
  const [llmModel, setLlmModel] = useState("local-model");
  const [gaggiStatus, setGaggiStatus] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<string | null>(null);

  const testGaggiMate = async () => {
    setGaggiStatus("接続テスト中...");
    // Mock test
    setTimeout(() => setGaggiStatus("未接続（機体到着前）"), 1000);
  };

  const testLLM = async () => {
    setLlmStatus("接続テスト中...");
    try {
      const res = await fetch(llmUrl.replace("/v1", "/v1/models"));
      if (res.ok) {
        setLlmStatus("接続OK");
      } else {
        setLlmStatus(`エラー: ${res.status}`);
      }
    } catch {
      setLlmStatus("接続失敗 - LM Studioが起動しているか確認してください");
    }
  };

  return (
    <div style={{ color: "#fff", maxWidth: 600 }}>
      <h1>設定</h1>

      {/* GaggiMate Connection */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>GaggiMate 接続</h2>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ color: "#888", fontSize: "0.85rem" }}>WebSocket URL</label>
          <input type="text" value={gaggiUrl} onChange={(e) => setGaggiUrl(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ color: "#888", fontSize: "0.85rem" }}>MQTT Host</label>
            <input type="text" value={mqttHost} onChange={(e) => setMqttHost(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ color: "#888", fontSize: "0.85rem" }}>MQTT Port</label>
            <input type="number" value={mqttPort} onChange={(e) => setMqttPort(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={testGaggiMate}
            style={{
              padding: "0.5rem 1.5rem", borderRadius: 6,
              background: "#16213e", color: "#fff", cursor: "pointer",
              border: "1px solid #333",
            }}
          >
            接続テスト
          </button>
          {gaggiStatus && <span style={{ color: gaggiStatus.includes("OK") ? "#22c55e" : "#f59e0b" }}>{gaggiStatus}</span>}
        </div>
      </div>

      {/* LM Studio Connection */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>LM Studio 接続</h2>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ color: "#888", fontSize: "0.85rem" }}>API URL</label>
          <input type="text" value={llmUrl} onChange={(e) => setLlmUrl(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ color: "#888", fontSize: "0.85rem" }}>モデル名</label>
          <input type="text" value={llmModel} onChange={(e) => setLlmModel(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={testLLM}
            style={{
              padding: "0.5rem 1.5rem", borderRadius: 6,
              background: "#16213e", color: "#fff", cursor: "pointer",
              border: "1px solid #333",
            }}
          >
            接続テスト
          </button>
          {llmStatus && <span style={{ color: llmStatus.includes("OK") ? "#22c55e" : "#ef4444" }}>{llmStatus}</span>}
        </div>
      </div>

      {/* Info */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>システム情報</h2>
        <table>
          <tbody>
            {[
              ["アプリ", "GaggiMate Integration v0.1.0"],
              ["バックエンド", "Python / FastAPI"],
              ["データベース", "SQLite (ローカル)"],
              ["LLM", "LM Studio + Qwen2.5:14B (推奨)"],
              ["マシン", "Gaggia Classic E24 + GaggiMate Pro"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: "0.25rem 1rem 0.25rem 0", color: "#888" }}>{k}</td>
                <td style={{ padding: "0.25rem 0" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
