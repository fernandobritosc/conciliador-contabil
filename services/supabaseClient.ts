import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReconciliationRecord } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('SUPABASE_URL');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY');


// O tipo Database pode ser gerado automaticamente pelo Supabase CLI para uma tipagem forte
// Por enquanto, usaremos uma definição manual básica.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      reconciliacoes: {
        Row: {
          id: string
          orgao: string
          competencia: string
          status: string
          comparison_result: Json | null
          nota_tecnica: string | null
          created_at: string
          files: string[]
        }
        Insert: {
          id?: string
          orgao: string
          competencia: string
          status: string
          comparison_result?: Json | null
          nota_tecnica?: string | null
          created_at?: string
          files: string[]
        }
        Update: {
          id?: string
          orgao?: string
          competencia?: string
          status?: string
          comparison_result?: Json | null
          nota_tecnica?: string | null
          created_at?: string
          files?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
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

export async function uploadFile(file: File, path: string): Promise<string | null> {
  if (!supabaseInstance) return null;

  try {
    const { data, error } = await supabaseInstance.storage
      .from('audit-files')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    const { data: publicUrlData } = supabaseInstance.storage
      .from('audit-files')
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Unexpected error uploading file:', error);
    return null;
  }
}