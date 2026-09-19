import React from 'react';

export const ResultDisplay: React.FC<{ imageUrl?: string | null }> = ({ imageUrl }) => {
  if (!imageUrl) return null;
  return <img src={imageUrl} alt="Result" className="w-full h-full object-contain" />;
};
