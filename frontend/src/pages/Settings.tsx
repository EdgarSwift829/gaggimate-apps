import { useEffect, useState } from "react";
import { getHealth, getSettings, saveSettings, type Settings } from "../api";

const API_BASE = `http://${window.location.hostname}:8005`;

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

const DOSE_OPTIONS = [16, 18, 25] as const;

function DefaultDoseSelector({ onToast }: { onToast: (msg: string) => void }) {
  const [selected, setSelected] = useState<number>(
    parseInt(localStorage.getItem("default_dose_g") ?? "18", 10)
  );

  const handleSelect = (g: number) => {
    localStorage.setItem("default_dose_g", String(g));
    setSelected(g);
    onToast(`デフォルトドーズを${g}gに設定しました`);
  };

  return (
    <div className="card">
      <h3>抽出設定</h3>
      <div className="form-group">
        <label>デフォルトドーズ量</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {DOSE_OPTIONS.map((g) => (
            <button
              key={g}
              onClick={() => handleSelect(g)}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: 15,
                fontWeight: selected === g ? 700 : 400,
                borderRadius: "var(--radius)",
                border: `2px solid ${selected === g ? "#2ecc71" : "#444"}`,
                background: selected === g ? "rgba(46,204,113,0.15)" : "var(--surface)",
                color: selected === g ? "#2ecc71" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {g}g
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
          レシピのビジュアルエディタで使用するデフォルトのドーズ量
        </div>
      </div>
    </div>
  );
}

const DEFAULT_SETTINGS: Settings = {
  gaggimate_host: "localhost",
  gaggimate_ws_port: 8765,
  lm_studio_base_url: "http://localhost:1234/v1",
  lm_studio_model: "local-model",
  line_notify_token: null,
};

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; gaggimate_connected: boolean } | null>(null);
  const [llmResult, setLlmResult] = useState<LLMTestResult | null>(null);
  const [llmTesting, setLlmTesting] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [lineTestResult, setLineTestResult] = useState<string | null>(null);
  const [lineTestLoading, setLineTestLoading] = useState(false);

  // 設定フォームの状態
  const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));

    // バックエンドから現在の設定値を取得してフォームに反映
    getSettings()
      .then((s) => setForm(s))
      .catch(() => {
        // 取得失敗時はデフォルト値のまま
      });

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

  const handleFormChange = (field: keyof Settings, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveToast(null);
    try {
      const saved = await saveSettings(form);
      setForm(saved);
      setSaveToast("設定を保存しました");
    } catch {
      setSaveToast("保存に失敗しました");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  const testLLM = async () => {
    setLlmTesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/llm/test`);
      const data = await res.json();
      setLlmResult(data);
      if (data.available_models?.length) {
        setAvailableModels(data.available_models);
      }
    } catch {
      setLlmResult({ connected: false, base_url: "", error: "バックエンドに接続できません" });
    }
    setLlmTesting(false);
  };

  const handleLineTest = async () => {
    if (!form.line_notify_token?.trim()) return;
    setLineTestLoading(true);
    setLineTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/notifications/line-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: form.line_notify_token }),
      });
      const data = await res.json();
      setLineTestResult(data.success ? "送信成功" : "送信失敗");
    } catch {
      setLineTestResult("エラー: バックエンドに接続できません");
    }
    setLineTestLoading(false);
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

      {saveToast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 1000,
          padding: "12px 20px", borderRadius: "var(--radius)",
          background: saveToast.includes("失敗") ? "#e74c3c" : "#2ecc71",
          color: "#fff", fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}>
          {saveToast}
        </div>
      )}

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
          <input
            value={form.gaggimate_host}
            onChange={(e) => handleFormChange("gaggimate_host", e.target.value)}
            placeholder="gaggimate.local or IP"
          />
        </div>
        <div className="form-group">
          <label>WebSocket ポート</label>
          <input
            type="number"
            value={form.gaggimate_ws_port}
            onChange={(e) => handleFormChange("gaggimate_ws_port", parseInt(e.target.value, 10) || 8765)}
          />
        </div>
      </div>

      <div className="card">
        <h3>LM Studio接続設定</h3>
        <div className="form-group">
          <label>API URL</label>
          <input
            value={form.lm_studio_base_url}
            onChange={(e) => handleFormChange("lm_studio_base_url", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>モデル</label>
          {availableModels.length > 0 ? (
            <select
              value={form.lm_studio_model}
              onChange={(e) => handleFormChange("lm_studio_model", e.target.value)}
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              value={form.lm_studio_model}
              onChange={(e) => handleFormChange("lm_studio_model", e.target.value)}
              placeholder="接続テストでモデル一覧を取得"
            />
          )}
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
        <div className="form-group" style={{ marginTop: 16 }}>
          <label>LINE Notify トークン</label>
          <input
            type="password"
            value={form.line_notify_token ?? ""}
            onChange={(e) => handleFormChange("line_notify_token", e.target.value || null)}
            placeholder="LINE Notify アクセストークンを入力"
          />
          <button
            className="btn btn-secondary"
            onClick={handleLineTest}
            disabled={lineTestLoading || !form.line_notify_token?.trim()}
            style={{ marginTop: 8 }}
          >
            {lineTestLoading ? "送信中..." : "テスト送信"}
          </button>
          {lineTestResult && (
            <div style={{ marginTop: 8, fontSize: 13, color: lineTestResult.includes("成功") ? "var(--green)" : "var(--accent)" }}>
              {lineTestResult}
            </div>
          )}
        </div>
      </div>

      <DefaultDoseSelector onToast={(msg) => { setSaveToast(msg); setTimeout(() => setSaveToast(null), 2000); }} />

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
