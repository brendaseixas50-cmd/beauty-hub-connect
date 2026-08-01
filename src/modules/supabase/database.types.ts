export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          client_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          notes: string | null;
          price_cents: number;
          professional_id: string;
          service_id: string;
          starts_at: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          notes?: string | null;
          price_cents?: number;
          professional_id: string;
          service_id: string;
          starts_at: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          notes?: string | null;
          price_cents?: number;
          professional_id?: string;
          service_id?: string;
          starts_at?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_tenant_id_fkey";
            columns: ["client_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "appointments_professional_tenant_fk";
            columns: ["professional_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "appointments_service_id_tenant_id_fkey";
            columns: ["service_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          active: boolean;
          address: string | null;
          birth_date: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          birth_date?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          birth_date?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_entries: {
        Row: {
          amount_cents: number;
          appointment_id: string | null;
          category: string | null;
          created_at: string;
          description: string;
          due_date: string;
          entry_type: string;
          id: string;
          notes: string | null;
          paid_at: string | null;
          payment_method: string | null;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          appointment_id?: string | null;
          category?: string | null;
          created_at?: string;
          description: string;
          due_date?: string;
          entry_type: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          appointment_id?: string | null;
          category?: string | null;
          created_at?: string;
          description?: string;
          due_date?: string;
          entry_type?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_entries_appointment_id_tenant_id_fkey";
            columns: ["appointment_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "financial_entries_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          notes: string | null;
          product_id: string;
          quantity_delta: number;
          reason: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          id?: string;
          notes?: string | null;
          product_id: string;
          quantity_delta: number;
          reason: string;
          tenant_id?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          notes?: string | null;
          product_id?: string;
          quantity_delta?: number;
          reason?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_tenant_id_fkey";
            columns: ["product_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          category: string | null;
          cost_cents: number;
          created_at: string;
          description: string | null;
          id: string;
          minimum_stock: number;
          name: string;
          sale_price_cents: number;
          sku: string | null;
          stock_quantity: number;
          tenant_id: string;
          unit: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category?: string | null;
          cost_cents?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          minimum_stock?: number;
          name: string;
          sale_price_cents?: number;
          sku?: string | null;
          stock_quantity?: number;
          tenant_id?: string;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category?: string | null;
          cost_cents?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          minimum_stock?: number;
          name?: string;
          sale_price_cents?: number;
          sku?: string | null;
          stock_quantity?: number;
          tenant_id?: string;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      professionals: {
        Row: {
          active: boolean;
          color: string;
          commission_percent: number;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          specialty: string | null;
          tenant_id: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          color?: string;
          commission_percent?: number;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          specialty?: string | null;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          color?: string;
          commission_percent?: number;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          specialty?: string | null;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "professionals_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          role: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          role?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          role?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          active: boolean;
          category: string | null;
          created_at: string;
          description: string | null;
          duration_minutes: number;
          id: string;
          name: string;
          price_cents: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes: number;
          id?: string;
          name: string;
          price_cents: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          name?: string;
          price_cents?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          address_line: string | null;
          business_hours: Json;
          city: string | null;
          created_at: string;
          description: string | null;
          document: string | null;
          email: string | null;
          id: string;
          instagram: string | null;
          name: string;
          owner_id: string;
          phone: string | null;
          postal_code: string | null;
          product_type: string;
          slug: string;
          state: string | null;
          status: string;
          timezone: string;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          address_line?: string | null;
          business_hours?: Json;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          document?: string | null;
          email?: string | null;
          id?: string;
          instagram?: string | null;
          name: string;
          owner_id: string;
          phone?: string | null;
          postal_code?: string | null;
          product_type?: string;
          slug: string;
          state?: string | null;
          status?: string;
          timezone?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          address_line?: string | null;
          business_hours?: Json;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          document?: string | null;
          email?: string | null;
          id?: string;
          instagram?: string | null;
          name?: string;
          owner_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          product_type?: string;
          slug?: string;
          state?: string | null;
          status?: string;
          timezone?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
