export type SignalRow = {
  id: string;
  type: string;
  venue_id: string | null;
  content: string | null;
  strength: number;
  emitted_at: string;
  expires_at: string;
  location: string | { type: "Point"; coordinates: [number, number] } | null;
};

export type InsertSignalWithLocationArgs = {
  p_venue_id?: string | null;
  p_content?: string | null;
  p_vibe?: string | null;
  p_location_expr: string;
};

export interface Database {
  public: {
    Tables: {
      signals: {
        Row: SignalRow;
        Insert: {
          id?: string;
          type?: string;
          venue_id?: string | null;
          content?: string | null;
          strength?: number;
          emitted_at?: string;
          expires_at?: string;
          location?: SignalRow["location"];
        };
        Update: {
          type?: string;
          venue_id?: string | null;
          content?: string | null;
          strength?: number;
          emitted_at?: string;
          expires_at?: string;
          location?: SignalRow["location"];
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      insert_signal_with_location: {
        Args: InsertSignalWithLocationArgs;
        Returns: SignalRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
