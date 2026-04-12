import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { connectStatusWS, getShots, stopBrew, type MachineStatus } from "../api";

interface DataPoint {
  t: number;
  pressure: number;
  temp: number;
  flow: number;
  weight: number;
}

export default function Brewing() {
  const navigate = useNavigate();
  const [data, setData] = useState<DataPoint[]>([]);
  const [status, setStatus] = useState<MachineStatus | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const brewCompletedRef = useRef(false);
  const stopOnWeight = parseFloat(localStorage.getItem("brew_stop_on_weight") ?? "0") || 0;

  useEffect(() => {
    const ws = connectStatusWS((msg) => {
      setStatus(msg);
      if (msg.mode === "brew") {
        setData((prev) => [
          ...prev,
          {
            t: msg.elapsed_time,
            pressure: msg.pressure,
            temp: msg.current_temp,
            flow: msg.flow,
            weight: msg.weight,
          },
        ]);
      }
      if (msg.mode === "standby" && !brewCompletedRef.current) {
        // 抽出完了 → 最新ショット取得してフィードバック画面へ
        brewCompletedRef.current = true;
        setShowBanner(true);
        setTimeout(async () => {
          try {
            const shots = await getShots(1);
            if (shots.length > 0) {
              navigate(`/shot/${shots[0].id}`);
            } else {
              navigate("/log");
            }
          } catch {
            navigate("/log");
          }
        }, 1500);
      }
    });
    wsRef.current = ws;
    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStop = async () => {
    try {
      await stopBrew();
    } catch (e) {
      console.error("stopBrew failed:", e);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-24">
        <h1>抽出中</h1>
        <span className="badge badge-brew">BREWING</span>
      </div>

      {showBanner && (
        <div style={{
          background: "#2ecc71",
          color: "#fff",
          textAlign: "center",
          fontWeight: 700,
          fontSize: 15,
          padding: "12px 16px",
          borderRadius: 8,
          marginBottom: 16,
        }}>
          抽出完了！フィードバック画面へ移動します
        </div>
      )}

      <div className="status-grid">
        <div className="stat">
          <div className="value">{status?.elapsed_time?.toFixed(0) ?? "0"}s</div>
          <div className="label">経過時間</div>
        </div>
        <div className="stat">
          <div className="value">{status?.pressure?.toFixed(1) ?? "0"}</div>
          <div className="label">圧力 (bar)</div>
        </div>
        <div className="stat">
          <div className="value">{status?.current_temp?.toFixed(1) ?? "0"}°C</div>
          <div className="label">温度</div>
        </div>
        <div className="stat">
          <div className="value">{status?.weight?.toFixed(1) ?? "0"}g</div>
          <div className="label">重量</div>
        </div>
      </div>

      {/* 目標重量進捗バー */}
      {stopOnWeight > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>目標重量</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#2ecc71" }}>
              {status?.weight?.toFixed(1) ?? "0"} / {stopOnWeight}g
            </span>
          </div>
          <div style={{ height: 12, background: "#1a1a2e", borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(((status?.weight ?? 0) / stopOnWeight) * 100, 100).toFixed(1)}%`,
                background: (status?.weight ?? 0) >= stopOnWeight ? "#e74c3c" : "#2ecc71",
                borderRadius: 6,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#555", marginTop: 4 }}>
            {Math.min(((status?.weight ?? 0) / stopOnWeight) * 100, 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* 上グラフ: 圧力 + フロー */}
      <div className="card">
        <h3>圧力 / フロー</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="t" stroke="#999" tickFormatter={(v) => `${v}s`} />
            <YAxis yAxisId="p" stroke="#e94560" domain={[0, 12]} tickFormatter={(v) => `${v}bar`} width={50} />
            <YAxis yAxisId="f" orientation="right" stroke="#3498db" domain={[0, 6]} tickFormatter={(v) => `${v}ml/s`} width={55} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #444" }} formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, ""]} />
            <Legend />
            <Line yAxisId="p" type="monotone" dataKey="pressure" stroke="#e94560" name="圧力(bar)" dot={false} strokeWidth={2} />
            <Line yAxisId="f" type="monotone" dataKey="flow" stroke="#3498db" name="フロー(ml/s)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 下グラフ: 重量 + 温度 */}
      <div className="card">
        <h3>重量 / 温度</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="t" stroke="#999" tickFormatter={(v) => `${v}s`} />
            <YAxis yAxisId="w" stroke="#2ecc71" domain={[0, 60]} tickFormatter={(v) => `${v}g`} width={45} />
            <YAxis yAxisId="t" orientation="right" stroke="#f39c12" domain={[85, 100]} tickFormatter={(v) => `${v}°C`} width={50} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #444" }} formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, ""]} />
            <Legend />
            <Line yAxisId="w" type="monotone" dataKey="weight" stroke="#2ecc71" name="重量(g)" dot={false} strokeWidth={2} />
            <Line yAxisId="t" type="monotone" dataKey="temp" stroke="#f39c12" name="温度(°C)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button className="btn btn-danger" onClick={handleStop} style={{ width: "100%", fontSize: 16, padding: 14 }}>
        抽出停止
      </button>
    </div>
  );
}
