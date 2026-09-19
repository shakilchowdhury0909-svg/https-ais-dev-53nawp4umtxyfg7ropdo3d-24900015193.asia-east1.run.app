import React from 'react';

export const Loader: React.FC<{ message?: string }> = ({ message = 'Generating with Gemini...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative w-14 h-14">
        <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-3 border-purple-500/30 border-b-purple-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}></div>
        </div>
      </div>
      <p className="text-xs font-semibold tracking-wider text-indigo-300 uppercase animate-pulse">{message}</p>
    </div>
  );
};
