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
      exam_attempts: {
        Row: {
          answers: Json
          created_at: string | null
          exam_id: string
          graded_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at: string | null
          time_taken: number | null
          total_score: number
          updated_at: string | null
          version: number
        }
        Insert: {
          answers?: Json
          created_at?: string | null
          exam_id: string
          graded_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at?: string | null
          time_taken?: number | null
          total_score?: number
          updated_at?: string | null
          version?: number
        }
        Update: {
          answers?: Json
          created_at?: string | null
          exam_id?: string
          graded_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string
          submitted_at?: string | null
          time_taken?: number | null
          total_score?: number
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          exam_id: string
          id: string
          order_number: number
          question_id: string
        }
        Insert: {
          exam_id: string
          id?: string
          order_number: number
          question_id: string
        }
        Update: {
          exam_id?: string
          id?: string
          order_number?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          attempt_id: string
          created_at: string | null
          feedback: string | null
          graded_at: string | null
          grader_id: string | null
          id: string
          is_correct: boolean | null
          max_score: number
          question_id: string
          score: number
          selected_option_id: string | null
          updated_at: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string | null
          feedback?: string | null
          graded_at?: string | null
          grader_id?: string | null
          id?: string
          is_correct?: boolean | null
          max_score: number
          question_id: string
          score?: number
          selected_option_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string | null
          feedback?: string | null
          graded_at?: string | null
          grader_id?: string | null
          id?: string
          is_correct?: boolean | null
          max_score?: number
          question_id?: string
          score?: number
          selected_option_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_grader_id_fkey"
            columns: ["grader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          created_at: string | null
          id: string
          option_order: number
          option_text: string
          question_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_order: number
          option_text: string
          question_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_order?: number
          option_text?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          auto_close: boolean | null
          created_at: string | null
          created_by: string
          description: string | null
          duration: number
          end_time: string | null
          id: string
          is_timed: boolean | null
          passing_marks: number
          scheduled_at: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["exam_status"]
          subject: string
          title: string
          total_marks: number
          updated_at: string | null
        }
        Insert: {
          auto_close?: boolean | null
          created_at?: string | null
          created_by: string
          description?: string | null
          duration: number
          end_time?: string | null
          id?: string
          is_timed?: boolean | null
          passing_marks?: number
          scheduled_at?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject: string
          title: string
          total_marks?: number
          updated_at?: string | null
        }
        Update: {
          auto_close?: boolean | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          duration?: number
          end_time?: string | null
          id?: string
          is_timed?: boolean | null
          passing_marks?: number
          scheduled_at?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject?: string
          title?: string
          total_marks?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: string
          correct_option_id: string | null
          created_at: string | null
          created_by: string
          id: string
          options: Json | null
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          subject: string
          updated_at: string | null
        }
        Insert: {
          correct_answer: string
          correct_option_id?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          options?: Json | null
          points?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject: string
          updated_at?: string | null
        }
        Update: {
          correct_answer?: string
          correct_option_id?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          options?: Json | null
          points?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_correct_option_id_fkey"
            columns: ["correct_option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          created_at: string | null
          exam_id: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          percentage: number
          score: number
          student_id: string
          submission_id: string
          total_marks: number
        }
        Insert: {
          created_at?: string | null
          exam_id: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          percentage: number
          score?: number
          student_id: string
          submission_id: string
          total_marks: number
        }
        Update: {
          created_at?: string | null
          exam_id?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          percentage?: number
          score?: number
          student_id?: string
          submission_id?: string
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          answers: Json
          exam_id: string
          id: string
          student_id: string
          submitted_at: string | null
          time_taken: number | null
        }
        Insert: {
          answers: Json
          exam_id: string
          id?: string
          student_id: string
          submitted_at?: string | null
          time_taken?: number | null
        }
        Update: {
          answers?: Json
          exam_id?: string
          id?: string
          student_id?: string
          submitted_at?: string | null
          time_taken?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_stats: {
        Row: {
          average_percentage: number | null
          average_score: number | null
          graded_attempts: number
          id: string
          last_attempt_at: string | null
          student_id: string
          total_attempts: number
          updated_at: string | null
        }
        Insert: {
          average_percentage?: number | null
          average_score?: number | null
          graded_attempts?: number
          id?: string
          last_attempt_at?: string | null
          student_id: string
          total_attempts?: number
          updated_at?: string | null
        }
        Update: {
          average_percentage?: number | null
          average_score?: number | null
          graded_attempts?: number
          id?: string
          last_attempt_at?: string | null
          student_id?: string
          total_attempts?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_stats_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_grade_mcq: {
        Args: { attempt_id_param: string }
        Returns: Json
      }
      delete_exam: {
        Args: { exam_id_param: string }
        Returns: Json
      }
      get_user_role: {
        Args: { user_id_param?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_roles: {
        Args: { user_id_param?: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_student: { Args: never; Returns: boolean }
      is_teacher: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
      attempt_status: "draft" | "submitted" | "in_review" | "graded" | "closed"
      exam_status: "draft" | "published" | "archived"
      question_type: "mcq" | "descriptive" | "coding"
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
      app_role: ["student", "teacher", "admin"],
      exam_status: ["draft", "published", "archived"],
      question_type: ["mcq", "descriptive", "coding"],
    },
  },
} as const
