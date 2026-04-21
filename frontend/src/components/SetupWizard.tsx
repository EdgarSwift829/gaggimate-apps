import { useState } from "react";
import { getHealth, getSettings, saveSettings } from "../api";

const BACKEND_URL = `http://${window.location.hostname}:8005`;

type Step = "welcome" | "connect" | "done";

interface SetupWizardProps {
  onClose: () => void;
}

export default function SetupWizard({ onClose }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [host, setHost] = useState("gaggimate.local");
  const [port, setPort] = useState(8765);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  const skip = () => {
    localStorage.setItem("setup_wizard_skipped", "1");
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // 設定を保存してから接続確認
      const current = await getSettings();
      await saveSettings({ ...current, gaggimate_host: host, gaggimate_ws_port: port });
      // バックエンドが再接続するまで少し待つ
      await new Promise((r) => setTimeout(r, 1500));
      const health = await getHealth();
      if (health.gaggimate_connected) {
        setTestResult("ok");
        setTimeout(() => setStep("done"), 800);
      } else {
        setTestResult("fail");
      }
    } catch {
      setTestResult("fail");
    }
    setTesting(false);
  };

  const handleSaveAndClose = async () => {
    setSaving(true);
    try {
      const current = await getSettings();
      await saveSettings({ ...current, gaggimate_host: host, gaggimate_ws_port: port });
    } catch { /* ignore */ }
    setSaving(false);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500,
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius)",
        width: "min(92vw, 440px)", padding: 32,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}>

        {/* ステップインジケーター */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28, justifyContent: "center" }}>
          {(["welcome", "connect", "done"] as Step[]).map((s, i) => (
            <div key={s} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: s === step ? "var(--accent)" : "#444",
              transition: "background 0.2s",
            }} />
          ))}
        </div>

        {/* Step 1: ようこそ */}
        {step === "welcome" && (
          <>
            <h2 style={{ marginBottom: 12, textAlign: "center" }}>GaggiMate アプリへようこそ</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 24, textAlign: "center", fontSize: 14 }}>
              GaggiMate Pro との接続を設定して<br />リアルタイム抽出管理を始めましょう。
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 10, padding: "12px 0", fontSize: 15 }}
              onClick={() => setStep("connect")}
            >
              設定を始める
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: "100%", padding: "10px 0", fontSize: 14 }}
              onClick={skip}
            >
              スキップ（後で設定）
            </button>
          </>
        )}

        {/* Step 2: 接続設定 */}
        {step === "connect" && (
          <>
            <h2 style={{ marginBottom: 8 }}>GaggiMate 接続設定</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              GaggiMate Pro のIPアドレスまたはホスト名を入力してください。
            </p>

            <div className="form-group">
              <label>ホスト名 / IPアドレス</label>
              <input
                value={host}
                onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                placeholder="gaggimate.local"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>WebSocket ポート</label>
              <input
                type="number"
                value={port}
                onChange={(e) => { setPort(parseInt(e.target.value, 10) || 8765); setTestResult(null); }}
              />
            </div>

            {/* GaggiMate側に設定するURL */}
            <div style={{
              background: "rgba(52,152,219,0.1)", border: "1px solid #3498db",
              borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, color: "#3498db", fontWeight: 600, marginBottom: 8 }}>
                GaggiMate 側の設定
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.6 }}>
                GaggiMate Pro の Webhook / コールバック設定に<br />このURLを入力してください。
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <code style={{
                  flex: 1, padding: "6px 10px", background: "var(--bg)",
                  borderRadius: 4, fontSize: 13, color: "#eee",
                  wordBreak: "break-all",
                }}>
                  {BACKEND_URL}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(BACKEND_URL)}
                  style={{
                    padding: "6px 10px", background: "#3498db", color: "#fff",
                    border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  コピー
                </button>
              </div>
            </div>

            {testResult && (
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius)", marginBottom: 16,
                background: testResult === "ok" ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
                border: `1px solid ${testResult === "ok" ? "#2ecc71" : "#e74c3c"}`,
                color: testResult === "ok" ? "#2ecc71" : "#e74c3c",
                fontSize: 13,
              }}>
                {testResult === "ok" ? "✓ 接続成功！" : "✗ 接続できませんでした。ホスト名・ポートを確認してください。"}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 10, padding: "12px 0", fontSize: 15 }}
              onClick={handleTest}
              disabled={testing || !host.trim()}
            >
              {testing ? "接続テスト中..." : "接続テスト"}
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep("welcome")}>
                戻る
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={skip}>
                スキップ
              </button>
            </div>
          </>
        )}

        {/* Step 3: 完了 */}
        {step === "done" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✓</div>
              <h2 style={{ marginBottom: 8, color: "#2ecc71" }}>接続完了！</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
                GaggiMate Pro と接続できました。<br />
                抽出の記録・レシピ管理を始めましょう。
              </p>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px 0", fontSize: 15 }}
              onClick={handleSaveAndClose}
              disabled={saving}
            >
              {saving ? "保存中..." : "始める"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
