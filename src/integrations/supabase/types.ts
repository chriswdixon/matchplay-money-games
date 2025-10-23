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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          description: string
          id: string
          match_id: string | null
          metadata: Json | null
          stripe_payment_intent_id: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          description: string
          id?: string
          match_id?: string | null
          metadata?: Json | null
          stripe_payment_intent_id?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          description?: string
          id?: string
          match_id?: string | null
          metadata?: Json | null
          stripe_payment_intent_id?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "player_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access_log: {
        Row: {
          accessed_table: string
          accessed_user_id: string | null
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json | null
        }
        Insert: {
          accessed_table: string
          accessed_user_id?: string | null
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          accessed_table?: string
          accessed_user_id?: string | null
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      double_down_participants: {
        Row: {
          additional_buyin: number
          created_at: string
          id: string
          match_id: string
          opted_in: boolean
          payment_intent_id: string | null
          payment_processed: boolean
          responded: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_buyin?: number
          created_at?: string
          id?: string
          match_id: string
          opted_in?: boolean
          payment_intent_id?: string | null
          payment_processed?: boolean
          responded?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_buyin?: number
          created_at?: string
          id?: string
          match_id?: string
          opted_in?: boolean
          payment_intent_id?: string | null
          payment_processed?: boolean
          responded?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "double_down_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_courses: {
        Row: {
          address: string | null
          course_name: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          user_id: string
        }
        Insert: {
          address?: string | null
          course_name: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          user_id: string
        }
        Update: {
          address?: string | null
          course_name?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          user_id?: string
        }
        Relationships: []
      }
      golf_courses: {
        Row: {
          address: string | null
          ai_enriched: boolean | null
          ai_rating: number | null
          amenities: Json | null
          city: string | null
          country: string | null
          course_style: string | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          external_id: string | null
          features: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          search_keywords: string | null
          state: string | null
          updated_at: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          ai_enriched?: boolean | null
          ai_rating?: number | null
          amenities?: Json | null
          city?: string | null
          country?: string | null
          course_style?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          external_id?: string | null
          features?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          search_keywords?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          ai_enriched?: boolean | null
          ai_rating?: number | null
          amenities?: Json | null
          city?: string | null
          country?: string | null
          course_style?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          external_id?: string | null
          features?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          search_keywords?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          metadata: Json | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          metadata?: Json | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      match_cancellation_confirmations: {
        Row: {
          alternate_reason: string | null
          cancelling_player_id: string
          confirmed: boolean
          confirmed_at: string | null
          confirming_player_id: string
          created_at: string
          id: string
          match_id: string
          stated_reason: string
        }
        Insert: {
          alternate_reason?: string | null
          cancelling_player_id: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirming_player_id: string
          created_at?: string
          id?: string
          match_id: string
          stated_reason: string
        }
        Update: {
          alternate_reason?: string | null
          cancelling_player_id?: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirming_player_id?: string
          created_at?: string
          id?: string
          match_id?: string
          stated_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_cancellation_confirmations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_cancellation_reviews: {
        Row: {
          admin_decision: string | null
          admin_notes: string | null
          cancelling_player_id: string
          created_at: string
          dispute_reasons: Json
          disputed: boolean
          id: string
          match_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          stated_reason: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_decision?: string | null
          admin_notes?: string | null
          cancelling_player_id: string
          created_at?: string
          dispute_reasons?: Json
          disputed?: boolean
          id?: string
          match_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          stated_reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_decision?: string | null
          admin_notes?: string | null
          cancelling_player_id?: string
          created_at?: string
          dispute_reasons?: Json
          disputed?: boolean
          id?: string
          match_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          stated_reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_cancellation_reviews_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_confirmations: {
        Row: {
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          id: string
          match_id: string
          player_id: string
        }
        Insert: {
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          match_id: string
          player_id: string
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
        }
        Relationships: []
      }
      match_join_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          match_id: string
          team_number: number
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          match_id: string
          team_number: number
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          match_id?: string
          team_number?: number
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_join_tokens_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          id: string
          joined_at: string
          match_id: string
          selected_tees: string | null
          status: string
          team_number: number | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          match_id: string
          selected_tees?: string | null
          status?: string
          team_number?: number | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          match_id?: string
          selected_tees?: string | null
          status?: string
          team_number?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          completed_at: string | null
          created_at: string
          final_scores: Json
          finalized_at: string | null
          finalized_by: string | null
          forfeited_players: Json | null
          id: string
          match_id: string
          updated_at: string
          winner_id: string | null
          winners: string[] | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          final_scores?: Json
          finalized_at?: string | null
          finalized_by?: string | null
          forfeited_players?: Json | null
          id?: string
          match_id: string
          updated_at?: string
          winner_id?: string | null
          winners?: string[] | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          final_scores?: Json
          finalized_at?: string | null
          finalized_by?: string | null
          forfeited_players?: Json | null
          id?: string
          match_id?: string
          updated_at?: string
          winner_id?: string | null
          winners?: string[] | null
        }
        Relationships: []
      }
      match_scores: {
        Row: {
          created_at: string
          hole_number: number
          id: string
          match_id: string
          player_id: string
          strokes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hole_number: number
          id?: string
          match_id: string
          player_id: string
          strokes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hole_number?: number
          id?: string
          match_id?: string
          player_id?: string
          strokes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          address: string | null
          booking_url: string | null
          buy_in_amount: number
          course_name: string
          created_at: string
          created_by: string
          default_tees: string | null
          double_down_amount: number | null
          double_down_enabled: boolean | null
          double_down_finalized: boolean | null
          format: string
          handicap_max: number | null
          handicap_min: number | null
          hole_pars: Json | null
          holes: number
          id: string
          is_team_format: boolean | null
          latitude: number | null
          location: string
          longitude: number | null
          max_participants: number
          pin: string | null
          scheduled_time: string
          status: string
          team1_pin_creator: string | null
          team2_pin: string | null
          team2_pin_creator: string | null
          team3_pin: string | null
          team3_pin_creator: string | null
          team4_pin: string | null
          team4_pin_creator: string | null
          tee_selection_mode: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_url?: string | null
          buy_in_amount?: number
          course_name: string
          created_at?: string
          created_by: string
          default_tees?: string | null
          double_down_amount?: number | null
          double_down_enabled?: boolean | null
          double_down_finalized?: boolean | null
          format: string
          handicap_max?: number | null
          handicap_min?: number | null
          hole_pars?: Json | null
          holes?: number
          id?: string
          is_team_format?: boolean | null
          latitude?: number | null
          location: string
          longitude?: number | null
          max_participants?: number
          pin?: string | null
          scheduled_time: string
          status?: string
          team1_pin_creator?: string | null
          team2_pin?: string | null
          team2_pin_creator?: string | null
          team3_pin?: string | null
          team3_pin_creator?: string | null
          team4_pin?: string | null
          team4_pin_creator?: string | null
          tee_selection_mode?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_url?: string | null
          buy_in_amount?: number
          course_name?: string
          created_at?: string
          created_by?: string
          default_tees?: string | null
          double_down_amount?: number | null
          double_down_enabled?: boolean | null
          double_down_finalized?: boolean | null
          format?: string
          handicap_max?: number | null
          handicap_min?: number | null
          hole_pars?: Json | null
          holes?: number
          id?: string
          is_team_format?: boolean | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          max_participants?: number
          pin?: string | null
          scheduled_time?: string
          status?: string
          team1_pin_creator?: string | null
          team2_pin?: string | null
          team2_pin_creator?: string | null
          team3_pin?: string | null
          team3_pin_creator?: string | null
          team4_pin?: string | null
          team4_pin_creator?: string | null
          tee_selection_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      pin_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_address: string | null
          match_id: string
          success: boolean
          team_number: number | null
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address?: string | null
          match_id: string
          success?: boolean
          team_number?: number | null
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: string | null
          match_id?: string
          success?: boolean
          team_number?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_attempts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      player_accounts: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_ratings: {
        Row: {
          created_at: string
          id: string
          match_id: string
          rated_player_id: string
          rater_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          rated_player_id: string
          rater_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          rated_player_id?: string
          rater_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      private_profile_data: {
        Row: {
          created_at: string
          date_of_birth: string | null
          id: string
          membership_tier: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          id?: string
          membership_tier?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          id?: string
          membership_tier?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          profile_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          profile_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          profile_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_audit_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          average_rating: number | null
          created_at: string
          display_name: string | null
          first_name: string | null
          handicap: number | null
          id: string
          last_name: string | null
          profile_picture_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_rating?: number | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          handicap?: number | null
          id?: string
          last_name?: string | null
          profile_picture_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_rating?: number | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          handicap?: number | null
          id?: string
          last_name?: string | null
          profile_picture_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_links: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          platform: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          platform: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          platform?: string
          updated_at?: string
          url?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_resolve_cancellation_review: {
        Args: {
          p_admin_notes?: string
          p_decision: string
          p_review_id: string
        }
        Returns: Json
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_player_average_rating: {
        Args: { player_user_id: string }
        Returns: number
      }
      cleanup_expired_join_tokens: { Args: never; Returns: number }
      cleanup_old_temp_media: { Args: never; Returns: number }
      create_match_join_token: {
        Args: {
          p_expires_in_seconds?: number
          p_match_id: string
          p_team_number: number
        }
        Returns: string
      }
      finalize_match_results: { Args: { p_match_id: string }; Returns: boolean }
      get_match_creator_info: {
        Args: { match_id: string }
        Returns: {
          can_manage: boolean
          is_creator: boolean
        }[]
      }
      get_match_participant_count: {
        Args: { match_id: string }
        Returns: number
      }
      get_match_with_location_filter: {
        Args: { match_id: string }
        Returns: {
          address: string
          buy_in_amount: number
          course_name: string
          created_at: string
          format: string
          handicap_max: number
          handicap_min: number
          id: string
          is_creator: boolean
          is_participant: boolean
          latitude: number
          location: string
          longitude: number
          max_participants: number
          scheduled_time: string
          status: string
          updated_at: string
        }[]
      }
      get_nearby_matches: {
        Args: { radius_km?: number; user_lat: number; user_lon: number }
        Returns: {
          address: string
          buy_in_amount: number
          course_name: string
          distance_km: number
          format: string
          id: string
          location: string
          scheduled_time: string
        }[]
      }
      get_public_profile: {
        Args: { profile_user_id: string }
        Returns: {
          average_rating: number
          created_at: string
          display_name: string
          handicap: number
          id: string
          profile_picture_url: string
          user_id: string
        }[]
      }
      get_rateable_players_for_match: {
        Args: { match_id: string; rater_user_id: string }
        Returns: {
          already_rated: boolean
          display_name: string
          user_id: string
        }[]
      }
      get_user_account_info: {
        Args: { target_user_id: string }
        Returns: {
          account_id: string
          balance: number
          total_buyins: number
          total_payouts: number
          total_winnings: number
          transaction_count: number
        }[]
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      get_user_private_data: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          membership_tier: string
          phone: string
          updated_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_match_creator: { Args: { match_id: string }; Returns: boolean }
      is_match_participant: {
        Args: { match_id: string; user_id: string }
        Returns: boolean
      }
      is_match_play_email: { Args: { email: string }; Returns: boolean }
      is_profile_owner: { Args: { profile_user_id: string }; Returns: boolean }
      is_user_match_creator: {
        Args: { p_match_id: string; p_user_id: string }
        Returns: boolean
      }
      is_user_match_participant: {
        Args: { p_match_id: string; p_user_id: string }
        Returns: boolean
      }
      leave_match_with_dnf: {
        Args: { p_match_id: string; p_reason: string; p_user_id: string }
        Returns: Json
      }
      link_invite_to_user: {
        Args: { p_code: string; p_user_id: string }
        Returns: undefined
      }
      recalculate_player_handicap: {
        Args: { player_user_id: string }
        Returns: undefined
      }
      sanitize_text_input: { Args: { input_text: string }; Returns: string }
      start_match: { Args: { match_id: string }; Returns: boolean }
      user_joined_match: {
        Args: { match_id: string; user_id: string }
        Returns: boolean
      }
      validate_and_consume_invite: {
        Args: { p_code: string; p_email: string }
        Returns: Json
      }
      validate_and_join_match: {
        Args: {
          p_match_id: string
          p_pin?: string
          p_set_team_pin?: string
          p_team_number?: number
        }
        Returns: Json
      }
      validate_match_join_token: {
        Args: { p_token: string }
        Returns: {
          match_id: string
          pin: string
          team_number: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      transaction_type:
        | "winning"
        | "match_buyin"
        | "match_cancellation"
        | "subscription_charge"
        | "coupon"
        | "payout"
        | "double_down"
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
      app_role: ["admin", "moderator", "user"],
      transaction_type: [
        "winning",
        "match_buyin",
        "match_cancellation",
        "subscription_charge",
        "coupon",
        "payout",
        "double_down",
      ],
    },
  },
} as const
