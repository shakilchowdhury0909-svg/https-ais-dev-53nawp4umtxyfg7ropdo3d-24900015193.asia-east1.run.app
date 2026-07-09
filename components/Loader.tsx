import React from 'react';

export const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-8 text-center animate-in fade-in duration-700">
      <div className="relative">
        <div className="w-24 h-24 border border-indigo-500/20 rounded-full animate-[spin_3s_linear_infinite]"></div>
        <div className="absolute inset-0 w-24 h-24 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
        <div className="absolute inset-4 w-16 h-16 border-r-2 border-purple-500 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_15px_rgba(255,255,255,0.8)]"></div>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-black text-white uppercase tracking-[0.5em] opacity-80">Synthesizing High Fidelity</p>
        <div className="flex justify-center gap-1">
            {[1, 2, 3].map(i => (
                <div key={i} className={`w-1 h-1 bg-indigo-500 rounded-full animate-bounce`} style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
        </div>
      </div>
    </div>
  );
};