import React from 'react';
import { ShieldCheck, Info, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  orgao?: string;
  competencia?: string;
  observacoes?: string;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: Date | null;
  onManualSave?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ orgao, competencia, observacoes, saveStatus, lastSavedAt, onManualSave }) => {
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
          <div className="flex items-center space-x-6 animate-fade-in">
            {observacoes && (
              <div className="hidden lg:flex flex-col items-end max-w-sm border-r border-white/10 pr-6 mr-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 opacity-70">Informações Blindadas</span>
                <p className="text-[11px] font-medium text-slate-300 line-clamp-2 text-right leading-tight italic">
                  "{observacoes}"
                </p>
              </div>
            )}
            <div className="h-10 w-px bg-white/10" />
            <div className="text-right">
              <p className="text-sm font-bold text-slate-100 truncate max-w-[250px]" title={orgao}>
                {orgao}
              </p>
              <div className="flex items-center justify-end space-x-2 text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                <Info className="h-3.5 w-3.5 text-indigo-400" />
                <span>Competência: {competencia}</span>
              </div>
            </div>
          </div>
        )}

        {/* Save Status Indicator & Manual Save */}
        <div className="flex items-center space-x-4 ml-4">
          {saveStatus === 'saving' && (
            <div className="flex items-center space-x-2 text-indigo-400 animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-wider">Salvando...</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex flex-col items-end animate-fade-in">
              <div className="flex items-center space-x-2 text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Salvo</span>
              </div>
              {lastSavedAt && (
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  Às {lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center space-x-2 text-red-400 animate-pulse">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Erro ao Salvar</span>
            </div>
          )}

          {onManualSave && (
            <button
              onClick={onManualSave}
              disabled={saveStatus === 'saving'}
              className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 group"
            >
              <ShieldCheck className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              Salvar Agora
            </button>
          )}
        </div>
      </div>
    </header>
  );
};