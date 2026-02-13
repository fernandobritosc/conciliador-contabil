import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface HeaderProps {
  orgao?: string;
  competencia?: string;
}

export const Header: React.FC<HeaderProps> = ({ orgao, competencia }) => {
  return (
    <header className="glass-effect sticky top-0 z-50 border-b border-white/5 h-20 flex items-center">
      <div className="container mx-auto px-8 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold tracking-widest text-indigo-400 uppercase">
            Workstation
          </h2>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              {orgao ? 'Painel de Auditoria Ativo' : 'Visão Geral do Sistema'}
            </h1>
          </div>
        </div>

        {orgao && competencia && (
          <div className="flex items-center space-x-4 animate-fade-in">
            <div className="h-10 w-px bg-white/10" />
            <div className="text-right">
              <p className="text-sm font-bold text-slate-100 truncate max-w-[300px]" title={orgao}>
                {orgao}
              </p>
              <div className="flex items-center justify-end space-x-2 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <Info className="h-3 w-3" />
                <span>Ref: {competencia}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};