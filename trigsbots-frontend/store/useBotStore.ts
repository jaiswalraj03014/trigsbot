import { create } from 'zustand';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string; // <-- Changed to a single string for DeepSeek style
}

interface BotState {
  agent_name: string;
  system_prompt: string;
  trigger_type: string;
  max_spend_per_tx: number;
  drawdown_limit_pct: number;
  withdrawal_address: string;
  
  status: string;
  chatHistory: ChatMessage[];
  
  applyBlueprint: (data: Partial<BotState>) => void;
  addMessage: (msg: ChatMessage) => void;
  setStatus: (status: string) => void;
  getBlueprint: () => any; // <-- Added a helper to get current state
}

export const useBotStore = create<BotState>((set, get) => ({
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
  
  // Helper to grab the current state of the blueprint
  getBlueprint: () => {
    const state = get();
    return {
      agent_name: state.agent_name,
      system_prompt: state.system_prompt,
      trigger_type: state.trigger_type,
      max_spend_per_tx: state.max_spend_per_tx,
      drawdown_limit_pct: state.drawdown_limit_pct,
      withdrawal_address: state.withdrawal_address,
    };
  }
}));