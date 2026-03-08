export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          content: string | null
          created_at: string
          emitted_at: string | null
          event_id: string | null
          expires_at: string | null
          geo: unknown
          id: string
          source_user_id: string | null
          strength: number | null
          type: Database["public"]["Enums"]["signaltype"]
          venue_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          emitted_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          geo: unknown
          id?: string
          source_user_id?: string | null
          strength?: number | null
          type: Database["public"]["Enums"]["signaltype"]
          venue_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          emitted_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          geo?: unknown
          id?: string
          source_user_id?: string | null
          strength?: number | null
          type?: Database["public"]["Enums"]["signaltype"]
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          home_city: string | null
          id: string
          last_active: string | null
          name: string | null
          onboarding_complete: boolean | null
          phone: string | null
          preference_vector: number[] | null
          supabase_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          home_city?: string | null
          id: string
          last_active?: string | null
          name?: string | null
          onboarding_complete?: boolean | null
          phone?: string | null
          preference_vector?: number[] | null
          supabase_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          home_city?: string | null
          id?: string
          last_active?: string | null
          name?: string | null
          onboarding_complete?: boolean | null
          phone?: string | null
          preference_vector?: number[] | null
          supabase_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_nearby_signals: {
        Args: { lat: number; lng: number; radius_meters?: number }
        Returns: {
          dist_meters: number
          id: string
          signal_type: string
          venue_id: string
        }[]
      }
    }
    Enums: {
      signaltype: "PRESENCE" | "VIBE" | "MOMENT" | "SYNC"
    }
  }
}