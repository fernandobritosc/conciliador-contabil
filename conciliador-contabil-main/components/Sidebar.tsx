import React from 'react';
import { BotMessageSquare, PlusCircle, History, Settings } from 'lucide-react';

type View = 'new' | 'history' | 'process' | 'settings';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  historyCount?: number;
}

const NavLink: React.FC<{
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`nav-pill flex items-center w-full group ${isActive
        ? 'nav-pill-active'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
    >
      <Icon className={`h-5 w-5 mr-3 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
      <span className="tracking-tight font-medium">{label}</span>
      {isActive && <div className="absolute left-0 w-1 h-4 bg-indigo-500 rounded-full" />}
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  return (
    <aside className="w-64 bg-[#0F172A] border-r border-slate-800 text-slate-200 flex-col p-6 hidden md:flex transition-all">
      <div className="flex items-center space-x-3 mb-12 px-2">
        <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
          <BotMessageSquare className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tighter text-white">
            AUDITOR
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400 mt-[-4px]">
            CONTÁBIL / FOLHA
          </p>
        </div>
      </div>
      <nav className="flex flex-col space-y-3">
        <NavLink
          icon={PlusCircle}
          label="Nova Conciliação"
          isActive={currentView === 'new' || currentView === 'process'}
          onClick={() => onViewChange('new')}
        />
        <NavLink
          icon={History}
          label="Histórico Geral"
          isActive={currentView === 'history'}
          onClick={() => onViewChange('history')}
        />
        <NavLink
          icon={Settings}
          label="Configurações"
          isActive={currentView === 'settings'}
          onClick={() => onViewChange('settings')}
        />
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-800">
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p className="text-xs text-slate-300 font-semibold mb-1">Status do Sistema</p>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-slate-400 font-medium">IA ONLINE</span>
          </div>
        </div>
      </div>
    </aside>
  );
};