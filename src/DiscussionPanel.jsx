// DiscussionPanel
// 各STEPの出力エリア下に表示する「この出力について相談する」共通チャットパネル。
// /api/discuss を叩き、Difyの「STEP_共通_出力相談」Chatflowと対話する。
//
// 使い方:
//   <DiscussionPanel
//     stepNum={4}
//     stepName="タイトル・サブタイトル作成"
//     stepOutput={outputText}
//     stepInputSummary="kw1: ~~ / kw2: ~~ / 差分要素: ~~"  (任意)
//     stepRules={STEP_RULES_EXCERPT[4]}                    (任意)
//     authorProfile={savedAuthorProfile}
//     workProfile={savedWorkProfile}
//     onApplyToImprovementRequest={(text) => setImprovementRequest(text)}  (任意・Phase 2用)
//   />

import { useState, useRef, useEffect } from "react";

// 1スレッドあたりの最大往復数（コスト管理のため）
// ユーザー往復1 + AI往復1 = 1ターン。MAX_TURNS=5なら 10メッセージで打ち切り。
// サブスクのプランごとに動的に変えられるよう、将来は props で受け取る想定。
const MAX_TURNS = 5;

// 色トークン（App.jsxと同期）
const C = {
  navy:       "#243d5c",
  navyLight:  "#e8eef5",
  gold:       "#b8922a",
  goldLight:  "#f0d98a",
  goldPale:   "#fdf6e3",
  white:      "#ffffff",
  border:     "#d0cac0",
  text:       "#1a1a1a",
  textSub:    "#444444",
  textLight:  "#777777",
  green:      "#1e6b3a",
  red:        "#b52b1e",
};

// localStorage キー（プロジェクト×STEP単位）
function discussionStorageKey(projectId, stepNum) {
  return `discussion_${projectId || "default"}_step${stepNum}`;
}

export default function DiscussionPanel({
  stepNum,
  stepName,
  stepOutput,
  stepInputSummary = "",
  stepRules = "",
  authorProfile = "",
  workProfile = "",
  projectId = "",
  onApplyToImprovementRequest, // 任意（Phase 2用）
  onTransferToOutput,          // 任意：直近のAI回答を出力データへ転記する関数
}) {
  const storageKey = discussionStorageKey(projectId, stepNum);

  // localStorage から復元
  const initialState = (() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { messages: [], conversationId: "" };
      const parsed = JSON.parse(raw);
      return {
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        conversationId: parsed.conversationId || "",
      };
    } catch {
      return { messages: [], conversationId: "" };
    }
  })();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(initialState.messages);
  const [conversationId, setConversationId] = useState(initialState.conversationId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applyMsg, setApplyMsg] = useState("");
  const chatAreaRef = useRef(null);

  // STEP変更時に状態を読み直す
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setMessages([]); setConversationId("");
      } else {
        const parsed = JSON.parse(raw);
        setMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
        setConversationId(parsed.conversationId || "");
      }
    } catch {
      setMessages([]); setConversationId("");
    }
    setInput(""); setError(""); setApplyMsg("");
  }, [storageKey]);

  // メッセージ追加時に永続化
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ messages, conversationId }));
    } catch (e) { /* 容量超過時はサイレントに失敗 */ }
  }, [storageKey, messages, conversationId]);

  // メッセージ追加時にスクロール
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const hasOutput = !!(stepOutput || "").trim();

  // ターン数管理（コスト制御）
  // user メッセージの数 = 既に消費したターン数。AI返信が来てなくてもユーザー発言時点でターン消費とみなす。
  const turnsUsed = messages.filter((m) => m.role === "user").length;
  const turnsLeft = Math.max(0, MAX_TURNS - turnsUsed);
  const turnLimitReached = turnsLeft === 0;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!hasOutput) {
      setError("先に出力データを生成・保存してから相談してください。");
      return;
    }
    if (turnLimitReached) {
      setError(`このスレッドは上限の${MAX_TURNS}往復に達しました。続けて相談したい場合は、相談履歴をリセットしてから新しいスレッドを開始してください。`);
      return;
    }

    setError("");
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const response = await fetch("/api/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepNum,
          stepName,
          stepRules,
          stepInputSummary,
          stepOutput,
          authorProfile,
          workProfile,
          message: text,
          conversationId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "送信に失敗しました。");
      } else {
        if (data.conversation_id) setConversationId(data.conversation_id);
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer || "" }]);
      }
    } catch (e) {
      setError(`通信エラーが発生しました：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (!confirm("この相談スレッドを削除して新しく始めますか？")) return;
    setMessages([]); setConversationId(""); setInput(""); setError(""); setApplyMsg("");
    try { localStorage.removeItem(storageKey); } catch (e) {}
  };

  // AIの直近の発言を取得するヘルパー
  const getLastAIContent = () => {
    const lastAI = [...messages].reverse().find((m) => m.role === "assistant");
    return lastAI ? lastAI.content : "";
  };
  const hasAssistantMessage = messages.some((m) => m.role === "assistant");

  // 直近のAI回答を出力データへ直接転記（既存の出力を上書き）
  const handleTransferToOutput = () => {
    const content = getLastAIContent();
    if (!content || !onTransferToOutput) return;
    if (stepOutput && stepOutput.trim()) {
      if (!confirm("既存の出力データを上書きします。よろしいですか？\n\n（コピー履歴は手動で別途残してください）")) return;
    }
    onTransferToOutput(content);
    setApplyMsg("✓ 出力データへ転記しました（保存ボタンで確定してください）");
    setTimeout(() => setApplyMsg(""), 3500);
  };

  // 改善要望欄へ転記（Phase 2用 / 現状はpropsが未供給ならクリップボードコピーにフォールバック）
  const handleApply = () => {
    const content = getLastAIContent();
    if (!content) return;
    if (onApplyToImprovementRequest) {
      onApplyToImprovementRequest(content);
      setApplyMsg("✓ 改善要望欄に転記しました");
    } else {
      navigator.clipboard.writeText(content).then(() => {
        setApplyMsg("✓ クリップボードにコピーしました");
      });
    }
    setTimeout(() => setApplyMsg(""), 2500);
  };

  // 折りたたみ時のヘッダー表示
  const headerLabel = messages.length > 0
    ? `💬 この出力について相談する（${Math.ceil(messages.length / 2)}往復中）`
    : "💬 この出力について相談する";

  return (
    <div style={{ marginTop: 24, marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 6, background: C.white }}>
      {/* ヘッダー（クリックで開閉） */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "12px 16px",
          background: messages.length > 0 ? C.goldPale : "#f8f8f8",
          borderBottom: open ? `1px solid ${C.border}` : "none",
          borderRadius: open ? "6px 6px 0 0" : 6,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>
          {headerLabel}
        </div>
        <div style={{ fontSize: 12, color: C.textSub }}>
          {open ? "▲ 閉じる" : "▼ 開く"}
        </div>
      </div>

      {open && (
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>
            生成された出力について、AIに相談しながら改善方針を一緒に練れます。違和感を感じた点を自由に書いてください（例：「案2の『ベストセラー』はKDP規約的に大丈夫？」「案3のターゲットがぼやけている気がする」）。
          </div>

          {/* ターン数表示（コスト管理のため上限付き） */}
          <div style={{
            fontSize: 12, color: turnLimitReached ? C.red : C.textLight,
            background: turnLimitReached ? "#fef2f2" : "#f8f8f8",
            border: `1px solid ${turnLimitReached ? "rgba(192,57,43,0.25)" : C.border}`,
            borderRadius: 4, padding: "6px 10px", marginBottom: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>
              {turnLimitReached
                ? `⚠ このスレッドは上限の${MAX_TURNS}往復に達しました。リセットして新しいスレッドを開始してください。`
                : `📊 残り ${turnsLeft} / ${MAX_TURNS} 往復`}
            </span>
            <span style={{ fontSize: 11, color: C.textLight }}>
              ※ コスト管理のため1スレッド{MAX_TURNS}往復までです
            </span>
          </div>

          {!hasOutput && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red }}>
              先に出力データを生成・保存してから相談してください。
            </div>
          )}

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", background: C.white }}>
            {/* メッセージ表示エリア */}
            <div
              ref={chatAreaRef}
              style={{
                height: 320,
                overflowY: "auto",
                padding: "16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: C.navyLight,
              }}
            >
              {messages.length === 0 && (
                <div style={{ fontSize: 13, color: C.textLight, textAlign: "center", marginTop: 60, lineHeight: 1.7 }}>
                  気になる点を入力して送信してください
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ fontSize: 11, color: C.textLight, marginBottom: 3, paddingLeft: msg.role === "user" ? 0 : 4, paddingRight: msg.role === "user" ? 4 : 0 }}>
                    {msg.role === "user" ? "あなた" : "AI"}
                  </div>
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "10px 14px",
                      borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                      background: msg.role === "user" ? C.navy : C.white,
                      color: msg.role === "user" ? C.white : C.text,
                      fontSize: 13.5,
                      lineHeight: 1.75,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      border: msg.role === "user" ? "none" : `1px solid ${C.border}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <div style={{ padding: "10px 16px", borderRadius: "12px 12px 12px 3px", background: C.white, border: `1px solid ${C.border}`, fontSize: 13, color: C.textLight }}>
                    考え中...
                  </div>
                </div>
              )}
            </div>

            {/* エラー表示 */}
            {error && (
              <div style={{ padding: "8px 14px", background: "#fef2f2", borderTop: `1px solid rgba(192,57,43,0.2)`, fontSize: 12.5, color: C.red }}>
                {error}
              </div>
            )}

            {/* 入力エリア */}
            <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: C.white }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={turnLimitReached
                  ? `上限の${MAX_TURNS}往復に達しました。リセットしてください`
                  : "気になる点を入力（Enterで送信 / Shift+Enterで改行）"}
                rows={3}
                disabled={!hasOutput || turnLimitReached}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  fontSize: 13.5,
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.65,
                  boxSizing: "border-box",
                  background: (!hasOutput || turnLimitReached) ? "#f5f5f5" : C.white,
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim() || !hasOutput || turnLimitReached}
                style={{
                  width: 80,
                  background: (loading || !input.trim() || !hasOutput || turnLimitReached) ? "#ccc" : C.navy,
                  color: C.white,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: (loading || !input.trim() || !hasOutput || turnLimitReached) ? "default" : "pointer",
                  flexShrink: 0,
                }}
              >
                送信
              </button>
            </div>
          </div>

          {/* アクションボタン群 */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* メインアクション：出力データへ転記（onTransferToOutputが供給されていれば） */}
              {onTransferToOutput && (
                <button
                  onClick={handleTransferToOutput}
                  disabled={!hasAssistantMessage}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: hasAssistantMessage ? C.white : C.textLight,
                    background: hasAssistantMessage ? C.gold : "rgba(0,0,0,0.06)",
                    border: "none",
                    borderRadius: 3,
                    padding: "8px 18px",
                    cursor: hasAssistantMessage ? "pointer" : "default",
                  }}
                >
                  ↓ 直近のAI回答を出力データへ転記
                </button>
              )}

              {/* サブアクション：改善要望欄へ転記 or クリップボードコピー */}
              <button
                onClick={handleApply}
                disabled={!hasAssistantMessage}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: hasAssistantMessage ? C.navy : C.textLight,
                  background: hasAssistantMessage ? C.white : "rgba(0,0,0,0.04)",
                  border: `1px solid ${hasAssistantMessage ? C.navy : C.border}`,
                  borderRadius: 3,
                  padding: "7px 14px",
                  cursor: hasAssistantMessage ? "pointer" : "default",
                }}
              >
                {onApplyToImprovementRequest ? "↓ 改善要望欄へ転記" : "↓ クリップボードにコピー"}
              </button>

              {applyMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{applyMsg}</span>}
            </div>
            <div>
              <button
                onClick={handleReset}
                disabled={messages.length === 0}
                style={{
                  fontSize: 12,
                  color: messages.length === 0 ? "#aaa" : C.textLight,
                  background: "none",
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  padding: "4px 10px",
                  cursor: messages.length === 0 ? "default" : "pointer",
                }}
              >
                相談履歴をリセット
              </button>
              <span style={{ fontSize: 11.5, color: C.textLight, marginLeft: 8 }}>
                別の方向性で相談したい時はリセットしてください
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
