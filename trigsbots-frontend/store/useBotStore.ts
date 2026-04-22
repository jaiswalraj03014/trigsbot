import { create } from 'zustand';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thoughts?: string[]; // <-- NEW: Added to support AI terminal thoughts
}

interface BotState {
  // Agent Blueprint
  agent_name: string;
  system_prompt: string;
  trigger_type: string;
  max_spend_per_tx: number;
  drawdown_limit_pct: number;
  withdrawal_address: string;
  
  // AI Conversation State
  status: string;
  chatHistory: ChatMessage[];
  
  // Actions
  applyBlueprint: (data: Partial<BotState>) => void;
  addMessage: (msg: ChatMessage) => void;
  setStatus: (status: string) => void;
}

export const useBotStore = create<BotState>((set) => ({
  agent_name: '',
  system_prompt: '',
  trigger_type: '',
  max_spend_per_tx: 0,
  drawdown_limit_pct: 0,
  withdrawal_address: '',
  
  status: 'gathering',
  chatHistory: [
    { role: 'assistant', content: 'Hello! What kind of Web3 agent are we architecting today? You can describe it, or paste a markdown ruleset.' }
  ],
  
  applyBlueprint: (data) => set((state) => ({ ...state, ...data })),
  addMessage: (msg) => set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
  setStatus: (status) => set({ status }),
}));