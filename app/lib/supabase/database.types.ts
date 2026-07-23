export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      class_reviews: {
        Row: {
          id: string;
          user_id: string;
          class_date: string;
          teacher: string;
          dance_style: string;
          class_theme: string;
          difficulty: string | null;
          class_condition: "Tired" | "Okay" | "Great" | null;
          what_i_learned: string;
          not_digested: string;
          video_reference_type: "album_note" | "local_filename" | "cloud_link" | "external_link" | null;
          video_reference_value: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_date: string;
          teacher: string;
          dance_style: string;
          class_theme: string;
          difficulty?: string | null;
          class_condition?: "Tired" | "Okay" | "Great" | null;
          what_i_learned?: string;
          not_digested?: string;
          video_reference_type?: "album_note" | "local_filename" | "cloud_link" | "external_link" | null;
          video_reference_value?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_date?: string;
          teacher?: string;
          dance_style?: string;
          class_theme?: string;
          difficulty?: string | null;
          class_condition?: "Tired" | "Okay" | "Great" | null;
          what_i_learned?: string;
          not_digested?: string;
          video_reference_type?: "album_note" | "local_filename" | "cloud_link" | "external_link" | null;
          video_reference_value?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      practice_tasks: {
        Row: {
          id: string;
          user_id: string;
          class_review_id: string | null;
          title: string;
          key_points: string;
          focus_tags: string[];
          is_high_priority: boolean;
          suggested_duration_minutes: number | null;
          duration_unit: "minutes" | "songs" | null;
          duration_value: number | null;
          status: "active" | "practicing" | "done" | "digested" | "completed" | "paused";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_review_id?: string | null;
          title: string;
          key_points?: string;
          focus_tags?: string[];
          is_high_priority?: boolean;
          suggested_duration_minutes?: number | null;
          duration_unit?: "minutes" | "songs" | null;
          duration_value?: number | null;
          status?: "active" | "practicing" | "done" | "digested" | "completed" | "paused";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_review_id?: string | null;
          title?: string;
          key_points?: string;
          focus_tags?: string[];
          is_high_priority?: boolean;
          suggested_duration_minutes?: number | null;
          duration_unit?: "minutes" | "songs" | null;
          duration_value?: number | null;
          status?: "active" | "practicing" | "done" | "digested" | "completed" | "paused";
          created_at?: string;
          updated_at?: string;
        };
      };
      practice_logs: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          class_review_id: string | null;
          practice_date: string;
          duration_unit: "minutes" | "songs";
          duration_value: number;
          duration_minutes: number | null;
          songs_count: number | null;
          practice_content: string;
          progress_score: number;
          next_focus: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          class_review_id?: string | null;
          practice_date: string;
          duration_unit?: "minutes" | "songs";
          duration_value: number;
          duration_minutes?: number | null;
          songs_count?: number | null;
          practice_content: string;
          progress_score: number;
          next_focus?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          class_review_id?: string | null;
          practice_date?: string;
          duration_unit?: "minutes" | "songs";
          duration_value?: number;
          duration_minutes?: number | null;
          songs_count?: number | null;
          practice_content?: string;
          progress_score?: number;
          next_focus?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      weekly_reflections: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          improved: string;
          still_stuck: string;
          next_focus_note: string;
          next_focus_tags: string[];
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          improved?: string;
          still_stuck?: string;
          next_focus_note?: string;
          next_focus_tags?: string[];
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          improved?: string;
          still_stuck?: string;
          next_focus_note?: string;
          next_focus_tags?: string[];
          updated_at?: string;
        };
      };
      user_preferences: {
        Row: {
          user_id: string;
          default_practice_duration_minutes: number;
          practice_queue_sort_order: "newest" | "oldest";
          show_difficulty: boolean;
          show_body_status: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_practice_duration_minutes?: number;
          practice_queue_sort_order?: "newest" | "oldest";
          show_difficulty?: boolean;
          show_body_status?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          default_practice_duration_minutes?: number;
          practice_queue_sort_order?: "newest" | "oldest";
          show_difficulty?: boolean;
          show_body_status?: boolean;
          updated_at?: string;
        };
      };
      local_storage_migrations: {
        Row: {
          id: string;
          user_id: string;
          migration_version: string;
          source_fingerprint: string;
          status: "pending" | "succeeded" | "failed";
          imported_counts: Json | null;
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          migration_version: string;
          source_fingerprint: string;
          status: "pending" | "succeeded" | "failed";
          imported_counts?: Json | null;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          migration_version?: string;
          source_fingerprint?: string;
          status?: "pending" | "succeeded" | "failed";
          imported_counts?: Json | null;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
    };
  };
};
