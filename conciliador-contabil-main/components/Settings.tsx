import React, { useState } from 'react';
import { Database, Save, ExternalLink } from 'lucide-react';

const Settings: React.FC = () => {
    const [url, setUrl] = useState('');
    const [anonKey, setAnonKey] = useState('');

    const handleSave = () => {
        if (url.trim() && anonKey.trim()) {
            localStorage.setItem('SUPABASE_URL', url.trim());
            localStorage.setItem('SUPABASE_ANON_KEY', anonKey.trim());
            window.location.reload();
        } else {
            alert('Por favor, preencha ambos os campos.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-zinc-200">
                <div className="text-center">
                    <Database className="mx-auto h-12 w-12 text-indigo-600" />
                    <h2 className="mt-4 text-2xl font-bold text-zinc-900">Configuração Inicial</h2>
                    <p className="mt-2 text-sm text-zinc-600">
                        Para salvar seu trabalho na nuvem, a aplicação precisa se conectar ao seu banco de dados Supabase.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="supabase-url" className="block text-sm font-medium text-zinc-700">
                            Supabase URL
                        </label>
                        <div className="mt-1">
                            <input
                                id="supabase-url"
                                name="url"
                                type="url"
                                required
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="https://xxxxxxxx.supabase.co"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="supabase-anon-key" className="block text-sm font-medium text-zinc-700">
                            Supabase Anon Key (Pública)
                        </label>
                        <div className="mt-1">
                            <input
                                id="supabase-anon-key"
                                name="anon-key"
                                type="text"
                                required
                                value={anonKey}
                                onChange={(e) => setAnonKey(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            />
                        </div>
                    </div>
                </div>

                <div className="text-xs text-zinc-500 text-center">
                    <p>
                        Você pode encontrar essas informações nas configurações do seu projeto Supabase, na seção "API".
                        <a
                            href="https://supabase.com/docs/guides/api#api-url-and-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-indigo-600 hover:text-indigo-500 inline-flex items-center ml-1"
                        >
                            Ver documentação <ExternalLink className="h-3 w-3 ml-0.5" />
                        </a>
                    </p>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        <Save className="h-5 w-5 mr-2" />
                        Salvar e Reiniciar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;