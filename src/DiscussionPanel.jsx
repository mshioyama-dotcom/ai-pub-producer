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
// ユーザー往復1 + AI往復1 = 1ターン。MAX_TURNS=10なら 20メッセージで打ち切り。
//
// 設計判断（履歴）:
// - 当初 5往復 → Anthropic Prompt Caching 有効化により1往復コスト$0.10→$0.02に削減
// - キャッシュ後は10往復でも$0.20程度なので、議論の質を優先して10に緩和
// - サブスクのTier別に動的化する場合は props で受け取る形に変更予定
//   （例: Lite=5, Standard=10, Pro=20）
const MAX_TURNS = 10;

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
  onRegenerateWithRequest,     // Phase 2: 議論ログを要約してSTEP本体を再生成する関数 (improvementRequest: string) => Promise
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
  // Phase 2: 「✨ この方針で再生成」ボタン用の状態
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratePhase, setRegeneratePhase] = useState(""); // "summarizing" | "regenerating" | ""
  // STEP4専用: 案ごとのフォーカス（"" = 全案、"1" | "2" | "3" = 該当案のみブラッシュアップ対象）
  // 改善要望に「この再生成は案◯のみが対象」を強制付加し、AIが他案を新規生成しないよう誘導する。
  const [focusedCase, setFocusedCase] = useState("");
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
    // ユーザーメッセージを楽観的に追加（送信中の見た目用）。エラー時はrollbackする。
    const userMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
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
        // エラー時はユーザーメッセージをロールバック（ターン数も消費しない）
        setMessages((prev) => prev.filter((m) => m !== userMessage));
        setInput(text); // 入力欄に戻して再試行を容易にする
        setError(data.error || "送信に失敗しました。");
      } else {
        if (data.conversation_id) setConversationId(data.conversation_id);
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer || "" }]);
      }
    } catch (e) {
      // 通信エラー時もロールバック
      setMessages((prev) => prev.filter((m) => m !== userMessage));
      setInput(text);
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

  // 「直近のAI回答を出力データへ転記」機能は削除。
  // 理由: AIの自然文回答（例: 議論の要約や提案）をそのまま出力textareaに入れると、
  // 3案構造などのフォーマットが崩壊するため危険。
  // ✨「この方針で再生成」がフォーマット保証付きの正式な反映手段。
  // クリップボードコピー（↓コピー）は引き続き利用可能。
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

  // Phase 2: 「✨ この方針で再生成」ボタン
  // 議論ログをAIに要約させ、それを improvement_request として STEP本体の再生成APIに渡す
  // インライン確認パネル（pendingSummary state）を使って、ブラウザのconfirm()ダイアログ依存を排除
  const [pendingSummary, setPendingSummary] = useState(null);

  const handleRegenerate = async () => {
    if (!onRegenerateWithRequest) return;
    if (!hasAssistantMessage) {
      setError("先にAIと議論してから再生成してください。");
      return;
    }
    if (!stepOutput || !stepOutput.trim()) {
      setError("再生成には前回の出力が必要です。先にSTEPを実行して出力を生成してください。");
      return;
    }

    setError("");
    setRegenerating(true);
    setRegeneratePhase("summarizing");

    try {
      // Step 1: 議論ログをAIに要約させる（discussion Chatflowに対して「まとめて」と指示）
      const summarizeRequest = "ここまでの議論を踏まえ、再生成用の改善要望を1段落で整理してください。" +
        "形式は『どの部分を、どう修正するか』を明確に書く。" +
        "変更しない案・部分には『そのまま維持』と明示する。" +
        "あなたの返答全文がそのまま改善要望テキストとして使われるので、前置きや確認の問いかけは含めず、改善要望本文のみを返してください。";

      const summarizeResponse = await fetch("/api/discuss", {
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
          message: summarizeRequest,
          conversationId,
        }),
      });
      const summarizeData = await summarizeResponse.json();
      if (!summarizeResponse.ok) {
        throw new Error(summarizeData.error || "要約に失敗しました");
      }
      const improvementRequest = (summarizeData.answer || "").trim();
      if (!improvementRequest) {
        throw new Error("AIからの要約が空でした");
      }
      // 議論ログにも追加（ユーザーから見える形にする）
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "[システム] この方針で再生成します", _system: true },
        { role: "assistant", content: improvementRequest, _summary: true },
      ]);
      if (summarizeData.conversation_id) setConversationId(summarizeData.conversation_id);

      // Step 2: インライン確認パネルを表示（confirm() ではなく state で制御）
      setPendingSummary(improvementRequest);
      setRegenerating(false);  // 一旦ローディング解除（ユーザー入力待ち）
      setRegeneratePhase("");
    } catch (e) {
      setError(`要約中にエラー：${e.message}`);
      setRegenerating(false);
      setRegeneratePhase("");
    }
  };

  // ユーザーがインライン確認パネルで「OK」を押したときの処理
  const handleConfirmRegenerate = async () => {
    if (!pendingSummary) return;
    let improvementRequest = pendingSummary;

    // STEP4 フォーカスモード: 「案◯のみブラッシュアップ」が指定されている場合、
    // 改善要望の冒頭に強い指示を追加して、AIが他案を勝手に変えないようにする。
    if (stepNum === 4 && focusedCase) {
      const focusDirective = `【再生成スコープ：案${focusedCase}のみ】\n` +
        `この再生成は案${focusedCase}だけが対象です。改善要望機構の手順に従い、案${focusedCase}以外（案1・案${focusedCase === "1" ? "2" : "1"}以外の他案）は前回出力からそのままコピーして一字も変更しないでください。修正対象は案${focusedCase}のみです。\n\n` +
        `[ユーザーとAIで合意した改善方針]\n${pendingSummary}`;
      improvementRequest = focusDirective;
    }

    setPendingSummary(null);
    setRegenerating(true);
    setRegeneratePhase("regenerating");
    try {
      await onRegenerateWithRequest(improvementRequest);
      const focusedLabel = stepNum === 4 && focusedCase ? `案${focusedCase}のみ` : "";
      setApplyMsg(focusedLabel
        ? `✓ ${focusedLabel}を再生成しました（出力データを確認してください）`
        : "✓ 再生成が完了しました（出力データを確認してください）");
      setTimeout(() => setApplyMsg(""), 4000);
    } catch (e) {
      setError(`再生成中にエラー：${e.message}`);
    } finally {
      setRegenerating(false);
      setRegeneratePhase("");
    }
  };

  const handleCancelRegenerate = () => {
    setPendingSummary(null);
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

          {/* STEP4専用: 案ごとのフォーカスモード（軽量版・改善要望への自動付加だけ） */}
          {stepNum === 4 && onRegenerateWithRequest && (
            <div style={{
              padding: "8px 12px",
              background: focusedCase ? C.goldPale : "#f8f8f8",
              border: `1px solid ${focusedCase ? C.goldLight : C.border}`,
              borderRadius: 4,
              marginBottom: 10,
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}>
              <span style={{ fontWeight: 700, color: C.navy }}>🎯 ブラッシュアップ対象：</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="radio" name={`focus-${stepNum}`} value="" checked={focusedCase === ""}
                  onChange={() => setFocusedCase("")} disabled={regenerating} />
                <span>全案</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="radio" name={`focus-${stepNum}`} value="1" checked={focusedCase === "1"}
                  onChange={() => setFocusedCase("1")} disabled={regenerating} />
                <span>案1のみ</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="radio" name={`focus-${stepNum}`} value="2" checked={focusedCase === "2"}
                  onChange={() => setFocusedCase("2")} disabled={regenerating} />
                <span>案2のみ</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="radio" name={`focus-${stepNum}`} value="3" checked={focusedCase === "3"}
                  onChange={() => setFocusedCase("3")} disabled={regenerating} />
                <span>案3のみ</span>
              </label>
              {focusedCase && (
                <span style={{ fontSize: 11, color: C.gold, marginLeft: "auto" }}>
                  ✨再生成時は案{focusedCase}にだけ集中します（他案は維持）
                </span>
              )}
            </div>
          )}

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

          {/* 再生成中の進捗バナー（目立つように） */}
          {regenerating && (
            <div style={{
              padding: "12px 14px",
              background: "#fff8e7",
              border: `1px solid ${C.gold}`,
              borderRadius: 6,
              marginBottom: 10,
              fontSize: 13.5,
              color: C.navy,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>{regeneratePhase === "summarizing" ? "📝" : "🔄"}</span>
              <span>
                {regeneratePhase === "summarizing"
                  ? "議論を要約しています...（数秒）"
                  : "STEP本体を再生成しています...（30秒〜1分）"}
              </span>
            </div>
          )}

          {/* インライン確認パネル：要約完了後にここで「再生成する／キャンセル」を選ぶ */}
          {pendingSummary && (
            <div style={{
              padding: 14,
              background: "#fff8e7",
              border: `2px solid ${C.gold}`,
              borderRadius: 6,
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                ✨ 以下の改善要望でSTEP{stepNum}「{stepName}」を再生成します
              </div>
              <div style={{
                fontSize: 12.5,
                color: C.text,
                lineHeight: 1.7,
                background: C.white,
                padding: "10px 12px",
                borderRadius: 4,
                border: `1px solid ${C.border}`,
                marginBottom: 10,
                maxHeight: 180,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}>
                {pendingSummary}
              </div>
              <div style={{ fontSize: 11.5, color: C.textSub, marginBottom: 10, lineHeight: 1.6 }}>
                ⚠ 既存の出力データは上書きされます。必要なら事前に「出力をコピー」しておいてください。
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleConfirmRegenerate}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.white,
                    background: C.navy,
                    border: "none",
                    borderRadius: 3,
                    padding: "9px 22px",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(36,61,92,0.25)",
                  }}
                >
                  ✓ 再生成する
                </button>
                <button
                  onClick={handleCancelRegenerate}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.navy,
                    background: C.white,
                    border: `1px solid ${C.navy}`,
                    borderRadius: 3,
                    padding: "9px 18px",
                    cursor: "pointer",
                  }}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* 成功時の通知バナー（目立つように） */}
          {!regenerating && applyMsg && applyMsg.includes("再生成が完了") && (
            <div style={{
              padding: "12px 14px",
              background: "#e8f5e9",
              border: `1px solid ${C.green}`,
              borderRadius: 6,
              marginBottom: 10,
              fontSize: 13.5,
              color: C.green,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <span>{applyMsg} ↑ 上の出力データ欄を確認してください</span>
            </div>
          )}

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
              {/* Phase 2: メインアクション「✨ この方針で再生成」 */}
              {/* onRegenerateWithRequest が供給されている場合のみ表示。STEP本体を改善要望付きで再実行する */}
              {onRegenerateWithRequest && (
                <button
                  onClick={handleRegenerate}
                  disabled={!hasAssistantMessage || regenerating}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: (!hasAssistantMessage || regenerating) ? C.textLight : C.white,
                    background: (!hasAssistantMessage || regenerating) ? "rgba(0,0,0,0.06)" : C.navy,
                    border: "none",
                    borderRadius: 3,
                    padding: "9px 20px",
                    cursor: (!hasAssistantMessage || regenerating) ? "default" : "pointer",
                    boxShadow: (!hasAssistantMessage || regenerating) ? "none" : "0 2px 4px rgba(36,61,92,0.25)",
                  }}
                >
                  {regenerating
                    ? (regeneratePhase === "summarizing" ? "📝 議論を要約中..." : "🔄 再生成中...")
                    : "✨ この方針で再生成"}
                </button>
              )}

              {/* サブアクション：改善要望欄へ転記 or クリップボードコピー */}
              <button
                onClick={handleApply}
                disabled={!hasAssistantMessage || regenerating}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: (!hasAssistantMessage || regenerating) ? C.textLight : C.navy,
                  background: (!hasAssistantMessage || regenerating) ? "rgba(0,0,0,0.04)" : C.white,
                  border: `1px solid ${(!hasAssistantMessage || regenerating) ? C.border : C.navy}`,
                  borderRadius: 3,
                  padding: "7px 14px",
                  cursor: (!hasAssistantMessage || regenerating) ? "default" : "pointer",
                }}
              >
                {onApplyToImprovementRequest ? "↓ 改善要望欄へ転記" : "↓ コピー"}
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
