'use client';

import { useBotStore } from '../../store/useBotStore';

export default function LiveArtifact() {
  const blueprint = useBotStore();

  const isReady = blueprint.status === 'complete';

  return (
    <div className="bg-black p-6 rounded-xl border border-zinc-800 h-full flex flex-col">
      <div className="border-b border-zinc-800 pb-4 mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          ⚙️ Compiled Artifact
        </h2>
        <p className="text-sm text-zinc-500 mt-1">Updates dynamically via Builder AI</p>
      </div>

      <div className="flex-grow flex flex-col gap-4">
        <div className={`p-4 rounded-lg border ${blueprint.agent_name ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
          <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Agent Name</label>
          <div className="text-lg font-mono text-white mt-1">{blueprint.agent_name || '...'}</div>
        </div>

        <div className={`p-4 rounded-lg border ${blueprint.system_prompt ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
          <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Core Directive</label>
          <div className="text-sm text-zinc-300 mt-1 leading-relaxed">{blueprint.system_prompt || '...'}</div>
        </div>

        <div className={`p-4 rounded-lg border ${blueprint.trigger_type ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
          <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Trigger Mechanism</label>
          <div className="text-md font-mono text-white mt-1">{blueprint.trigger_type || '...'}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-lg border ${blueprint.max_spend_per_tx ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Max Spend</label>
            <div className="text-md font-mono text-white mt-1">${blueprint.max_spend_per_tx || 0}</div>
          </div>
          <div className={`p-4 rounded-lg border ${blueprint.drawdown_limit_pct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Drawdown Limit</label>
            <div className="text-md font-mono text-white mt-1">{blueprint.drawdown_limit_pct || 0}%</div>
          </div>
        </div>
      </div>

      <button 
        disabled={!isReady}
        className={`w-full mt-6 font-bold py-4 px-4 rounded-lg transition-colors ${
          isReady ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
        }`}
      >
        Deploy to Testnet Sandbox
      </button>
    </div>
  );
}