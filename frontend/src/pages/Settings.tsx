import { useEffect, useState } from "react";
import { getHealth } from "../api";

const API_BASE = "http://localhost:8000";

interface LLMTestResult {
  connected: boolean;
  base_url: string;
  configured_model?: string;
  available_models?: string[];
  error?: string;
}

async function subscribePush(): Promise<boolean> {
  try {
    // VAPID公開鍵取得
    const keyRes = await fetch(`${API_BASE}/api/notifications/vapid-key`);
    const keyData = await keyRes.json();
    if (!keyData.available) return false;

    // Service Worker登録
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Push購読
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.public_key) as BufferSource,
    });

    // サーバーに購読情報を送信
    const subJson = sub.toJSON();
    await fetch(`${API_BASE}/api/notifications/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      }),
    });
    return true;
  } catch (e) {
    console.error("Push subscription failed:", e);
    return false;
  }
}

async function unsubscribePush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return true;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;

    const subJson = sub.toJSON();
    await fetch(`${API_BASE}/api/notifications/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      }),
    });
    await sub.unsubscribe();
    return true;
  } catch (e) {
    console.error("Push unsubscribe failed:", e);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; gaggimate_connected: boolean } | null>(null);
  const [llmResult, setLlmResult] = useState<LLMTestResult | null>(null);
  const [llmTesting, setLlmTesting] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    // 既存のPush購読状態を確認
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(async (reg) => {
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          setPushEnabled(!!sub);
        }
      });
    }
  }, []);

  const testLLM = async () => {
    setLlmTesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/llm/test`);
      const data = await res.json();
      setLlmResult(data);
    } catch {
      setLlmResult({ connected: false, base_url: "", error: "バックエンドに接続できません" });
    }
    setLlmTesting(false);
  };

  const handlePushToggle = async () => {
    setPushLoading(true);
    if (pushEnabled) {
      const ok = await unsubscribePush();
      if (ok) setPushEnabled(false);
    } else {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const ok = await subscribePush();
        if (ok) setPushEnabled(true);
      }
    }
    setPushLoading(false);
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
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={handlePushToggle}
              disabled={pushLoading}
            />
            {pushLoading ? "処理中..." : "Web Push通知（抽出完了・LLM提案完了）"}
          </label>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {pushEnabled ? "通知ON — ブラウザを閉じても通知を受信します" : "通知OFF"}
          </div>
        </div>
      </div>
    </div>
  );
}
