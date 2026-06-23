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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      cart_approvals: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"]
          actor_id: string
          cart_id: string
          comments: string | null
          created_at: string
          id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action"]
          actor_id: string
          cart_id: string
          comments?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action"]
          actor_id?: string
          cart_id?: string
          comments?: string | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_approvals_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cart_number: string
          created_at: string
          created_by: string
          department_id: string
          disposal_alert_sent: boolean
          disposal_date: string | null
          id: string
          rejection_reason: string | null
          retention_days: number
          retrieval_type: Database["public"]["Enums"]["retrieval_type"] | null
          retrieved_at: string | null
          status: Database["public"]["Enums"]["cart_status"]
          storage_notified_at: string | null
          stored_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cart_number: string
          created_at?: string
          created_by: string
          department_id: string
          disposal_alert_sent?: boolean
          disposal_date?: string | null
          id?: string
          rejection_reason?: string | null
          retention_days: number
          retrieval_type?: Database["public"]["Enums"]["retrieval_type"] | null
          retrieved_at?: string | null
          status?: Database["public"]["Enums"]["cart_status"]
          storage_notified_at?: string | null
          stored_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cart_number?: string
          created_at?: string
          created_by?: string
          department_id?: string
          disposal_alert_sent?: boolean
          disposal_date?: string | null
          id?: string
          rejection_reason?: string | null
          retention_days?: number
          retrieval_type?: Database["public"]["Enums"]["retrieval_type"] | null
          retrieved_at?: string | null
          status?: Database["public"]["Enums"]["cart_status"]
          storage_notified_at?: string | null
          stored_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_allocations: {
        Row: {
          amount: number
          cart_count: number | null
          created_at: string
          department_id: string
          id: string
          notes: string | null
          purchase_order_id: string
        }
        Insert: {
          amount: number
          cart_count?: number | null
          created_at?: string
          department_id: string
          id?: string
          notes?: string | null
          purchase_order_id: string
        }
        Update: {
          amount?: number
          cart_count?: number | null
          created_at?: string
          department_id?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_allocations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          cart_id: string
          created_at: string
          created_by: string
          department_id: string
          document_name: string
          document_number: string
          file_name: string | null
          file_number: string | null
          id: string
          retention_period: number
        }
        Insert: {
          cart_id: string
          created_at?: string
          created_by: string
          department_id: string
          document_name: string
          document_number: string
          file_name?: string | null
          file_number?: string | null
          id?: string
          retention_period: number
        }
        Update: {
          cart_id?: string
          created_at?: string
          created_by?: string
          department_id?: string
          document_name?: string
          document_number?: string
          file_name?: string | null
          file_number?: string | null
          id?: string
          retention_period?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          department_id: string | null
          id: string
          payload: Json | null
          recipient: string | null
          sent_at: string
          subject: string | null
          type: string
        }
        Insert: {
          body?: string | null
          department_id?: string | null
          id?: string
          payload?: Json | null
          recipient?: string | null
          sent_at?: string
          subject?: string | null
          type: string
        }
        Update: {
          body?: string | null
          department_id?: string | null
          id?: string
          payload?: Json | null
          recipient?: string | null
          sent_at?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          id: string
          period_end: string | null
          period_start: string | null
          po_number: string
          po_type: Database["public"]["Enums"]["po_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          po_number: string
          po_type: Database["public"]["Enums"]["po_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          po_number?: string
          po_type?: Database["public"]["Enums"]["po_type"]
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      current_user_department: { Args: never; Returns: string }
      current_user_is_active: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "employee" | "dept_head" | "office_services"
      approval_action:
        | "submit"
        | "approve"
        | "reject"
        | "retrieval_request"
        | "retrieval_approved"
        | "retrieval_rejected"
        | "return_request"
        | "return_approved"
        | "return_rejected"
        | "mark_stored"
        | "mark_retrieved"
        | "dispose"
      cart_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "stored"
        | "pending_retrieval_approval"
        | "retrieved"
        | "pending_return_approval"
        | "disposed"
        | "rejected"
      po_type: "storage" | "transport" | "urgent_retrieval"
      retrieval_type: "normal" | "urgent"
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
      app_role: ["super_admin", "employee", "dept_head", "office_services"],
      approval_action: [
        "submit",
        "approve",
        "reject",
        "retrieval_request",
        "retrieval_approved",
        "retrieval_rejected",
        "return_request",
        "return_approved",
        "return_rejected",
        "mark_stored",
        "mark_retrieved",
        "dispose",
      ],
      cart_status: [
        "draft",
        "pending_approval",
        "approved",
        "stored",
        "pending_retrieval_approval",
        "retrieved",
        "pending_return_approval",
        "disposed",
        "rejected",
      ],
      po_type: ["storage", "transport", "urgent_retrieval"],
      retrieval_type: ["normal", "urgent"],
    },
  },
} as const
