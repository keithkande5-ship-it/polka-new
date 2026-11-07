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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          password_hash: string
          role: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          password_hash: string
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          password_hash?: string
          role?: string | null
        }
        Relationships: []
      }
      cashier_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          mpesa_receipt: string | null
          phone: string
          raw_payload: Json | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mpesa_receipt?: string | null
          phone: string
          raw_payload?: Json | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mpesa_receipt?: string | null
          phone?: string
          raw_payload?: Json | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      eat_rounds: {
        Row: {
          created_at: string
          id: string
          round_date: string
          settled: boolean | null
          settled_price: number | null
          symbol: string
          target_price: number
          winning_side: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          round_date: string
          settled?: boolean | null
          settled_price?: number | null
          symbol: string
          target_price: number
          winning_side?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          round_date?: string
          settled?: boolean | null
          settled_price?: number | null
          symbol?: string
          target_price?: number
          winning_side?: string | null
        }
        Relationships: []
      }
      issues: {
        Row: {
          category: string
          created_at: string
          description: string
          email: string | null
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          email?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      market_comments: {
        Row: {
          created_at: string
          id: string
          likes: number | null
          market_id: string
          stake_amount: number | null
          stake_side: string | null
          text: string
          user_handle: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          likes?: number | null
          market_id: string
          stake_amount?: number | null
          stake_side?: string | null
          text: string
          user_handle: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          likes?: number | null
          market_id?: string
          stake_amount?: number | null
          stake_side?: string | null
          text?: string
          user_handle?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_comments_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          category: string
          closes_at: string | null
          created_at: string
          ends: string
          hot: boolean | null
          id: string
          image: string | null
          news: Json | null
          oracle: string
          outcomes: Json
          resolved: boolean
          rules: string
          title: string
          volume: string | null
          winning_outcome: string | null
        }
        Insert: {
          category: string
          closes_at?: string | null
          created_at?: string
          ends: string
          hot?: boolean | null
          id: string
          image?: string | null
          news?: Json | null
          oracle: string
          outcomes: Json
          resolved?: boolean
          rules: string
          title: string
          volume?: string | null
          winning_outcome?: string | null
        }
        Update: {
          category?: string
          closes_at?: string | null
          created_at?: string
          ends?: string
          hot?: boolean | null
          id?: string
          image?: string | null
          news?: Json | null
          oracle?: string
          outcomes?: Json
          resolved?: boolean
          rules?: string
          title?: string
          volume?: string | null
          winning_outcome?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          href: string | null
          id: string
          kind: string
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          href?: string | null
          id?: string
          kind: string
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          href?: string | null
          id?: string
          kind?: string
          read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          claimed: boolean | null
          created_at: string
          id: string
          market_id: string
          mult: number
          outcome: string
          payout: number
          shares: number | null
          stake: number
          status: string | null
          user_id: string
        }
        Insert: {
          claimed?: boolean | null
          created_at?: string
          id?: string
          market_id: string
          mult: number
          outcome: string
          payout: number
          shares?: number | null
          stake: number
          status?: string | null
          user_id: string
        }
        Update: {
          claimed?: boolean | null
          created_at?: string
          id?: string
          market_id?: string
          mult?: number
          outcome?: string
          payout?: number
          shares?: number | null
          stake?: number
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance: number
          email: string | null
          handle: string
          id: string
          joined_at: string
          phone: string | null
        }
        Insert: {
          balance?: number
          email?: string | null
          handle: string
          id?: string
          joined_at?: string
          phone?: string | null
        }
        Update: {
          balance?: number
          email?: string | null
          handle?: string
          id?: string
          joined_at?: string
          phone?: string | null
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          referred_user_id: string | null
          referrer_id: string
          source_trade_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          referred_user_id?: string | null
          referrer_id: string
          source_trade_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          referred_user_id?: string | null
          referrer_id?: string
          source_trade_id?: string | null
        }
        Relationships: []
      }
      vault_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          entry_type: string
          id: string
          ref_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          entry_type: string
          id?: string
          ref_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          entry_type?: string
          id?: string
          ref_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      place_order: {
        Args: {
          p_market_id: string
          p_multiplier: number
          p_outcome: string
          p_stake: number
        }
        Returns: Json
      }
      settle_market: {
        Args: { p_market_id: string; p_winning_outcome: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
