import { useEffect, useState } from "react";

const API_BASE = `http://${window.location.hostname}:8000`;
const QR_URL = `${API_BASE}/api/qr?port=5173`;
const FRONTEND_URL = `http://${window.location.hostname}:5173`;

export default function MobileConnect() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // QR画像のキャッシュ回避用タイムスタンプ
  const [ts] = useState(() => Date.now());

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, []);

  return (
    <div>
      <h1 className="mb-24">スマホ連携</h1>

      <div className="card" style={{ textAlign: "center" }}>
        <h3 style={{ marginBottom: 8 }}>QRコードをスキャン</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
          PCとスマホを同じWiFiに接続した状態で、<br />
          スマホのカメラアプリでQRコードを読み取ってください。
        </p>

        {/* QR画像 */}
        <div style={{ display: "inline-block", padding: 16, background: "#fff", borderRadius: 12, marginBottom: 16 }}>
          {!error ? (
            <img
              src={`${QR_URL}&_=${ts}`}
              alt="QR Code"
              width={220}
              height={220}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              style={{ display: "block", opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}
            />
          ) : (
            <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 13 }}>
              QR生成失敗<br />バックエンドを確認してください
            </div>
          )}
          {!loaded && !error && (
            <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 13 }}>
              読み込み中...
            </div>
          )}
        </div>

        {/* URL直接表示 */}
        <div style={{ marginTop: 8, padding: "10px 20px", background: "var(--surface)", borderRadius: "var(--radius)", display: "inline-block" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: 8 }}>URL:</span>
          <a
            href={FRONTEND_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--blue)", fontFamily: "monospace", fontSize: 15 }}
          >
            {FRONTEND_URL}
          </a>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>
          ※ スマホからアクセスできない場合は、PCのファイアウォールでポート 5173 / 8000 の受信を許可してください。
        </p>
      </div>

      {/* 接続ガイド */}
      <div className="card">
        <h3>接続できない場合</h3>
        <table>
          <tbody>
            <tr>
              <td style={{ width: 140, color: "var(--text-muted)" }}>同じWiFi？</td>
              <td>PCとスマホが同じルーターに接続されているか確認</td>
            </tr>
            <tr>
              <td style={{ color: "var(--text-muted)" }}>ファイアウォール</td>
              <td>Windows Defender でポート 5173 / 8000 の受信を許可</td>
            </tr>
            <tr>
              <td style={{ color: "var(--text-muted)" }}>バックエンド起動</td>
              <td>start.bat でバックエンドが起動していることを確認</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
