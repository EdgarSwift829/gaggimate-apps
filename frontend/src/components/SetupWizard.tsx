import { useState } from "react";
import { getHealth, getSettings, saveSettings } from "../api";

type Step = "welcome" | "find" | "connect" | "webhook" | "done";

const BACKEND_URL = `http://${window.location.hostname}:8005`;
const WEBHOOK_URL = `${BACKEND_URL}/webhook`;

interface SetupWizardProps {
  onClose: () => void;
}

function StepDots({ current }: { current: Step }) {
  const steps: Step[] = ["welcome", "find", "connect", "webhook", "done"];
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}>
      {steps.map((s) => (
        <div key={s} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: s === current ? "var(--accent)" : "#444",
          transition: "background 0.2s",
        }} />
      ))}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(52,152,219,0.1)", border: "1px solid #3498db",
      borderRadius: "var(--radius)", padding: "12px 14px", marginBottom: 16,
      fontSize: 13, color: "var(--text)", lineHeight: 1.7,
    }}>
      {children}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <code style={{
          flex: 1, padding: "7px 10px", background: "var(--bg)",
          borderRadius: 4, fontSize: 13, color: "#eee", wordBreak: "break-all",
        }}>
          {value}
        </code>
        <button
          onClick={copy}
          style={{
            padding: "7px 12px", background: copied ? "#2ecc71" : "#3498db",
            color: "#fff", border: "none", borderRadius: 4,
            cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
            transition: "background 0.2s",
          }}
        >
          {copied ? "✓ コピー済" : "コピー"}
        </button>
      </div>
    </div>
  );
}

export default function SetupWizard({ onClose }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [host, setHost] = useState("gaggimate.local");
  const [port, setPort] = useState(8766);
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
      const current = await getSettings();
      await saveSettings({ ...current, gaggimate_host: host, gaggimate_ws_port: port });
      await new Promise((r) => setTimeout(r, 1500));
      const health = await getHealth();
      if (health.gaggimate_connected) {
        setTestResult("ok");
        setTimeout(() => setStep("webhook"), 800);
      } else {
        setTestResult("fail");
      }
    } catch {
      setTestResult("fail");
    }
    setTesting(false);
  };

  const handleFinish = async () => {
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
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 500, overflowY: "auto", padding: "16px 0",
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius)",
        width: "min(94vw, 480px)", padding: "28px 28px 24px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)", margin: "auto",
      }}>
        <StepDots current={step} />

        {/* ① ようこそ */}
        {step === "welcome" && (
          <>
            <h2 style={{ marginBottom: 10 }}>GaggiMate アプリへようこそ</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 8, fontSize: 14 }}>
              このアプリはGaggiMate Proと連携して、ショットのログ保存・レシピ管理・AI分析を行います。
            </p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 24, fontSize: 14 }}>
              初回セットアップは<strong style={{ color: "var(--text)" }}>約2分</strong>で完了します。GaggiMate本体を起動してWi-Fiに接続した状態で始めてください。
            </p>
            <InfoBox>
              <strong>セットアップの流れ</strong><br />
              1. GaggiMateのIPアドレスを確認する<br />
              2. このアプリにGaggiMateのアドレスを入力して接続テスト<br />
              3. GaggiMateにこのアプリのURLを設定（ログ自動保存に必要）
            </InfoBox>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 10, padding: "12px 0", fontSize: 15 }}
              onClick={() => setStep("find")}
            >
              セットアップを始める →
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

        {/* ② GaggiMateのIPを調べる */}
        {step === "find" && (
          <>
            <h2 style={{ marginBottom: 6 }}>① GaggiMateのIPを確認する</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              GaggiMate ProのIPアドレスまたはホスト名が必要です。以下のいずれかの方法で確認してください。
            </p>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3498db", marginBottom: 6 }}>
                方法A — GaggiMateのWeb UIで確認（推奨）
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, paddingLeft: 12, borderLeft: "2px solid #3498db" }}>
                1. スマホまたはPCのブラウザで<br />
                &emsp;<code style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 3 }}>http://gaggimate.local</code> を開く<br />
                2. 右上のアイコン → 「Settings」→「Network」<br />
                3. 表示されているIPアドレスをメモ
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f39c12", marginBottom: 6 }}>
                方法B — ルーター管理画面で確認
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, paddingLeft: 12, borderLeft: "2px solid #f39c12" }}>
                1. ブラウザで <code style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 3 }}>192.168.1.1</code> または <code style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 3 }}>192.168.0.1</code> を開く<br />
                2. 接続デバイス一覧から「GaggiMate」を探す<br />
                3. 表示されているIPアドレスをメモ
              </div>
            </div>

            <InfoBox>
              💡 <strong>ホスト名で接続できる場合</strong><br />
              同一Wi-Fiなら <code>gaggimate.local</code> のまま使えることが多いです。IPアドレスが変わらない固定IPの設定も推奨します。
            </InfoBox>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep("welcome")}>← 戻る</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep("connect")}>
                確認できた → 次へ
              </button>
            </div>
            <button className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }} onClick={skip}>スキップ</button>
          </>
        )}

        {/* ③ このアプリに入力 */}
        {step === "connect" && (
          <>
            <h2 style={{ marginBottom: 6 }}>② このアプリに入力する</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              先ほど確認したGaggiMateのホスト名またはIPアドレスを入力して接続テストを行います。
            </p>

            <div className="form-group">
              <label>GaggiMate ホスト名 / IPアドレス</label>
              <input
                value={host}
                onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                placeholder="gaggimate.local または 192.168.1.xx"
                autoFocus
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                例: <code>gaggimate.local</code> または <code>192.168.1.50</code>
              </div>
            </div>

            <div className="form-group">
              <label>WebSocket ポート</label>
              <input
                type="number"
                value={port}
                onChange={(e) => { setPort(parseInt(e.target.value, 10) || 8766); setTestResult(null); }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                GaggiMate Proのデフォルトは <code>8766</code>
              </div>
            </div>

            {testResult && (
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius)", marginBottom: 14,
                background: testResult === "ok" ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
                border: `1px solid ${testResult === "ok" ? "#2ecc71" : "#e74c3c"}`,
                color: testResult === "ok" ? "#2ecc71" : "#e74c3c",
                fontSize: 13, lineHeight: 1.6,
              }}>
                {testResult === "ok"
                  ? "✓ 接続成功！次のステップに進みます。"
                  : "✗ 接続できませんでした。GaggiMateが起動しているか、ホスト名・ポートが正しいか確認してください。"}
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
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep("find")}>← 戻る</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep("webhook")}>
                スキップして次へ
              </button>
            </div>
          </>
        )}

        {/* ④ GaggiMateにWebhook設定 */}
        {step === "webhook" && (
          <>
            <h2 style={{ marginBottom: 6 }}>③ GaggiMateにこのアプリのURLを設定する</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
              ショット完了時にデータを自動保存するため、GaggiMate側にこのアプリのURLを登録します（GaggiMate v1.6.0以降）。
            </p>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>GaggiMateのWeb UIで設定する手順：</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.9, paddingLeft: 12, borderLeft: "2px solid var(--accent)" }}>
                1. ブラウザで <code style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 3 }}>http://gaggimate.local</code> を開く<br />
                2. 右上メニュー → <strong style={{ color: "var(--text)" }}>「Settings」</strong> を開く<br />
                3. <strong style={{ color: "var(--text)" }}>「Integration」</strong> または <strong style={{ color: "var(--text)" }}>「Webhook」</strong> セクションを探す<br />
                4. <strong style={{ color: "var(--text)" }}>Webhook URL</strong> 欄に下記のURLを入力してコピーボタンを使ってください<br />
                5. 保存して完了
              </div>
            </div>

            <CopyRow label="Webhook URL（GaggiMateに入力するURL）" value={WEBHOOK_URL} />
            <CopyRow label="このアプリのバックエンドURL（参考）" value={BACKEND_URL} />

            <InfoBox>
              💡 このPCとGaggiMateが同じWi-Fiにいる必要があります。<br />
              PCのIPが変わる場合はルーターで固定IP設定をするか、PCのホスト名（例: <code>mypc.local</code>）を使うと安定します。
            </InfoBox>

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 10, padding: "12px 0", fontSize: 15 }}
              onClick={() => setStep("done")}
            >
              設定した → 完了へ
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep("connect")}>← 戻る</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep("done")}>後で設定する</button>
            </div>
          </>
        )}

        {/* ⑤ 完了 */}
        {step === "done" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>☕</div>
              <h2 style={{ marginBottom: 8, color: "#2ecc71" }}>セットアップ完了！</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7 }}>
                GaggiMate Proと連携する準備ができました。<br />
                ショットを抽出するとデータが自動保存されます。<br /><br />
                設定はいつでも「設定」メニューから変更できます。
              </p>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px 0", fontSize: 15 }}
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? "保存中..." : "始める →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
