import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReconciliationRecord } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('SUPABASE_URL');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY');


// O tipo Database pode ser gerado automaticamente pelo Supabase CLI para uma tipagem forte
// Por enquanto, usaremos uma definição manual básica.
export interface Database {
  public: {
    Tables: {
      reconciliacoes: {
        Row: ReconciliationRecord;
        Insert: Omit<ReconciliationRecord, 'id' | 'created_at'>;
        Update: Partial<Omit<ReconciliationRecord, 'id' | 'created_at'>>;
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}


let supabaseInstance: SupabaseClient<Database> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error("Failed to create Supabase client. Clearing invalid credentials from localStorage.", error);
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_ANON_KEY');
  }
}

export const supabase = supabaseInstance;