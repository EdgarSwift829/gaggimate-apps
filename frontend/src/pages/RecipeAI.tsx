import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { generateRecipe, chatRecipe, importRecipeRaw, getBeans, type Bean } from "../api";

type Tab = "generate" | "chat" | "import";

// Context passed from ImportTab to ChatTab when user wants to customize an imported recipe
interface ImportedRecipeContext {
  name: string;
  jsonText: string;
}

interface SaveBannerProps {
  message: string;
}

function SaveBanner({ message }: SaveBannerProps) {
  return (
    <div style={{
      background: "var(--green, #2a7a4b)",
      color: "#fff",
      borderRadius: "var(--radius)",
      padding: "12px 16px",
      marginTop: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    }}>
      <span>{message}</span>
      <Link
        to="/recipes"
        style={{
          color: "#fff",
          fontWeight: 600,
          textDecoration: "underline",
          whiteSpace: "nowrap",
        }}
      >
        Recipesページで確認 →
      </Link>
    </div>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function RecipeAI() {
  const [tab, setTab] = useState<Tab>("generate");
  const [importedContext, setImportedContext] = useState<ImportedRecipeContext | null>(null);

  const handleCustomizeImported = (ctx: ImportedRecipeContext) => {
    setImportedContext(ctx);
    setTab("chat");
  };

  return (
    <div>
      <h1 className="mb-24">AI レシピ</h1>

      <div className="flex gap-8 mb-16">
        <button className={`btn ${tab === "generate" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("generate")}>
          生成
        </button>
        <button className={`btn ${tab === "chat" ? "btn-primary" : "btn-secondary"}`} onClick={() => { setTab("chat"); setImportedContext(null); }}>
          チャット
        </button>
        <button className={`btn ${tab === "import" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("import")}>
          インポート
        </button>
      </div>

      {tab === "generate" && <GenerateTab />}
      {tab === "chat" && <ChatTab initialContext={importedContext} />}
      {tab === "import" && <ImportTab onCustomize={handleCustomizeImported} />}
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getBeans().then(setBeans).catch(() => {});
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const recipeName: string =
        typeof result.name === "string" && result.name.trim()
          ? result.name.trim()
          : `AI生成レシピ ${new Date().toLocaleString("ja-JP")}`;

      let jsonText: string;
      if (result.recipe_json !== undefined) {
        jsonText =
          typeof result.recipe_json === "string"
            ? result.recipe_json
            : JSON.stringify(result.recipe_json);
      } else {
        jsonText = JSON.stringify({
          suggestion: typeof result.recipe === "string" ? result.recipe : JSON.stringify(result.recipe ?? result),
          generated_at: new Date().toISOString(),
        });
      }

      await importRecipeRaw({ name: recipeName, json_text: jsonText, source: "AI生成" });
      setSaved(true);
      saveTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
    }
    setSaving(false);
  };

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
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ marginTop: 12, width: "100%" }}
          >
            {saving ? "保存中..." : "レシピを保存"}
          </button>
          {saveError && (
            <p style={{ color: "var(--accent)", marginTop: 8, fontSize: 13 }}>エラー: {saveError}</p>
          )}
          {saved && (
            <SaveBanner message="保存しました！Recipesページで確認できます" />
          )}
        </div>
      )}
    </>
  );
}

/* ===== Chat Tab ===== */
interface ChatTabProps {
  initialContext?: ImportedRecipeContext | null;
}

function ChatTab({ initialContext }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // When arriving from ImportTab with a recipe context, pre-fill a customization request
  useEffect(() => {
    if (!initialContext || initializedRef.current) return;
    initializedRef.current = true;
    const prompt = `I just imported a community recipe called "${initialContext.name}". Here is the profile JSON:\n\n\`\`\`json\n${initialContext.jsonText}\n\`\`\`\n\nPlease analyze this profile and suggest how I can customize it to suit my taste. Consider: adjusting temperature, pressure phases, and timing for better extraction. Ask me about my preferences if needed.`;
    setInput(prompt);
  }, [initialContext]);

  const handleApplyRecipe = async (content: string, index: number) => {
    setSavingIndex(index);
    setSaveError(null);
    setSavedIndex(null);
    try {
      const recipeName = `チャットレシピ ${new Date().toLocaleString("ja-JP")}`;
      const jsonText = JSON.stringify({
        suggestion: content,
        generated_at: new Date().toISOString(),
      });
      await importRecipeRaw({ name: recipeName, json_text: jsonText, source: "チャット生成" });
      setSavedIndex(index);
      saveTimerRef.current = setTimeout(() => setSavedIndex(null), 3000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
    }
    setSavingIndex(null);
  };

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
            {msg.role === "assistant" && (
              <div style={{ marginTop: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleApplyRecipe(msg.content, i)}
                  disabled={savingIndex === i}
                  style={{ fontSize: 12, padding: "4px 12px" }}
                >
                  {savingIndex === i ? "保存中..." : "レシピ適用"}
                </button>
                {savedIndex === i && (
                  <SaveBanner message="保存しました！Recipesページで確認できます" />
                )}
                {saveError && savingIndex === null && savedIndex === null && (
                  <p style={{ color: "var(--accent)", marginTop: 4, fontSize: 12 }}>エラー: {saveError}</p>
                )}
              </div>
            )}
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

interface GaggiMatePhase {
  name?: string;
  pressure?: number;
  duration?: number;
  target_pressure?: number;
  time?: number;
  [key: string]: unknown;
}

interface GaggiMateProfile {
  label?: string;
  name?: string;
  temperature?: number;
  phases?: GaggiMatePhase[];
  [key: string]: unknown;
}

function parseProfile(text: string): { profile: GaggiMateProfile; valid: boolean } | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    const hasPhases = Array.isArray((parsed as GaggiMateProfile).phases);
    return { profile: parsed as GaggiMateProfile, valid: hasPhases };
  } catch {
    return null;
  }
}

interface ImportTabProps {
  onCustomize: (ctx: ImportedRecipeContext) => void;
}

function ImportTab({ onCustomize }: ImportTabProps) {
  const [name, setName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [source, setSource] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [importedJson, setImportedJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<{ profile: GaggiMateProfile; valid: boolean } | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    setResult(null);
    setError(null);
    if (!text.trim()) {
      setParseResult(null);
      setJsonError(null);
      return;
    }
    const parsed = parseProfile(text);
    if (parsed === null) {
      setParseResult(null);
      setJsonError("無効なJSONです。正しいJSON形式で入力してください。");
    } else {
      setParseResult(parsed);
      setJsonError(null);
      // Auto-fill name from label/name if not yet set by user
      const candidate = parsed.profile.label ?? parsed.profile.name;
      if (candidate && typeof candidate === "string" && !name.trim()) {
        setName(candidate);
      }
    }
  };

  const handleImport = async () => {
    if (!name.trim() || !jsonText.trim() || !parseResult) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const savedName = name.trim();
      const savedJson = jsonText;
      await importRecipeRaw({
        name: savedName,
        json_text: jsonText,
        source: source.trim() || undefined,
      });
      setResult("インポート成功！レシピが保存されました。");
      setImportedName(savedName);
      setImportedJson(savedJson);
      setName("");
      setJsonText("");
      setSource("");
      setParseResult(null);
      setJsonError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "インポートに失敗しました");
    }
    setLoading(false);
  };

  const canImport = !loading && name.trim().length > 0 && parseResult !== null;

  return (
    <div className="card">
      <h3>コミュニティレシピインポート</h3>
      <p style={{ color: "var(--text-muted)", marginBottom: 16, fontSize: 14 }}>
        GaggiMate プロファイル JSON を貼り付けてインポートできます（Discord などで共有されたものに対応）
      </p>

      {/* JSON Paste Area */}
      <div className="form-group">
        <label>プロファイル JSON</label>
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          placeholder={'{\n  "label": "My Profile",\n  "temperature": 93,\n  "phases": [...]\n}'}
          style={{ minHeight: 180, fontFamily: "monospace", fontSize: 13 }}
        />
        {jsonError && (
          <p style={{ color: "var(--accent)", marginTop: 4, fontSize: 13 }}>{jsonError}</p>
        )}
        {parseResult && !parseResult.valid && (
          <p style={{ color: "var(--yellow, #f0c040)", marginTop: 4, fontSize: 13 }}>
            有効な JSON ですが <code>phases</code> 配列が見つかりません。このまま保存できます。
          </p>
        )}
        {parseResult?.valid && (
          <p style={{ color: "var(--green)", marginTop: 4, fontSize: 13 }}>✓ 有効な GaggiMate プロファイルです</p>
        )}
      </div>

      {/* Preview */}
      {parseResult?.valid && (
        <div style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 16,
          marginBottom: 16,
        }}>
          <h4 style={{ marginBottom: 12, fontSize: 14 }}>プレビュー</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", marginBottom: 12, fontSize: 14 }}>
            {(parseResult.profile.label || parseResult.profile.name) && (
              <div>
                <span style={{ color: "var(--text-muted)" }}>ラベル: </span>
                <strong>{parseResult.profile.label ?? parseResult.profile.name}</strong>
              </div>
            )}
            {parseResult.profile.temperature !== undefined && (
              <div>
                <span style={{ color: "var(--text-muted)" }}>温度: </span>
                <strong>{parseResult.profile.temperature}°C</strong>
              </div>
            )}
          </div>
          {Array.isArray(parseResult.profile.phases) && parseResult.profile.phases.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>フェーズ</div>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--text-muted)", fontWeight: 400 }}>名前</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--text-muted)", fontWeight: 400 }}>圧力</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--text-muted)", fontWeight: 400 }}>時間</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.profile.phases.map((phase, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px" }}>{phase.name ?? `フェーズ ${i + 1}`}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {phase.pressure !== undefined ? `${phase.pressure} bar` :
                          phase.target_pressure !== undefined ? `${phase.target_pressure} bar` : "—"}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {phase.duration !== undefined ? `${phase.duration}s` :
                          phase.time !== undefined ? `${phase.time}s` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recipe Name */}
      <div className="form-group">
        <label>レシピ名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: Community Turbo Shot"
        />
      </div>

      {/* Source */}
      <div className="form-group">
        <label>ソース（任意）</label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="例: Discord #profiles / GaggiMate Community"
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={handleImport}
        disabled={!canImport}
        style={{ width: "100%" }}
      >
        {loading ? "インポート中..." : "インポート"}
      </button>

      {error && <p style={{ color: "var(--accent)", marginTop: 12 }}>エラー: {error}</p>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: "var(--green)", marginBottom: 12 }}>{result}</p>
          <div style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>次のステップ</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                このレシピをLLMで自分向けにカスタマイズできます。過去のショットデータや好みに合わせた調整をAIが提案します。
              </div>
            </div>
            <div className="flex gap-8">
              <Link to="/recipes" style={{ flex: 1 }}>
                <button className="btn btn-secondary" style={{ width: "100%" }}>
                  Recipesで確認 →
                </button>
              </Link>
              {importedName && importedJson && (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => onCustomize({ name: importedName, jsonText: importedJson })}
                >
                  LLMでカスタマイズ →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
