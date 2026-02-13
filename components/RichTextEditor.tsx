import React, { useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline, List, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync state with contentEditable div. This is crucial to set the initial AI-generated text.
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // After executing a command, the innerHTML changes, so we sync it back to the state.
    handleInput();
  };

  const ToolbarButton = ({ command, value, children, title }: { command: string, value?: string, children: React.ReactNode, title: string }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent editor from losing focus
        handleCommand(command, value);
      }}
      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white focus:bg-indigo-500/20 focus:outline-none transition-all"
      title={title}
    >
      {children}
    </button>
  );

  const Separator = () => <div className="w-px h-6 bg-white/10 mx-2"></div>;

  return (
    <div className="border border-white/10 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500 bg-slate-900 shadow-2xl overflow-hidden">
      <div className="toolbar flex items-center flex-wrap p-2 border-b border-white/5 bg-slate-800/50 space-x-1">
        <ToolbarButton command="bold" title="Negrito (Ctrl+B)"><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton command="italic" title="Itálico (Ctrl+I)"><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton command="underline" title="Sublinhado (Ctrl+U)"><Underline className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton command="strikeThrough" title="Tachado"><Strikethrough className="h-4 w-4" /></ToolbarButton>
        <Separator />
        <ToolbarButton command="justifyLeft" title="Alinhar à Esquerda"><AlignLeft className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton command="justifyCenter" title="Centralizar"><AlignCenter className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton command="justifyRight" title="Alinhar à Direita"><AlignRight className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton command="justifyFull" title="Justificar"><AlignJustify className="h-4 w-4" /></ToolbarButton>
        <Separator />
        <ToolbarButton command="insertUnorderedList" title="Lista"><List className="h-4 w-4" /></ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable={true}
        onInput={handleInput}
        className="w-full min-h-[350px] p-8 font-serif text-slate-200 text-lg leading-relaxed focus:outline-none overflow-y-auto bg-slate-900/50"
        aria-label="Parecer Técnico Editável"
      />
    </div>
  );
};

export default RichTextEditor;