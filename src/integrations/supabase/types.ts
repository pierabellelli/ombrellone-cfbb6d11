export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      beach_config: {
        Row: {
          created_at: string
          file: Json
          lido_id: string
          numerazione: string
          numero_file: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          file?: Json
          lido_id: string
          numerazione?: string
          numero_file?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          file?: Json
          lido_id?: string
          numerazione?: string
          numero_file?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_config_lido_id_fkey"
            columns: ["lido_id"]
            isOneToOne: true
            referencedRelation: "lidi"
            referencedColumns: ["id"]
          },
        ]
      }
      categorie_prodotto: {
        Row: {
          created_at: string
          id: string
          lido_id: string
          nome: string
          ordine: number
        }
        Insert: {
          created_at?: string
          id?: string
          lido_id: string
          nome: string
          ordine?: number
        }
        Update: {
          created_at?: string
          id?: string
          lido_id?: string
          nome?: string
          ordine?: number
        }
        Relationships: [
          {
            foreignKeyName: "categorie_prodotto_lido_id_fkey"
            columns: ["lido_id"]
            isOneToOne: false
            referencedRelation: "lidi"
            referencedColumns: ["id"]
          },
        ]
      }
      lidi: {
        Row: {
          accetta_carta: boolean
          created_at: string
          finestra_controllo_minuti: number | null
          foto_copertina_url: string | null
          id: string
          logo_url: string | null
          max_ordini_ravvicinati: number | null
          nome: string
          orario_apertura: string | null
          orario_chiusura: string | null
          servizio_bar_attivo: boolean
          slug: string
          soglia_ordine_libero: number | null
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          accetta_carta?: boolean
          created_at?: string
          finestra_controllo_minuti?: number | null
          foto_copertina_url?: string | null
          id?: string
          logo_url?: string | null
          max_ordini_ravvicinati?: number | null
          nome: string
          orario_apertura?: string | null
          orario_chiusura?: string | null
          servizio_bar_attivo?: boolean
          slug: string
          soglia_ordine_libero?: number | null
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          accetta_carta?: boolean
          created_at?: string
          finestra_controllo_minuti?: number | null
          foto_copertina_url?: string | null
          id?: string
          logo_url?: string | null
          max_ordini_ravvicinati?: number | null
          nome?: string
          orario_apertura?: string | null
          orario_chiusura?: string | null
          servizio_bar_attivo?: boolean
          slug?: string
          soglia_ordine_libero?: number | null
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ordine_items: {
        Row: {
          created_at: string
          id: string
          nome_snapshot: string
          ordine_id: string
          prezzo_snapshot: number
          prodotto_id: string | null
          quantita: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome_snapshot: string
          ordine_id: string
          prezzo_snapshot: number
          prodotto_id?: string | null
          quantita?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome_snapshot?: string
          ordine_id?: string
          prezzo_snapshot?: number
          prodotto_id?: string | null
          quantita?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordine_items_ordine_id_fkey"
            columns: ["ordine_id"]
            isOneToOne: false
            referencedRelation: "ordini"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordine_items_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
        ]
      }
      ordini: {
        Row: {
          archiviato: boolean
          cognome: string
          created_at: string
          fila: string | null
          id: string
          lido_id: string
          metodo_pagamento: string | null
          note: string | null
          numero_ombrellone: string
          numero_ordine: number
          stato: Database["public"]["Enums"]["ordine_stato"]
          stripe_payment_id: string | null
          telefono: string | null
          totale: number
          updated_at: string
        }
        Insert: {
          archiviato?: boolean
          cognome: string
          created_at?: string
          fila?: string | null
          id?: string
          lido_id: string
          metodo_pagamento?: string | null
          note?: string | null
          numero_ombrellone: string
          numero_ordine: number
          stato?: Database["public"]["Enums"]["ordine_stato"]
          stripe_payment_id?: string | null
          telefono?: string | null
          totale?: number
          updated_at?: string
        }
        Update: {
          archiviato?: boolean
          cognome?: string
          created_at?: string
          fila?: string | null
          id?: string
          lido_id?: string
          metodo_pagamento?: string | null
          note?: string | null
          numero_ombrellone?: string
          numero_ordine?: number
          stato?: Database["public"]["Enums"]["ordine_stato"]
          stripe_payment_id?: string | null
          telefono?: string | null
          totale?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordini_lido_id_fkey"
            columns: ["lido_id"]
            isOneToOne: false
            referencedRelation: "lidi"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotti: {
        Row: {
          categoria_id: string | null
          created_at: string
          descrizione: string | null
          disponibile: boolean
          foto_url: string | null
          id: string
          immagine_url: string | null
          lido_id: string
          nome: string
          prezzo: number
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          descrizione?: string | null
          disponibile?: boolean
          foto_url?: string | null
          id?: string
          immagine_url?: string | null
          lido_id: string
          nome: string
          prezzo?: number
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          descrizione?: string | null
          disponibile?: boolean
          foto_url?: string | null
          id?: string
          immagine_url?: string | null
          lido_id?: string
          nome?: string
          prezzo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorie_prodotto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prodotti_lido_id_fkey"
            columns: ["lido_id"]
            isOneToOne: false
            referencedRelation: "lidi"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cognome: string | null
          created_at: string
          email: string | null
          id: string
          lido_id: string | null
          nome: string | null
          updated_at: string
        }
        Insert: {
          cognome?: string | null
          created_at?: string
          email?: string | null
          id: string
          lido_id?: string | null
          nome?: string | null
          updated_at?: string
        }
        Update: {
          cognome?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lido_id?: string | null
          nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_lido_id_fkey"
            columns: ["lido_id"]
            isOneToOne: false
            referencedRelation: "lidi"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          lido_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lido_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lido_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_lido_id_fkey"
            columns: ["lido_id"]
            isOneToOne: false
            referencedRelation: "lidi"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_super_admin: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_lido: {
        Args: {
          _lido_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      create_ordine: {
        Args: {
          _cognome: string
          _items: Json
          _lido_id: string
          _metodo_pagamento: string
          _note: string | null
          _numero_ombrellone: string
          _telefono: string
          _totale: number
        }
        Returns: { id: string; numero_ordine: number }[]
      }
      get_order_history: {
        Args: { _lido_id: string; _telefono: string }
        Returns: {
          created_at: string
          id: string
          items: Json
          numero_ombrellone: string
          numero_ordine: number
          stato: Database["public"]["Enums"]["ordine_stato"]
          totale: number
        }[]
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      traccia_ordine: {
        Args: { _cognome: string; _numero: number; _slug: string }
        Returns: {
          cognome: string
          created_at: string
          id: string
          numero_ombrellone: string
          numero_ordine: number
          stato: string
          totale: number
        }[]
      }
      traccia_ordini_oggi: {
        Args: { _lido_id: string; _numero_ombrellone: string; _telefono: string }
        Returns: {
          created_at: string
          id: string
          items: Json
          numero_ombrellone: string
          numero_ordine: number
          stato: Database["public"]["Enums"]["ordine_stato"]
          totale: number
        }[]
      }
      user_lido_id: { Args: Record<PropertyKey, never>; Returns: string }
    }
    Enums: {
      app_role: "cliente" | "staff" | "gestore" | "super_admin"
      ordine_stato: "arrivati" | "da_evadere" | "consegnati" | "annullato"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["cliente", "staff", "gestore", "super_admin"],
      ordine_stato: ["arrivati", "da_evadere", "consegnati", "annullato"],
    },
  },
} as const
