import { useEffect, useState } from "react";
import { api } from "./lib/api";
import { useZed } from "./store";
import "./app.css";
// removed
export default function App() {
  const { activeThreadId, setThread, messages, setMessages, sending, setSending } = useZed();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!activeThreadId) return;
    api.get(`api/chat/history/${activeThreadId}`).json<any[]>().then(ts => {
      setMessages(ts.map(t => ({ role: t.role, content: t.content, createdAt: t.createdAt })));
    }).catch(()=>{});
  }, [activeThreadId, setMessages]);

  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.post("api/chat/ask", { json: { threadId: activeThreadId, message: input } }).json<any>();
      if (!activeThreadId) setThread(res.threadId);
      setInput("");
      setStatus(res.citations?.length ? `Context: ${res.citations.length} chunks` : "");
      const ts = await api.get(`api/chat/history/${res.threadId}`).json<any[]>();
      setMessages(ts.map(t => ({ role: t.role, content: t.content, createdAt: t.createdAt })));
    } catch (e:any) {
      setStatus(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function indexSample() {
    const text = `Zed is a private, local-first AI. This sample text is indexed for retrieval.`;
    const r = await api.post("api/rag/index", { json: { title: "Sample", text } }).json<any>();
    setStatus(`Indexed ${r.chunks} chunks.`);
  }

  async function runEval() {
    const r = await api.post("api/eval/run").json<any>();
    setStatus(r.ok ? "Eval OK" : "Eval warnings");
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">Z</div>
        <div className="brand">Zed (Standalone)</div>
        <div className="spacer" />
        <button onClick={indexSample}>Index Sample</button>
        <button onClick={runEval}>Run Eval</button>
        <a className="link" href="http://localhost:7001/health" target="_blank" rel="noreferrer">Health</a>
      </header>
      <main className="main">
        <div className="chat">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className="role">{m.role}</div>
                <div className="content">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="composer">
            <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask Zed…" />
            <button onClick={send} disabled={sending}>{sending?"Sending…":"Send"}</button>
          </div>
          {status && <div className="status">{status}</div>}
        </div>
      </main>
    </div>
  );
}
