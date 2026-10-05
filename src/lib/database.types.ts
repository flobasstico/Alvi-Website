// Generiert aus dem Supabase-Schema (generate_typescript_types), gekürzt um Helper-Generics.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Rel = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      escalation_rules: {
        Row: { active: boolean; created_at: string; id: number; text: string }
        Insert: { active?: boolean; created_at?: string; id?: never; text: string }
        Update: { active?: boolean; created_at?: string; id?: never; text?: string }
        Relationships: []
      }
      escalation_sessions: {
        Row: { challenge_id: number | null; created_at: string; ended_at: string | null; host_id: string; id: number; interval_s: number; pool_exhausted: boolean; result: string | null; started_at: string | null; status: string; title: string | null; winner_id: string | null; winner_name: string | null; mode: string; twitch_channel: string | null }
        Insert: { challenge_id?: number | null; created_at?: string; ended_at?: string | null; host_id?: string; id?: never; interval_s?: number; pool_exhausted?: boolean; result?: string | null; started_at?: string | null; status?: string; title?: string | null; winner_id?: string | null; winner_name?: string | null; mode?: string; twitch_channel?: string | null }
        Update: { challenge_id?: number | null; created_at?: string; ended_at?: string | null; host_id?: string; id?: never; interval_s?: number; pool_exhausted?: boolean; result?: string | null; started_at?: string | null; status?: string; title?: string | null; winner_id?: string | null; winner_name?: string | null; mode?: string; twitch_channel?: string | null }
        Relationships: Rel[]
      }
      escalation_polls: {
        Row: { announced_at: string | null; closes_at: string; id: number; opens_at: string; options: Json; position: number; result_announced_at: string | null; session_id: number; status: string; total_votes: number | null; winner_option: number | null; winner_votes: number | null }
        Insert: { announced_at?: string | null; closes_at: string; id?: never; opens_at: string; options: Json; position: number; result_announced_at?: string | null; session_id: number; status?: string; total_votes?: number | null; winner_option?: number | null; winner_votes?: number | null }
        Update: { announced_at?: string | null; closes_at?: string; id?: never; opens_at?: string; options?: Json; position?: number; result_announced_at?: string | null; session_id?: number; status?: string; total_votes?: number | null; winner_option?: number | null; winner_votes?: number | null }
        Relationships: Rel[]
      }
      escalation_votes: {
        Row: { option: number; poll_id: number; voted_at: string; voter: string }
        Insert: { option: number; poll_id: number; voted_at?: string; voter: string }
        Update: { option?: number; poll_id?: number; voted_at?: string; voter?: string }
        Relationships: Rel[]
      }
      loadout_sessions: {
        Row: { challenge_id: number | null; created_at: string; ended_at: string | null; host_id: string; id: number; must_heal: boolean; rarities: string[]; result: string | null; season_id: number | null; slots: number; started_at: string | null; status: string; title: string | null; winner_id: string | null; winner_name: string | null }
        Insert: { challenge_id?: number | null; created_at?: string; ended_at?: string | null; host_id?: string; id?: never; must_heal?: boolean; rarities: string[]; result?: string | null; season_id?: number | null; slots?: number; started_at?: string | null; status?: string; title?: string | null; winner_id?: string | null; winner_name?: string | null }
        Update: { challenge_id?: number | null; created_at?: string; ended_at?: string | null; host_id?: string; id?: never; must_heal?: boolean; rarities?: string[]; result?: string | null; season_id?: number | null; slots?: number; started_at?: string | null; status?: string; title?: string | null; winner_id?: string | null; winner_name?: string | null }
        Relationships: Rel[]
      }
      loadout_players: {
        Row: { avatar_url: string | null; display_name: string | null; item_ids: (number | null)[]; joined_at: string; rolled_at: string | null; session_id: number; user_id: string }
        Insert: { avatar_url?: string | null; display_name?: string | null; item_ids?: (number | null)[]; joined_at?: string; rolled_at?: string | null; session_id: number; user_id: string }
        Update: { avatar_url?: string | null; display_name?: string | null; item_ids?: (number | null)[]; joined_at?: string; rolled_at?: string | null; session_id?: number; user_id?: string }
        Relationships: Rel[]
      }
      escalation_players: {
        Row: { avatar_url: string | null; display_name: string | null; joined_at: string; session_id: number; user_id: string }
        Insert: { avatar_url?: string | null; display_name?: string | null; joined_at?: string; session_id: number; user_id: string }
        Update: { avatar_url?: string | null; display_name?: string | null; joined_at?: string; session_id?: number; user_id?: string }
        Relationships: Rel[]
      }
      site_settings: {
        Row: { key: string; value: string }
        Insert: { key: string; value: string }
        Update: { key?: string; value?: string }
        Relationships: []
      }
      escalation_session_rules: {
        Row: { added_at: string; position: number; rule_id: number | null; session_id: number; text: string }
        Insert: { added_at?: string; position: number; rule_id?: number | null; session_id: number; text: string }
        Update: { added_at?: string; position?: number; rule_id?: number | null; session_id?: number; text?: string }
        Relationships: Rel[]
      }
      auctions: {
        Row: { bid_seconds: number; bid_step: number; challenge_id: number | null; created_at: string; ended_at: string | null; ended_reason: string | null; host_id: string; id: number; items_per_player: number; max_players: number; no_duplicates: boolean; rarities: string[]; season_id: number | null; start_gold: number; status: string; title: string | null }
        Insert: { bid_seconds?: number; bid_step?: number; challenge_id?: number | null; created_at?: string; ended_at?: string | null; ended_reason?: string | null; host_id?: string; id?: never; items_per_player?: number; max_players?: number; no_duplicates?: boolean; rarities?: string[]; season_id?: number | null; start_gold?: number; status?: string; title?: string | null }
        Update: { bid_seconds?: number; bid_step?: number; challenge_id?: number | null; created_at?: string; ended_at?: string | null; ended_reason?: string | null; host_id?: string; id?: never; items_per_player?: number; max_players?: number; no_duplicates?: boolean; rarities?: string[]; season_id?: number | null; start_gold?: number; status?: string; title?: string | null }
        Relationships: Rel[]
      }
      auction_players: {
        Row: { acted_round: number; auction_id: number; avatar_url: string | null; display_name: string | null; gold: number; item_count: number; joined_at: string; seat: number; user_id: string }
        Insert: { acted_round?: number; auction_id: number; avatar_url?: string | null; display_name?: string | null; gold: number; item_count?: number; joined_at?: string; seat: number; user_id: string }
        Update: { acted_round?: number; auction_id?: number; avatar_url?: string | null; display_name?: string | null; gold?: number; item_count?: number; joined_at?: string; seat?: number; user_id?: string }
        Relationships: Rel[]
      }
      auction_rounds: {
        Row: { auction_id: number; deadline: string | null; id: number; item_icon_url: string | null; item_id: number | null; item_name: string; item_rarity: string; item_type: string; opens_at: string; price: number | null; resolved_at: string | null; round_no: number; status: string; tie: boolean; winner_seat: number | null }
        Insert: { auction_id: number; deadline?: string | null; id?: never; item_icon_url?: string | null; item_id?: number | null; item_name: string; item_rarity: string; item_type: string; opens_at?: string; price?: number | null; resolved_at?: string | null; round_no: number; status?: string; tie?: boolean; winner_seat?: number | null }
        Update: { auction_id?: number; deadline?: string | null; id?: never; item_icon_url?: string | null; item_id?: number | null; item_name?: string; item_rarity?: string; item_type?: string; opens_at?: string; price?: number | null; resolved_at?: string | null; round_no?: number; status?: string; tie?: boolean; winner_seat?: number | null }
        Relationships: Rel[]
      }
      auction_bids: {
        Row: { amount: number | null; auction_id: number; created_at: string; round_id: number; seat: number }
        Insert: { amount?: number | null; auction_id: number; created_at?: string; round_id: number; seat: number }
        Update: { amount?: number | null; auction_id?: number; created_at?: string; round_id?: number; seat?: number }
        Relationships: Rel[]
      }
      bingo_cards: {
        Row: { bingo_at: string | null; created_at: string; game_id: number; task_ids: number[]; user_id: string }
        Insert: { bingo_at?: string | null; created_at?: string; game_id: number; task_ids: number[]; user_id?: string }
        Update: { bingo_at?: string | null; created_at?: string; game_id?: number; task_ids?: number[]; user_id?: string }
        Relationships: Rel[]
      }
      bingo_games: {
        Row: { challenge_id: number | null; id: number; started_at: string; status: string; task_ids: number[]; title: string | null }
        Insert: { challenge_id?: number | null; id?: never; started_at?: string; status?: string; task_ids: number[]; title?: string | null }
        Update: { challenge_id?: number | null; id?: never; started_at?: string; status?: string; task_ids?: number[]; title?: string | null }
        Relationships: Rel[]
      }
      bingo_marks: {
        Row: { game_id: number; marked_at: string; task_id: number }
        Insert: { game_id: number; marked_at?: string; task_id: number }
        Update: { game_id?: number; marked_at?: string; task_id?: number }
        Relationships: Rel[]
      }
      bingo_tasks: {
        Row: { active: boolean; created_at: string; id: number; text: string }
        Insert: { active?: boolean; created_at?: string; id?: never; text: string }
        Update: { active?: boolean; created_at?: string; id?: never; text?: string }
        Relationships: []
      }
      challenges: {
        Row: { config: Json; created_at: string; description: string | null; id: number; played_at: string | null; source: string; status: string; title: string; video_url: string | null }
        Insert: { config?: Json; created_at?: string; description?: string | null; id?: never; played_at?: string | null; source: string; status?: string; title: string; video_url?: string | null }
        Update: { config?: Json; created_at?: string; description?: string | null; id?: never; played_at?: string | null; source?: string; status?: string; title?: string; video_url?: string | null }
        Relationships: []
      }
      drop_spots: {
        Row: { active: boolean; created_at: string; id: number; name: string; season_id: number | null; x: number; y: number }
        Insert: { active?: boolean; created_at?: string; id?: never; name: string; season_id?: number | null; x: number; y: number }
        Update: { active?: boolean; created_at?: string; id?: never; name?: string; season_id?: number | null; x?: number; y?: number }
        Relationships: Rel[]
      }
      loot_items: {
        Row: { active: boolean; created_at: string; icon_url: string | null; id: number; name: string; rarity: string; season_id: number | null; type: string }
        Insert: { active?: boolean; created_at?: string; icon_url?: string | null; id?: never; name: string; rarity: string; season_id?: number | null; type: string }
        Update: { active?: boolean; created_at?: string; icon_url?: string | null; id?: never; name?: string; rarity?: string; season_id?: number | null; type?: string }
        Relationships: Rel[]
      }
      profiles: {
        Row: { avatar_url: string | null; created_at: string; display_name: string | null; id: string; role: string; twitch_login: string | null }
        Insert: { avatar_url?: string | null; created_at?: string; display_name?: string | null; id: string; role?: string; twitch_login?: string | null }
        Update: { avatar_url?: string | null; created_at?: string; display_name?: string | null; id?: string; role?: string; twitch_login?: string | null }
        Relationships: []
      }
      rules: {
        Row: { active: boolean; category: string; created_at: string; id: number; text: string; weight: number }
        Insert: { active?: boolean; category?: string; created_at?: string; id?: never; text: string; weight?: number }
        Update: { active?: boolean; category?: string; created_at?: string; id?: never; text?: string; weight?: number }
        Relationships: []
      }
      seasons: {
        Row: { created_at: string; id: number; is_current: boolean; map_image_url: string | null; name: string }
        Insert: { created_at?: string; id?: never; is_current?: boolean; map_image_url?: string | null; name: string }
        Update: { created_at?: string; id?: never; is_current?: boolean; map_image_url?: string | null; name?: string }
        Relationships: []
      }
    }
    Views: {
      escalation_poll_counts: {
        Row: { option: number | null; poll_id: number | null; votes: number | null }
        Relationships: Rel[]
      }
      loadout_leaderboard: {
        Row: { last_win: string | null; name: string | null; winner_id: string | null; wins: number | null }
        Relationships: Rel[]
      }
      escalation_leaderboard: {
        Row: { last_win: string | null; name: string | null; winner_id: string | null; wins: number | null }
        Relationships: Rel[]
      }
      challenge_stats: {
        Row: { finished: number | null; lost: number | null; source: string | null; total: number | null; won: number | null }
        Relationships: []
      }
    }
    Functions: {
      auction_bid: { Args: { p_amount: number | null; p_round: number }; Returns: undefined }
      auction_join: { Args: { p_auction: number }; Returns: number }
      auction_leave: { Args: { p_auction: number; p_seat?: number | null }; Returns: undefined }
      auction_resolve_expired: { Args: { p_round: number }; Returns: undefined }
      auction_start: { Args: { p_auction: number }; Returns: undefined }
      escalation_create: { Args: { p_channel: string | null; p_interval_s: number; p_mode: string; p_title: string }; Returns: number }
      escalation_poll_mark: { Args: { p_kind: string; p_poll: number }; Returns: boolean }
      escalation_poll_vote: { Args: { p_option: number; p_poll: number; p_voter: string }; Returns: boolean }
      escalation_draw_base: { Args: { p_session: number }; Returns: number }
      escalation_start: { Args: { p_session: number }; Returns: undefined }
      escalation_finish: { Args: { p_session: number; p_winner: string | null }; Returns: undefined }
      escalation_join: { Args: { p_session: number }; Returns: undefined }
      escalation_leave: { Args: { p_session: number; p_user?: string | null }; Returns: undefined }
      escalation_tick: { Args: { p_session: number }; Returns: number }
      loadout_create: { Args: { p_must_heal: boolean; p_rarities: string[]; p_title: string }; Returns: number }
      loadout_finish: { Args: { p_session: number; p_winner: string | null }; Returns: undefined }
      loadout_join: { Args: { p_session: number }; Returns: undefined }
      loadout_leave: { Args: { p_session: number; p_user?: string | null }; Returns: undefined }
      loadout_set_items: { Args: { p_items: (number | null)[]; p_session: number }; Returns: undefined }
      loadout_start: { Args: { p_session: number }; Returns: undefined }
      card_has_bingo: { Args: { p_game_id: number; p_task_ids: number[] }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
