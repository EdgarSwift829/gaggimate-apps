import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { connectStatusWS, stopBrew, type MachineStatus } from "../api";

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
  const wsRef = useRef<WebSocket | null>(null);

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
      if (msg.mode === "standby" && data.length > 0) {
        // 抽出完了 → 結果画面へ（最新ショットIDはAPI経由で取得）
        setTimeout(() => navigate("/log"), 1500);
      }
    });
    wsRef.current = ws;
    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStop = async () => {
    try {
      await stopBrew();
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-24">
        <h1>抽出中</h1>
        <span className="badge badge-brew">BREWING</span>
      </div>

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

      <div className="card">
        <h3>リアルタイムグラフ</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="t" stroke="#999" label={{ value: "秒", position: "insideBottomRight" }} />
            <YAxis yAxisId="pressure" stroke="#e94560" domain={[0, 12]} />
            <YAxis yAxisId="weight" orientation="right" stroke="#2ecc71" domain={[0, 60]} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #444" }} />
            <Legend />
            <Line yAxisId="pressure" type="monotone" dataKey="pressure" stroke="#e94560" name="圧力(bar)" dot={false} strokeWidth={2} />
            <Line yAxisId="pressure" type="monotone" dataKey="flow" stroke="#3498db" name="フロー(ml/s)" dot={false} />
            <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#2ecc71" name="重量(g)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button className="btn btn-danger" onClick={handleStop} style={{ width: "100%", fontSize: 16, padding: 14 }}>
        抽出停止
      </button>
    </div>
  );
}
