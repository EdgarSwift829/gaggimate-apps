import { useEffect, useState } from "react";
import { generateRecipe, chatRecipe, importRecipe, getBeans, type Bean } from "../api";

type Tab = "generate" | "chat" | "import";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function RecipeAI() {
  const [tab, setTab] = useState<Tab>("generate");

  return (
    <div>
      <h1 className="mb-24">AI レシピ</h1>

      <div className="flex gap-8 mb-16">
        <button className={`btn ${tab === "generate" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("generate")}>
          生成
        </button>
        <button className={`btn ${tab === "chat" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("chat")}>
          チャット
        </button>
        <button className={`btn ${tab === "import" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("import")}>
          インポート
        </button>
      </div>

      {tab === "generate" && <GenerateTab />}
      {tab === "chat" && <ChatTab />}
      {tab === "import" && <ImportTab />}
    </div>
  );
}

/* ===== Generate Tab ===== */
function GenerateTab() {
  const [beans, setBeans] = useState<Bean[]>([]);
  const [description, setDescription] = useState("");
  const [beanName, setBeanName] = useState("");
  const [targetFlavor, setTargetFlavor] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBeans().then(setBeans).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await generateRecipe({
        description: description.trim(),
        bean_name: beanName || undefined,
        target_flavor: targetFlavor || undefined,
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <>
      <div className="card">
        <h3>レシピ生成</h3>
        <div className="form-group">
          <label>説明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例: 甘みを強調した低圧プロファイル、プレインフュージョン長め..."
          />
        </div>
        <div className="flex gap-16">
          <div className="form-group" style={{ flex: 1 }}>
            <label>豆 (任意)</label>
            <select value={beanName} onChange={(e) => setBeanName(e.target.value)}>
              <option value="">選択しない</option>
              {beans.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>目標フレーバー (任意)</label>
            <input
              value={targetFlavor}
              onChange={(e) => setTargetFlavor(e.target.value)}
              placeholder="例: チョコレート、フルーティー"
            />
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          style={{ width: "100%" }}
        >
          {loading ? "生成中..." : "レシピを生成"}
        </button>
      </div>

      {error && <div className="card"><p style={{ color: "var(--accent)" }}>エラー: {error}</p></div>}

      {result && (
        <div className="card">
          <h3>生成結果</h3>
          {result.name && <p style={{ marginBottom: 8 }}><strong>名前:</strong> {result.name}</p>}
          {result.description && <p style={{ marginBottom: 12, color: "var(--text-muted)" }}>{result.description}</p>}
          <div className="suggestion">
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
              {typeof result.recipe === "string" ? result.recipe : JSON.stringify(result.recipe ?? result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

/* ===== Chat Tab ===== */
function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await chatRecipe({
        message: text,
        conversation_id: conversationId,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      if (data.conversation_id) setConversationId(data.conversation_id);
      const assistantMsg: ChatMessage = { role: "assistant", content: data.response ?? data.message ?? JSON.stringify(data) };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      const errMsg: ChatMessage = { role: "assistant", content: `エラー: ${e.message}` };
      setMessages((prev) => [...prev, errMsg]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
        <h3>レシピチャット</h3>
        <button className="btn btn-secondary" onClick={handleReset} style={{ padding: "4px 12px", fontSize: 12 }}>
          リセット
        </button>
      </div>

      {/* Messages */}
      <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 16 }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 32 }}>
            レシピについて質問してみましょう
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: "var(--radius)",
              background: msg.role === "user" ? "var(--bg)" : "#1e2a45",
              borderLeft: msg.role === "assistant" ? "3px solid var(--blue)" : "none",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
              {msg.role === "user" ? "あなた" : "AI"}
            </div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ padding: 12, color: "var(--text-muted)" }}>考え中...</div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-8">
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力... (Enter で送信)"
            style={{ minHeight: 48 }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{ alignSelf: "flex-end" }}
        >
          送信
        </button>
      </div>
    </div>
  );
}

/* ===== Import Tab ===== */
function ImportTab() {
  const [name, setName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!name.trim() || !jsonText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    // Validate JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError("無効なJSONです。正しいJSON形式で入力してください。");
      setLoading(false);
      return;
    }

    try {
      await importRecipe({ name: name.trim(), recipe_json: parsed });
      setResult("レシピのインポートに成功しました");
      setName("");
      setJsonText("");
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <h3>レシピインポート</h3>
      <div className="form-group">
        <label>レシピ名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: Community Turbo Shot"
        />
      </div>
      <div className="form-group">
        <label>レシピJSON</label>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{"stages": [...]}'
          style={{ minHeight: 160, fontFamily: "monospace", fontSize: 13 }}
        />
      </div>
      <button
        className="btn btn-primary"
        onClick={handleImport}
        disabled={loading || !name.trim() || !jsonText.trim()}
        style={{ width: "100%" }}
      >
        {loading ? "インポート中..." : "インポート"}
      </button>

      {error && <p style={{ color: "var(--accent)", marginTop: 12 }}>エラー: {error}</p>}
      {result && <p style={{ color: "var(--green)", marginTop: 12 }}>{result}</p>}
    </div>
  );
}
