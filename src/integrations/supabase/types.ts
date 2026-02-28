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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      detections: {
        Row: {
          bbox_h: number
          bbox_w: number
          bbox_x: number
          bbox_y: number
          confidence: number
          id: string
          label: string
          mission_media_id: string
        }
        Insert: {
          bbox_h: number
          bbox_w: number
          bbox_x: number
          bbox_y: number
          confidence: number
          id?: string
          label: string
          mission_media_id: string
        }
        Update: {
          bbox_h?: number
          bbox_w?: number
          bbox_x?: number
          bbox_y?: number
          confidence?: number
          id?: string
          label?: string
          mission_media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detections_mission_media_id_fkey"
            columns: ["mission_media_id"]
            isOneToOne: false
            referencedRelation: "mission_media"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_analysis: {
        Row: {
          co2_saved_kg: number
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          improvement_pct: number
          items_after: number
          items_before: number
          mission_id: string
          waste_diverted_kg: number
        }
        Insert: {
          co2_saved_kg?: number
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          improvement_pct?: number
          items_after?: number
          items_before?: number
          mission_id: string
          waste_diverted_kg?: number
        }
        Update: {
          co2_saved_kg?: number
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          improvement_pct?: number
          items_after?: number
          items_before?: number
          mission_id?: string
          waste_diverted_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "mission_analysis_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_media: {
        Row: {
          created_at: string
          id: string
          image_url: string
          kind: Database["public"]["Enums"]["media_kind"]
          mission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          kind: Database["public"]["Enums"]["media_kind"]
          mission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          mission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_media_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_participants: {
        Row: {
          contribution_pct: number | null
          id: string
          joined_at: string
          mission_id: string
          points_earned: number | null
          user_id: string
        }
        Insert: {
          contribution_pct?: number | null
          id?: string
          joined_at?: string
          mission_id: string
          points_earned?: number | null
          user_id: string
        }
        Update: {
          contribution_pct?: number | null
          id?: string
          joined_at?: string
          mission_id?: string
          points_earned?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_participants_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          before_photo_url: string | null
          cleanup_progress_pct: number | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          is_help_request: boolean | null
          lat: number
          lng: number
          severity_color: string | null
          status: Database["public"]["Enums"]["mission_status"]
          time_estimate: string | null
          title: string | null
          tools_needed: string[] | null
          updated_at: string
          volunteers_needed: number | null
          waste_category: string | null
          zone_id: string | null
        }
        Insert: {
          before_photo_url?: string | null
          cleanup_progress_pct?: number | null
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          is_help_request?: boolean | null
          lat: number
          lng: number
          severity_color?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          time_estimate?: string | null
          title?: string | null
          tools_needed?: string[] | null
          updated_at?: string
          volunteers_needed?: number | null
          waste_category?: string | null
          zone_id?: string | null
        }
        Update: {
          before_photo_url?: string | null
          cleanup_progress_pct?: number | null
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          is_help_request?: boolean | null
          lat?: number
          lng?: number
          severity_color?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          time_estimate?: string | null
          title?: string | null
          tools_needed?: string[] | null
          updated_at?: string
          volunteers_needed?: number | null
          waste_category?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "missions_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      points_log: {
        Row: {
          created_at: string
          id: string
          mission_id: string | null
          points: number
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id?: string | null
          points: number
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string | null
          points?: number
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_log_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          id: string
          is_cleaning: boolean
          lat: number
          lng: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_cleaning?: boolean
          lat: number
          lng: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_cleaning?: boolean
          lat?: number
          lng?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          id: string
          last_action_at: string | null
          level: number
          monthly_points: number
          streak_days: number
          total_points: number
          user_id: string
          weekly_points: number
        }
        Insert: {
          id?: string
          last_action_at?: string | null
          level?: number
          monthly_points?: number
          streak_days?: number
          total_points?: number
          user_id: string
          weekly_points?: number
        }
        Update: {
          id?: string
          last_action_at?: string | null
          level?: number
          monthly_points?: number
          streak_days?: number
          total_points?: number
          user_id?: string
          weekly_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      zones: {
        Row: {
          center_lat: number
          center_lng: number
          id: string
          name: string
          radius_m: number
          severity: Database["public"]["Enums"]["zone_severity"]
        }
        Insert: {
          center_lat: number
          center_lng: number
          id?: string
          name: string
          radius_m?: number
          severity?: Database["public"]["Enums"]["zone_severity"]
        }
        Update: {
          center_lat?: number
          center_lng?: number
          id?: string
          name?: string
          radius_m?: number
          severity?: Database["public"]["Enums"]["zone_severity"]
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
      difficulty_level: "EASY" | "MODERATE" | "HARD"
      media_kind: "BEFORE" | "AFTER"
      mission_status: "OPEN" | "IN_PROGRESS" | "CLEANED"
      zone_severity: "GREEN" | "YELLOW" | "RED"
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
      difficulty_level: ["EASY", "MODERATE", "HARD"],
      media_kind: ["BEFORE", "AFTER"],
      mission_status: ["OPEN", "IN_PROGRESS", "CLEANED"],
      zone_severity: ["GREEN", "YELLOW", "RED"],
    },
  },
} as const
