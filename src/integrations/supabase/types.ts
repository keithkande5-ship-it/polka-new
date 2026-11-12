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
          fee: number
          id: string
          mpesa_receipt: string | null
          net: number | null
          palpluss_id: string | null
          phone: string
          raw_payload: Json | null
          reference: string | null
          reviewed_by: string | null
          status: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee?: number
          id?: string
          mpesa_receipt?: string | null
          net?: number | null
          palpluss_id?: string | null
          phone: string
          raw_payload?: Json | null
          reference?: string | null
          reviewed_by?: string | null
          status?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee?: number
          id?: string
          mpesa_receipt?: string | null
          net?: number | null
          palpluss_id?: string | null
          phone?: string
          raw_payload?: Json | null
          reference?: string | null
          reviewed_by?: string | null
          status?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      eat_rounds: {
        Row: {
          closes_at: string | null
          created_at: string
          id: string
          no_multiplier: number | null
          round_date: string
          settled: boolean | null
          settled_price: number | null
          symbol: string
          target_price: number
          winning_side: string | null
          yes_multiplier: number | null
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          id?: string
          no_multiplier?: number | null
          round_date: string
          settled?: boolean | null
          settled_price?: number | null
          symbol: string
          target_price: number
          winning_side?: string | null
          yes_multiplier?: number | null
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          id?: string
          no_multiplier?: number | null
          round_date?: string
          settled?: boolean | null
          settled_price?: number | null
          symbol?: string
          target_price?: number
          winning_side?: string | null
          yes_multiplier?: number | null
        }
        Relationships: []
      }
      issues: {
        Row: {
          category: string
          contact: string | null
          created_at: string
          description: string
          email: string | null
          id: string
          page: string | null
          reference: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          contact?: string | null
          created_at?: string
          description: string
          email?: string | null
          id?: string
          page?: string | null
          reference?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          contact?: string | null
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          page?: string | null
          reference?: string | null
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
          parent_id: string | null
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
          parent_id?: string | null
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
          parent_id?: string | null
          stake_amount?: number | null
          stake_side?: string | null
          text?: string
          user_handle?: string
          user_id?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          category: string
          closes_at: string | null
          created_at: string
          ends: string
          featured: boolean
          hot: boolean | null
          id: string
          image: string | null
          is_public: boolean
          news: Json | null
          oracle: string
          outcomes: Json
          proposed: Json | null
          resolved: boolean
          rules: string
          seed: number
          sport: Json | null
          state: string
          thumb: Json | null
          title: string
          traded: number
          updated_at: string
          volume: string | null
          winning_outcome: string | null
        }
        Insert: {
          category: string
          closes_at?: string | null
          created_at?: string
          ends: string
          featured?: boolean
          hot?: boolean | null
          id: string
          image?: string | null
          is_public?: boolean
          news?: Json | null
          oracle: string
          outcomes: Json
          proposed?: Json | null
          resolved?: boolean
          rules: string
          seed?: number
          sport?: Json | null
          state?: string
          thumb?: Json | null
          title: string
          traded?: number
          updated_at?: string
          volume?: string | null
          winning_outcome?: string | null
        }
        Update: {
          category?: string
          closes_at?: string | null
          created_at?: string
          ends?: string
          featured?: boolean
          hot?: boolean | null
          id?: string
          image?: string | null
          is_public?: boolean
          news?: Json | null
          oracle?: string
          outcomes?: Json
          proposed?: Json | null
          resolved?: boolean
          rules?: string
          seed?: number
          sport?: Json | null
          state?: string
          thumb?: Json | null
          title?: string
          traded?: number
          updated_at?: string
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
          asset: string | null
          claimed: boolean | null
          created_at: string
          entry_price: number | null
          id: string
          lock_price: number | null
          market_id: string
          mult: number
          outcome: string
          payout: number
          resolves_at: string | null
          round: number | null
          settled_at: string | null
          shares: number | null
          stake: number
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          asset?: string | null
          claimed?: boolean | null
          created_at?: string
          entry_price?: number | null
          id?: string
          lock_price?: number | null
          market_id: string
          mult: number
          outcome: string
          payout: number
          resolves_at?: string | null
          round?: number | null
          settled_at?: string | null
          shares?: number | null
          stake: number
          status?: string | null
          title?: string
          user_id: string
        }
        Update: {
          asset?: string | null
          claimed?: boolean | null
          created_at?: string
          entry_price?: number | null
          id?: string
          lock_price?: number | null
          market_id?: string
          mult?: number
          outcome?: string
          payout?: number
          resolves_at?: string | null
          round?: number | null
          settled_at?: string | null
          shares?: number | null
          stake?: number
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: number | null
          balance: number
          bio: string
          display_name: string | null
          email: string | null
          frozen: boolean
          handle: string
          id: string
          joined_at: string
          phone: string | null
          prefs: Json
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          avatar?: number | null
          balance?: number
          bio?: string
          display_name?: string | null
          email?: string | null
          frozen?: boolean
          handle: string
          id?: string
          joined_at?: string
          phone?: string | null
          prefs?: Json
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          avatar?: number | null
          balance?: number
          bio?: string
          display_name?: string | null
          email?: string | null
          frozen?: boolean
          handle?: string
          id?: string
          joined_at?: string
          phone?: string | null
          prefs?: Json
          referred_by?: string | null
          updated_at?: string
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
      site_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      _vault_post: {
        Args: { p_amount: number; p_ref: string; p_type: string }
        Returns: number
      }
      finalize_cashier: {
        Args: {
          p_id: string
          p_payload: Json
          p_receipt: string
          p_status: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      place_order: {
        Args: {
          p_asset?: string
          p_entry?: number
          p_lock?: number
          p_market_id: string
          p_multiplier: number
          p_outcome: string
          p_round?: number
          p_stake: number
          p_title?: string
        }
        Returns: Json
      }
      request_withdrawal: {
        Args: { p_amount: number; p_fee: number; p_phone: string }
        Returns: Json
      }
      review_withdrawal: {
        Args: { p_action: string; p_id: string }
        Returns: Json
      }
      set_frozen: { Args: { p_frozen: boolean; p_user: string }; Returns: Json }
      settle_crypto_position: {
        Args: { p_id: string; p_result: string }
        Returns: Json
      }
      settle_market: {
        Args: { p_market_id: string; p_winning_outcome: string }
        Returns: Json
      }
      vault_topup: {
        Args: { p_amount: number; p_note: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "operator" | "finance" | "super_admin"
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
    Enums: {
      app_role: ["operator", "finance", "super_admin"],
    },
  },
} as const
