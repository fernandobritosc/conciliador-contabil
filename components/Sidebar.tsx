import React from 'react';
import { BotMessageSquare, PlusCircle, History } from 'lucide-react';

type View = 'new' | 'history' | 'process';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
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
      className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
        isActive
          ? 'bg-indigo-600 text-white'
          : 'text-zinc-300 hover:bg-zinc-700 hover:text-white'
      }`}
    >
      <Icon className="h-5 w-5 mr-3" />
      <span>{label}</span>
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  return (
    <aside className="w-64 bg-zinc-800 text-white flex-col p-4 hidden md:flex">
      <div className="flex items-center space-x-3 mb-8 px-2">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <BotMessageSquare className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-bold">Conciliador</h1>
      </div>
      <nav className="flex flex-col space-y-2">
        <NavLink
          icon={PlusCircle}
          label="Nova Conciliação"
          isActive={currentView === 'new'}
          onClick={() => setView('new')}
        />
        <NavLink
          icon={History}
          label="Histórico"
          isActive={currentView === 'history'}
          onClick={() => setView('history')}
        />
      </nav>
    </aside>
  );
};