import React from 'react';
import { BotMessageSquare } from 'lucide-react';

interface HeaderProps {
  orgao?: string;
  competencia?: string;
}

export const Header: React.FC<HeaderProps> = ({ orgao, competencia }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-zinc-200">
      <div className="container mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <BotMessageSquare className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-800">
            Conciliador Contábil
          </h1>
        </div>
        {orgao && competencia && (
            <div className="text-right hidden md:block">
                 <p className="text-sm font-semibold text-zinc-700 truncate" title={orgao}>
                    {orgao}
                </p>
                <p className="text-xs text-zinc-500">
                    Competência: {competencia}
                </p>
            </div>
        )}
      </div>
    </header>
  );
};