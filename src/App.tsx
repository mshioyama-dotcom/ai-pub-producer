import { useState, useCallback } from "react";

const STEPS = [
  { id:"step_01",num:1,title:"テーマ発見インタビュー",description:"書きたいテーマをもとに、気になる2語の候補を見つけます",category:"企画設計",type:"chat",url:"https://udify.app/chat/cii6zTpOFc29rvVw",inputs:[{name:"user_chat_input",label:"テーマ・関心領域",desc:"書きたいテーマ、想定読者、読者の悩みなどを会話で伝えてください",source:null,required:true,type:"textarea"}],outputTitle:"候補メモ",help:["最初から正解を1つに絞る必要はありません","まず幅広く候補を出してから、しっくりくる方向へ絞っていきます"]},
  { id:"step_02",num:2,title:"市場勝率診断",description:"選んだ2語でKindle市場の勝率を診断します",category:"企画設計",type:"workflow",url:"https://udify.app/workflow/x0Ce5PCv2FjEaFs4",inputs:[{name:"keyword1",label:"1つ目のキーワード",desc:"テーマ発見で選んだ1語目",source:"STEP1",required:true,type:"text"},{name:"keyword2",label:"2つ目のキーワード",desc:"テーマ発見で選んだ2語目",source:"STEP1",required:true,type:"text"},{name:"amazon_html",label:"Amazon検索結果のHTMLソース",desc:"AmazonでKindle検索した結果ページのHTMLソースを貼り付け",source:null,required:true,type:"textarea"}],outputTitle:"診断結果",help:["HTML取得：検索結果ページで右クリック→「ページのソースを表示」→全選択してコピー","HTMLが大きすぎる場合は「Amazon HTML Cleaner」で軽量化してください"]},
  { id:"step_03",num:3,title:"読者・価値設計",description:"読者の悩み、詰まり、到達点、章構造を設計します",category:"企画設計",type:"workflow",url:"https://udify.app/workflow/V0yHio0PcP42yJjQ",inputs:[{name:"keyword1",label:"検索キーワード1",desc:"市場診断で確定した1語目",source:"STEP2",required:true,type:"text"},{name:"keyword2",label:"検索キーワード2",desc:"市場診断で確定した2語目",source:"STEP2",required:true,type:"text"},{name:"intent_lock",label:"検索意図仮説",desc:"読者が何を知りたくて検索するかの仮説",source:"STEP2",required:true,type:"textarea"},{name:"market_report",label:"狙い目切り口（任意）",desc:"市場診断で見つけた狙い目の切り口",source:"STEP2",required:false,type:"textarea"}],outputTitle:"設計結果",help:["章数はデフォルト7章で生成されます"]},
  { id:"step_04",num:4,title:"エピソードインタビュー",description:"あなたの体験から差別化につながる素材を整理します",category:"企画設計",type:"chat",url:"https://udify.app/chat/qbB9SNU5UG3gryYp",inputs:[{name:"blueprint_text",label:"読者・価値設計のアウトプット",desc:"読者・価値設計の出力を全文コピーして最初に貼り付けてください",source:"STEP3",required:true,type:"textarea"}],outputTitle:"インタビュー要約",help:["AIは1回に1つだけ質問します。焦らず具体的に答えてください"]},
  { id:"step_05",num:5,title:"タイトル・サブタイトル作成",description:"検索性とクリック率を両立したタイトル案を作成します",category:"企画設計",type:"workflow",url:"https://udify.app/workflow/z7djuT4RLqfAbEqY",inputs:[{name:"keyword1",label:"検索キーワード1",desc:"確定した1語目",source:"STEP2",required:true,type:"text"},{name:"keyword2",label:"検索キーワード2",desc:"確定した2語目",source:"STEP2",required:true,type:"text"},{name:"blueprint_text",label:"読者・価値設計のアウトプット",desc:"読者・価値設計の出力を全文貼り付け",source:"STEP3",required:true,type:"textarea"},{name:"interview_text",label:"エピソードインタビューのアウトプット",desc:"エピソードインタビューの出力を全文貼り付け",source:"STEP4",required:true,type:"textarea"}],outputTitle:"タイトル案",help:["キーワード2語はタイトル＋サブタイトル内に必ず含まれます"]},
  { id:"step_06",num:6,title:"目次作成",description:"章構造をもとに、具体的な節見出し付きの目次を作ります",category:"執筆設計",type:"workflow",url:"https://udify.app/workflow/tcqNIyr8wpCBAJhb",inputs:[{name:"blueprint_text",label:"読者・価値設計のアウトプット",desc:"読者・価値設計の出力を全文貼り付け",source:"STEP3",required:true,type:"textarea"},{name:"interview_text",label:"エピソードインタビューのアウトプット",desc:"エピソードインタビューの出力を全文貼り付け",source:"STEP4",required:true,type:"textarea"}],outputTitle:"完成目次",help:["「はじめに」と「おわりに」は自動的に付きます"]},
  { id:"step_07",num:7,title:"章構成作成",description:"目次の各節に要約を付けて、章ごとの構成案を作ります",category:"執筆設計",type:"workflow",url:"https://udify.app/workflow/4KDXsPKSlgk5qMu8",inputs:[{name:"toc_text",label:"目次作成のアウトプット",desc:"目次作成の出力を全文貼り付け",source:"STEP6",required:true,type:"textarea"},{name:"blueprint_text",label:"読者・価値設計のアウトプット",desc:"読者・価値設計の出力を全文貼り付け",source:"STEP3",required:true,type:"textarea"},{name:"interview_text",label:"エピソードインタビューのアウトプット",desc:"エピソードインタビューの出力を全文貼り付け",source:"STEP4",required:true,type:"textarea"}],outputTitle:"章構成",help:["全章を一括処理します"]},
  { id:"step_08",num:8,title:"詳細プロット作成",description:"1章分を本文執筆できる粒度まで分解します",category:"執筆設計",type:"workflow",url:"https://udify.app/workflow/Ka9gpeDvAnkPV9hW",inputs:[{name:"chapter_outline_text",label:"1章分のアウトライン",desc:"章構成作成の出力から1章分を切り出して貼り付け",source:"STEP7",required:true,type:"textarea"},{name:"added_episode_text",label:"著者が入れたいエピソード（任意）",desc:"この章に入れたい体験やエピソード",source:null,required:false,type:"textarea"}],outputTitle:"詳細プロット",help:["1章ずつ処理します"]},
  { id:"step_09",num:9,title:"本文作成",description:"指定した項の本文を1つずつ執筆します（600〜1000文字/項）",category:"執筆設計",type:"workflow",url:"https://udify.app/workflow/lRAWtZGuVL4bqHM9",inputs:[{name:"detailed_plot_text",label:"詳細プロット作成のアウトプット（1章分）",desc:"詳細プロット作成の出力を貼り付け",source:"STEP8",required:true,type:"textarea"},{name:"target_heading",label:"執筆対象の目次見出し",desc:"書きたい項の見出しを正確に入力",source:"STEP8",required:true,type:"text"},{name:"past_writing_text",label:"著者の過去の執筆データ（任意）",desc:"文体参考の過去原稿（最大3000字）",source:null,required:false,type:"textarea"}],outputTitle:"生成された本文",help:["見出しは詳細プロットから正確にコピーしてください"]},
  { id:"step_10",num:10,title:"Amazon説明文作成",description:"Amazonの商品ページに掲載する説明文を作ります",category:"販売準備",type:"workflow",url:"https://udify.app/workflow/6yWZfOGGU76ciJBI",inputs:[{name:"title_text",label:"タイトル",desc:"確定したメインタイトル",source:"STEP5",required:true,type:"text"},{name:"subtitle_text",label:"サブタイトル",desc:"確定したサブタイトル",source:"STEP5",required:true,type:"text"},{name:"blueprint_text",label:"読者・価値設計のアウトプット",desc:"読者・価値設計の出力を全文貼り付け",source:"STEP3",required:true,type:"textarea"},{name:"interview_text",label:"エピソードインタビューのアウトプット",desc:"エピソードインタビューの出力を全文貼り付け",source:"STEP4",required:true,type:"textarea"},{name:"outline_text",label:"章構成作成のアウトプット",desc:"章構成作成の出力を全文貼り付け",source:"STEP7",required:true,type:"textarea"},{name:"author_profile_text",label:"著者プロフィール（任意）",desc:"著者の経歴や実績",source:null,required:false,type:"textarea"}],outputTitle:"Amazon説明文",help:["「冒頭の読者像をもっと絞って」等と修正指示できます"]}
];

const CATEGORIES = [
  { label:"企画設計", steps:[1,2,3,4,5] },
  { label:"執筆設計", steps:[6,7,8,9] },
  { label:"販売準備", steps:[10] }
];

// --- 共通UI ---
const SrcLabel = ({source}) => source ? <span style={{fontSize:12,color:"#3b82f6",background:"rgba(59,130,246,0.07)",padding:"2px 7px",borderRadius:4}}>入力元：{source}</span> : null;
const Req = () => <span style={{color:"#ef4444",fontSize:12,marginLeft:4}}>必須</span>;
const BtnP = ({children,onClick,style}) => <button onClick={onClick} style={{padding:"9px 18px",background:"#2563eb",color:"#fff",border:"none",borderRadius:6,fontWeight:600,fontSize:13,cursor:"pointer",...style}}>{children}</button>;
const BtnS = ({children,onClick,style}) => <button onClick={onClick} style={{padding:"9px 18px",background:"rgba(0,0,0,0.04)",color:"#333",border:"1px solid rgba(0,0,0,0.1)",borderRadius:6,fontWeight:500,fontSize:13,cursor:"pointer",...style}}>{children}</button>;
const Card = ({children,style}) => <div style={{background:"#fff",borderRadius:10,border:"1px solid rgba(0,0,0,0.06)",padding:20,...style}}>{children}</div>;

// --- サイドメニュー ---
const SideMenu = ({page,nav}) => {
  const item = (label, p) => {
    const a = page===p;
    return <div key={p} onClick={()=>nav(p)} style={{padding:"9px 14px",marginBottom:2,borderRadius:7,cursor:"pointer",background:a?"rgba(37,99,235,0.08)":"transparent",color:a?"#2563eb":"#444",fontWeight:a?600:400,fontSize:13.5}}>{label}</div>;
  };
  return (
    <div style={{width:250,minWidth:250,height:"100vh",overflowY:"auto",background:"#f8f9fb",borderRight:"1px solid rgba(0,0,0,0.07)",display:"flex",flexDirection:"column",padding:"24px 12px",boxSizing:"border-box"}}>
      <div style={{padding:"0 14px",marginBottom:24}}>
        <div style={{fontSize:15,fontWeight:700,color:"#1a1a2e"}}>AI出版プロデューサー</div>
        <div style={{fontSize:11.5,color:"#888",marginTop:4}}>Kindle出版を10ステップで進める</div>
      </div>
      <div style={{fontSize:10.5,fontWeight:700,color:"#aaa",letterSpacing:"0.08em",padding:"0 14px",marginBottom:4}}>ホーム</div>
      {item("ダッシュボード","home")}
      {item("使い方","guide")}
      {CATEGORIES.map(cat=>(
        <div key={cat.label}>
          <div style={{fontSize:10.5,fontWeight:700,color:"#aaa",letterSpacing:"0.08em",padding:"0 14px",marginBottom:4,marginTop:16}}>{cat.label}</div>
          {cat.steps.map(n=>{const s=STEPS[n-1];return item(`STEP${n} ${s.title}`,`step_${n}`);})}
        </div>
      ))}
    </div>
  );
};

// --- ホーム ---
const HomePage = ({nav}) => (
  <div>
    <div style={{marginBottom:28}}>
      <h1 style={{fontSize:24,fontWeight:800,color:"#1a1a2e",margin:0}}>AI出版プロデューサー</h1>
      <p style={{fontSize:14,color:"#666",margin:"8px 0 0",lineHeight:1.6}}>10のツールで、テーマ発見から本文執筆・Amazon掲載まで進めます</p>
    </div>
    <h2 style={{fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:12}}>ステップ一覧</h2>
    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:28}}>
      {STEPS.map(s=>(
        <div key={s.id} onClick={()=>nav(`step_${s.num}`)} style={{display:"flex",alignItems:"center",padding:"12px 16px",background:"#fff",borderRadius:8,border:"1px solid rgba(0,0,0,0.06)",cursor:"pointer"}}>
          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:7,fontSize:13,fontWeight:700,background:"rgba(37,99,235,0.08)",color:"#2563eb",marginRight:14,flexShrink:0}}>{s.num}</span>
          <span style={{flex:1,fontSize:14,fontWeight:500,color:"#333"}}>{s.title}</span>
          <span style={{fontSize:12,color:"#aaa"}}>{s.category}</span>
          <span style={{marginLeft:12,fontSize:12,color:"#2563eb",fontWeight:500}}>開く →</span>
        </div>
      ))}
    </div>
    <Card style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.05)"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#555",margin:"0 0 8px"}}>このツールの考え方</h3>
      <ul style={{margin:0,paddingLeft:18,fontSize:13.5,color:"#666",lineHeight:1.8}}>
        <li>AI出版プロデューサーは素材を出すツール</li>
        <li>出力はそのまま使うことも、修正して使うこともできる</li>
        <li>修正は自分またはAIチャットで行う</li>
      </ul>
    </Card>
  </div>
);

// --- ステップページ ---
const StepPage = ({step,nav}) => {
  const [inputs,setInputs] = useState({});
  const [output,setOutput] = useState("");
  const [msg,setMsg] = useState("");
  const [helpOpen,setHelpOpen] = useState(false);

  const prev = step.num>1?STEPS[step.num-2]:null;
  const next = step.num<10?STEPS[step.num]:null;
  const copy = (t) => navigator.clipboard.writeText(t)
    .then(()=>{setMsg("コピーしました");setTimeout(()=>setMsg(""),2000);})
    .catch(()=>{setMsg("コピー失敗");setTimeout(()=>setMsg(""),2000);});

  return (
    <div>
      {/* ヘッダー */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:"#2563eb",marginBottom:4}}>STEP{step.num}</div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#1a1a2e",margin:"0 0 6px"}}>{step.title}</h1>
          <p style={{fontSize:14,color:"#666",margin:0}}>{step.description}</p>
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          {prev&&<BtnS onClick={()=>nav(`step_${prev.num}`)} style={{fontSize:12,padding:"7px 14px"}}>← STEP{prev.num}</BtnS>}
          {next&&<BtnS onClick={()=>nav(`step_${next.num}`)} style={{fontSize:12,padding:"7px 14px"}}>STEP{next.num} →</BtnS>}
        </div>
      </div>

      {/* Difyリンク */}
      <Card style={{marginBottom:20,background:"rgba(37,99,235,0.03)",border:"1px solid rgba(37,99,235,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#2563eb",marginBottom:2}}>{step.type==="chat"?"チャット（対話型）":"ワークフロー"}</div>
            <div style={{fontSize:12,color:"#888"}}>下のリンクからDifyツールを開いて実行してください</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
            <div style={{fontSize:12,color:"#555",background:"#f0f2f5",padding:"8px 12px",borderRadius:6,fontFamily:"monospace",wordBreak:"break-all",maxWidth:400}}>{step.url}</div>
            <button onClick={()=>navigator.clipboard.writeText(step.url).then(()=>alert("URLをコピーしました。ブラウザの新しいタブに貼り付けて開いてください。"))} style={{padding:"9px 18px",background:"#2563eb",color:"#fff",border:"none",borderRadius:7,fontWeight:600,fontSize:14,cursor:"pointer"}}>URLをコピー</button>
          </div>
        </div>
      </Card>

      {/* 入力 */}
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:14}}>入力</h2>
        {step.inputs.map(f=>(
          <div key={f.name} style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
              <label style={{fontSize:13.5,fontWeight:600,color:"#333"}}>{f.label}</label>
              {f.required&&<Req/>}
              <SrcLabel source={f.source}/>
            </div>
            <div style={{fontSize:12,color:"#888",marginBottom:6}}>{f.desc}</div>
            {f.type==="text"
              ? <input type="text" value={inputs[f.name]||""} onChange={e=>setInputs(p=>({...p,[f.name]:e.target.value}))} placeholder={f.label} style={{width:"100%",padding:"10px 12px",fontSize:14,border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,outline:"none",boxSizing:"border-box",background:"#fff"}}/>
              : <textarea value={inputs[f.name]||""} onChange={e=>setInputs(p=>({...p,[f.name]:e.target.value}))} placeholder={f.label} rows={f.name.includes("html")?6:4} style={{width:"100%",padding:"10px 12px",fontSize:14,border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit",background:"#fff"}}/>
            }
          </div>
        ))}
        <BtnS onClick={()=>copy(step.inputs.map(f=>`【${f.label}】\n${inputs[f.name]||""}`).join("\n\n"))}>入力内容をコピー</BtnS>
      </div>

      {/* 出力 */}
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:14}}>{step.outputTitle}</h2>
        <div style={{fontSize:12,color:"#888",marginBottom:8}}>Difyの出力をここに貼り付けてメモとして使えます（保存はされません）</div>
        <textarea value={output} onChange={e=>setOutput(e.target.value)} placeholder="Difyの出力をここに貼り付けてください" rows={10} style={{width:"100%",padding:"12px 14px",fontSize:14,border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit",background:"#fff",lineHeight:1.7}}/>
        <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
          <BtnP onClick={()=>copy(output)}>出力をコピー</BtnP>
          {next&&<BtnS onClick={()=>nav(`step_${next.num}`)} style={{background:"rgba(34,197,94,0.08)",color:"#16a34a",border:"1px solid rgba(34,197,94,0.2)"}}>STEP{next.num}へ進む →</BtnS>}
          {!next&&<BtnS onClick={()=>nav("home")} style={{background:"rgba(34,197,94,0.08)",color:"#16a34a",border:"1px solid rgba(34,197,94,0.2)"}}>完了 → ホームへ</BtnS>}
          {msg&&<span style={{fontSize:12,color:"#16a34a",fontWeight:500}}>{msg}</span>}
        </div>
      </div>

      {/* 操作のポイント */}
      {step.help?.length>0&&(
        <div>
          <div onClick={()=>setHelpOpen(!helpOpen)} style={{fontSize:13.5,fontWeight:600,color:"#555",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:"10px 0"}}>
            <span style={{transform:helpOpen?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.15s",display:"inline-block"}}>▶</span>
            操作のポイント
          </div>
          {helpOpen&&<Card style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.05)"}}>
            <ul style={{margin:0,paddingLeft:18,fontSize:13,color:"#666",lineHeight:1.8}}>
              {step.help.map((h,i)=><li key={i}>{h}</li>)}
            </ul>
          </Card>}
        </div>
      )}
    </div>
  );
};

// --- 使い方ページ ---
const GuidePage = ({nav}) => {
  const Sec = ({title,children}) => (
    <div style={{marginBottom:20}}>
      <h2 style={{fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:10}}>{title}</h2>
      <Card style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:13.5,color:"#555",lineHeight:1.8}}>{children}</div>
      </Card>
    </div>
  );
  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:800,color:"#1a1a2e",margin:"0 0 6px"}}>使い方</h1>
      <p style={{fontSize:14,color:"#666",marginBottom:24}}>AI出版プロデューサーの進め方</p>
      <Sec title="全体の流れ">
        <ul style={{margin:0,paddingLeft:18}}>
          <li>STEP1からSTEP10まで順番に進める</li>
          <li>前のステップの出力を次のステップの入力に使う</li>
          <li>各ステップでDifyリンクを開いて実行し、出力をコピーして次へ引き継ぐ</li>
        </ul>
      </Sec>
      <Sec title="出力の扱い方">
        <ul style={{margin:0,paddingLeft:18}}>
          <li>出力は素材。そのまま使うことも修正して使うこともできる</li>
          <li>修正は自分で直すか、AIチャットに貼り付けて指示する</li>
          <li>出力エリアはメモ用。ページを離れると消えるので必ずコピーして保管する</li>
        </ul>
      </Sec>
      <Sec title="市場勝率診断のHTML取得">
        <ol style={{margin:0,paddingLeft:18}}>
          <li>Amazonのカテゴリを「Kindleストア」に切り替えて検索</li>
          <li>検索結果ページで右クリック→「ページのソースを表示」</li>
          <li>Ctrl+A → Ctrl+C でコピー → 入力欄に貼り付け</li>
        </ol>
        <div style={{marginTop:8,fontSize:12.5,color:"#888"}}>大きすぎる場合は「Amazon HTML Cleaner」で軽量化</div>
      </Sec>
      <Sec title="全ツールURL">
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {STEPS.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
              <span style={{fontWeight:600,color:"#2563eb",minWidth:44}}>STEP{s.num}</span>
              <span style={{color:"#333",flex:1}}>{s.title}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{color:"#2563eb",fontSize:12}}>開く ↗</a>
            </div>
          ))}
        </div>
      </Sec>
      <BtnS onClick={()=>nav("home")}>ホームへ戻る</BtnS>
    </div>
  );
};

// --- メインアプリ ---
export default function App() {
  const [page, setPage] = useState("home");

  const nav = useCallback((p) => setPage(p), []);

  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Noto Sans JP',sans-serif",background:"#f0f2f5"}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{position:"fixed",left:0,top:0,height:"100vh",zIndex:20,overflowY:"auto"}}>
        <SideMenu page={page} nav={nav}/>
      </div>
      <div style={{marginLeft:250,flex:1,padding:"32px 36px",maxWidth:860,boxSizing:"border-box"}}>
        {page==="home" && <HomePage nav={nav}/>}
        {page==="guide" && <GuidePage nav={nav}/>}
        {page.startsWith("step_") && (()=>{
          const n=parseInt(page.replace("step_",""));
          return <StepPage key={n} step={STEPS[n-1]} nav={nav}/>;
        })()}
      </div>
    </div>
  );
}
