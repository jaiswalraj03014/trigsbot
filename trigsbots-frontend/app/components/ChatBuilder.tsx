'use client';

import { useState, useRef, useEffect } from 'react';
import { useBotStore } from '@/store/useBotStore';

export default function ChatBuilder() {
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [liveReasoning, setLiveReasoning] = useState(''); // Tracks the live typing
  
  const [greeting, setGreeting] = useState("What strategy shall we automate today?");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { chatHistory, addMessage, applyBlueprint, setStatus, status, agent_name } = useBotStore();

  const isEmptyState = chatHistory.length <= 1;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    const web3Greetings = [
      "What strategy shall we automate today?",
      "Let's architect your autonomous trader.",
      "What kind of agent are we forging today?",
      "Describe the Web3 worker you want to build."
    ];
    setGreeting(web3Greetings[Math.floor(Math.random() * web3Greetings.length)]);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.md', '.txt', '.csv', '.json', '.pdf', '.doc', '.docx'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      alert("Invalid file type."); e.target.value = ''; return;
    }

    const plainTextExtensions = ['.md', '.txt', '.csv', '.json'];
    if (plainTextExtensions.includes(fileExt)) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileContent = event.target?.result as string;
        setInput(prev => prev + (prev ? '\n\n' : '') + `[Document Uploaded: ${file.name}]\n\n${fileContent}\n`);
        textareaRef.current?.focus();
      };
      reader.readAsText(file);
    } else {
      setInput(prev => prev + (prev ? '\n\n' : '') + `[Document Attached: ${file.name}]\n*(System Note: Needs backend parser)*\n`);
      textareaRef.current?.focus();
    }
    e.target.value = ''; 
  };

  const handleSend = async (textToSend: string = input) => {
    if (!textToSend.trim()) return;
    
    const userMsg = { role: 'user' as const, content: textToSend };
    addMessage(userMsg);
    setInput('');
    setIsThinking(true);
    setLiveReasoning(''); // Reset stream string
    
    try {
      const currentState = useBotStore.getState();
      const current_blueprint = {
        agent_name: currentState.agent_name,
        system_prompt: currentState.system_prompt,
        trigger_type: currentState.trigger_type,
        max_spend_per_tx: currentState.max_spend_per_tx,
        drawdown_limit_pct: currentState.drawdown_limit_pct,
        withdrawal_address: currentState.withdrawal_address,
      };

      const response = await fetch('http://localhost:3001/chat-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_history: [...chatHistory, userMsg],
          current_blueprint: current_blueprint 
        })
      });

      if (!response.body) throw new Error("No readable stream");

      // Set up the Stream Reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isDone = false;
      let accumulatedRawJSON = "";

      while (!isDone) {
        const { value, done } = await reader.read();
        if (done) { isDone = true; break; }
        
        const chunk = decoder.decode(value, { stream: true });
        const events = chunk.split('\n\n');

        for (const ev of events) {
          if (ev.startsWith('event: token')) {
             const dataStr = ev.replace('event: token\ndata: ', '').replace(/\\n/g, '\n');
             accumulatedRawJSON += dataStr;
             
             // Regex Magic: Extract only the reasoning string from the raw JSON as it streams
             const match = accumulatedRawJSON.match(/"reasoning"\s*:\s*"([^"]*)/);
             if (match && match[1]) {
                setLiveReasoning(match[1]); // This animates the UI instantly!
             }
          }
          if (ev.startsWith('event: complete')) {
             const finalDataStr = ev.replace('event: complete\ndata: ', '');
             const data = JSON.parse(finalDataStr);
             
             // Stream is done, save the final complete message to state
             addMessage({ 
                role: 'assistant', 
                content: data.message_to_user,
                reasoning: data.reasoning
             });
             applyBlueprint(data.current_blueprint);
             setStatus(data.status);
             setIsThinking(false);
             setLiveReasoning('');
          }
          if (ev.startsWith('event: error')) {
             addMessage({ role: 'assistant', content: "Stream interrupted." });
             setIsThinking(false);
          }
        }
      }
    } catch (error) {
      console.error(error);
      addMessage({ role: 'assistant', content: "System offline." });
      setIsThinking(false);
    }
  };

  const suggestionPills = [
    "Arbitrage Sniper", "Stablecoin Yield Farmer", "Liquidator Bot", "DCA Accumulator"
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto font-sans relative">
      
      {!isEmptyState && (
        <div className="flex-grow overflow-y-auto flex flex-col gap-6 pb-6 px-2 pt-4 scroll-smooth">
          {chatHistory.slice(1).map((msg, idx, arr) => {
            const isLastMessage = idx === arr.length - 1;

            return (
              <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                
                {/* COMPLETED DEEPSEEK CHAIN OF THOUGHT */}
                {msg.reasoning && (
                  <details className="mb-2 group w-full">
                    <summary className="text-[13px] text-[#A09B90] cursor-pointer list-none flex items-center gap-2 hover:text-[#2D2A26] transition-colors select-none">
                      <svg className="w-3.5 h-3.5 transition-transform duration-200 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      Thinking Process
                    </summary>
                    <div className="pl-5 pt-2 pb-1 text-[13px] text-[#7A756D] border-l-2 border-[#E5E0D8] ml-[7px] mt-1 whitespace-pre-wrap leading-relaxed animate-in fade-in duration-300">
                      {msg.reasoning}
                    </div>
                  </details>
                )}

                {/* NORMAL CHAT BUBBLE */}
                <div className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-[#EAE6DF] text-[#2D2A26] rounded-br-sm font-medium border border-[#DCD6CC]' 
                    : 'bg-white text-[#2D2A26] rounded-bl-sm border border-[#E5E0D8]'
                }`}>
                  {msg.content}
                </div>

                {/* INLINE INPUT BOX */}
                {isLastMessage && msg.role === 'assistant' && status === 'gathering' && !isThinking && (
                  <div 
                    onClick={() => textareaRef.current?.focus()}
                    className="mt-3 w-full p-3.5 border-2 border-dashed border-[#DCD6CC] rounded-xl text-[#A09B90] text-[14px] cursor-text hover:bg-[#F9F8F6] hover:border-[#C4BFB5] hover:text-[#7A756D] transition-all flex items-center gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-300"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Click here to provide the missing information...
                  </div>
                )}
              </div>
            );
          })}
          
          {/* --- LIVE STREAMING UI --- */}
          {isThinking && (
            <div className="flex flex-col self-start max-w-[85%] animate-in fade-in duration-300">
              <details open className="mb-2 group w-full">
                <summary className="text-[13px] text-[#A09B90] cursor-pointer list-none flex items-center gap-2 select-none">
                  <svg className="w-3.5 h-3.5 rotate-90" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  Thinking Process...
                </summary>
                <div className="pl-5 pt-2 pb-1 text-[13px] text-[#7A756D] border-l-2 border-[#E5E0D8] ml-[7px] mt-1 whitespace-pre-wrap leading-relaxed">
                  {liveReasoning || <span className="animate-pulse">Analyzing logic...</span>}
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#A09B90] animate-pulse"></span>
                </div>
              </details>
            </div>
          )}
          {/* ------------------------------ */}
        </div>
      )}

      {isEmptyState && (
        <div className="flex flex-col items-center justify-center flex-grow pt-10 pb-12 animate-in fade-in duration-700">
          <div className="flex items-center justify-center mb-16">
            <img src="/trigsbot.png" alt="Trigsbot Logo" className="h-24 w-auto object-contain relative z-10" />
            <img src="/trigsbot-text.png" alt="Trigsbot Text" className="h-20 w-auto object-contain invert -ml-8 relative z-0" />
          </div>
          <h2 className="text-[2.75rem] leading-[1.15] font-serif text-[#2D2A26] tracking-tight text-center max-w-2xl">
            {greeting}
          </h2>
        </div>
      )}

      <div className={`w-full transition-all duration-500 ease-in-out flex flex-col items-center ${isEmptyState ? 'pb-[18vh]' : 'pb-6'}`}>
        
        {status === 'complete' && !isEmptyState && (
          <div className="w-full mb-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50 flex justify-between items-center animate-in slide-in-from-bottom-4 fade-in duration-500 shadow-sm">
            <div>
              <h3 className="text-emerald-800 font-bold">System Ready</h3>
              <p className="text-emerald-600/80 text-sm">Blueprint for <span className="font-mono font-bold">{agent_name}</span> compiled.</p>
            </div>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-5 rounded-lg transition-colors shadow-sm">
              Deploy to Testnet
            </button>
          </div>
        )}

        <div className="w-full relative bg-white rounded-2xl border border-[#E5E0D8] shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus-within:border-[#D0C8B8] focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all flex flex-col p-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type your strategy or paste a .md ruleset..."
            className="w-full bg-transparent p-3.5 text-[#2D2A26] placeholder:text-[#A09B90] resize-none focus:outline-none max-h-[200px] min-h-[52px] overflow-y-auto text-[15px]"
            rows={1}
          />
          
          <div className="flex justify-between items-center px-2 pb-1.5 pt-1">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".md,.txt,.csv,.json,.pdf,.doc,.docx" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="text-[#A09B90] hover:text-[#2D2A26] transition-colors py-1.5 px-2.5 rounded-lg hover:bg-[#F4F2EC] flex items-center gap-2 text-sm font-medium">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              <span className="hidden sm:inline">Upload Ruleset</span>
            </button>
            <button onClick={() => handleSend(input)} disabled={isThinking || !input.trim()} className={`p-2 rounded-xl transition-all flex items-center justify-center ${isThinking || !input.trim() ? 'bg-[#F4F2EC] text-[#C4BFB5] cursor-not-allowed' : 'bg-[#2D2A26] text-white hover:bg-[#1A1816] shadow-sm'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
          </div>
        </div>

        {isEmptyState && (
          <div className="flex flex-wrap justify-center gap-2.5 mt-8 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150">
            {suggestionPills.map((pill, i) => (
              <button key={i} onClick={() => setInput(`I want to build a ${pill} that...`)} className="px-4 py-2 rounded-full bg-white border border-[#E5E0D8] text-[#7A756D] text-[13px] font-medium hover:text-[#2D2A26] hover:border-[#D0C8B8] hover:bg-[#F4F2EC] transition-all shadow-sm">{pill}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}