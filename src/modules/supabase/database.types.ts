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
          public_code: string | null;
          public_request_id: string | null;
          service_id: string;
          source: string;
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
          public_code?: string | null;
          public_request_id?: string | null;
          service_id: string;
          source?: string;
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
          public_code?: string | null;
          public_request_id?: string | null;
          service_id?: string;
          source?: string;
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
          appointment_count: number;
          birth_date: string | null;
          contact_allowed: boolean;
          contact_preference: string;
          created_at: string;
          email: string | null;
          id: string;
          last_appointment_at: string | null;
          last_professional_id: string | null;
          name: string;
          notes: string | null;
          phone: string | null;
          phone_normalized: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          appointment_count?: number;
          birth_date?: string | null;
          contact_allowed?: boolean;
          contact_preference?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          last_appointment_at?: string | null;
          last_professional_id?: string | null;
          name: string;
          notes?: string | null;
          phone?: string | null;
          phone_normalized?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          appointment_count?: number;
          birth_date?: string | null;
          contact_allowed?: boolean;
          contact_preference?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          last_appointment_at?: string | null;
          last_professional_id?: string | null;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          phone_normalized?: string | null;
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
      marketing_templates: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          campaign_type: string;
          body: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          name: string;
          campaign_type: string;
          body: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          campaign_type?: string;
          body?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_templates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_provider_connections: {
        Row: {
          id: string;
          tenant_id: string;
          provider: string;
          status: string;
          provider_user_id: string | null;
          account_email: string | null;
          access_token_ciphertext: string | null;
          refresh_token_ciphertext: string | null;
          token_expires_at: string | null;
          scopes: string | null;
          last_error: string | null;
          connected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider: string;
          status?: string;
          provider_user_id?: string | null;
          account_email?: string | null;
          access_token_ciphertext?: string | null;
          refresh_token_ciphertext?: string | null;
          token_expires_at?: string | null;
          scopes?: string | null;
          last_error?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_provider_connections"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payment_provider_connections_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_provider_oauth_states: {
        Row: {
          id: string;
          tenant_id: string;
          provider: string;
          state_hash: string;
          code_verifier_ciphertext: string;
          redirect_uri: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider: string;
          state_hash: string;
          code_verifier_ciphertext: string;
          redirect_uri: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_provider_oauth_states"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payment_provider_oauth_states_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_provider_transactions: {
        Row: {
          id: string;
          tenant_id: string;
          provider: string;
          entity_type: string;
          entity_id: string;
          external_reference: string;
          preference_id: string | null;
          provider_payment_id: string | null;
          amount_cents: number;
          status: string;
          status_detail: string | null;
          checkout_url: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider: string;
          entity_type: string;
          entity_id: string;
          external_reference: string;
          preference_id?: string | null;
          provider_payment_id?: string | null;
          amount_cents: number;
          status?: string;
          status_detail?: string | null;
          checkout_url?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_provider_transactions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payment_provider_transactions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_campaigns: {
        Row: {
          id: string;
          tenant_id: string;
          template_id: string | null;
          name: string;
          campaign_type: string;
          message: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          template_id?: string | null;
          name: string;
          campaign_type: string;
          message: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          template_id?: string | null;
          name?: string;
          campaign_type?: string;
          message?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_template_fk";
            columns: ["template_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "marketing_templates";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "marketing_campaigns_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_actions: {
        Row: {
          id: string;
          tenant_id: string;
          campaign_id: string | null;
          client_id: string;
          message_snapshot: string;
          status: string;
          initiated_at: string | null;
          sent_at: string | null;
          responded_at: string | null;
          converted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          campaign_id?: string | null;
          client_id: string;
          message_snapshot: string;
          status?: string;
          initiated_at?: string | null;
          sent_at?: string | null;
          responded_at?: string | null;
          converted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          campaign_id?: string | null;
          client_id?: string;
          message_snapshot?: string;
          status?: string;
          initiated_at?: string | null;
          sent_at?: string | null;
          responded_at?: string | null;
          converted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_actions_campaign_fk";
            columns: ["campaign_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "marketing_campaigns";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "marketing_actions_client_fk";
            columns: ["client_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "marketing_actions_tenant_id_fkey";
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
          image_url: string | null;
          minimum_stock: number;
          name: string;
          public_visible: boolean;
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
          image_url?: string | null;
          minimum_stock?: number;
          name: string;
          public_visible?: boolean;
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
          image_url?: string | null;
          minimum_stock?: number;
          name?: string;
          public_visible?: boolean;
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
      professional_unavailability: {
        Row: {
          created_at: string;
          created_by: string;
          ends_at: string;
          id: string;
          professional_id: string;
          reason: string | null;
          starts_at: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          ends_at: string;
          id?: string;
          professional_id: string;
          reason?: string | null;
          starts_at: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          ends_at?: string;
          id?: string;
          professional_id?: string;
          reason?: string | null;
          starts_at?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_unavailability_professional_id_tenant_id_fkey";
            columns: ["professional_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "professional_unavailability_tenant_id_fkey";
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
          bio: string | null;
          notes: string | null;
          phone: string | null;
          photo_url: string | null;
          specialty: string | null;
          tenant_id: string;
          updated_at: string;
          user_id: string | null;
          working_hours: Json;
        };
        Insert: {
          active?: boolean;
          color?: string;
          commission_percent?: number;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          bio?: string | null;
          notes?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          specialty?: string | null;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string | null;
          working_hours?: Json;
        };
        Update: {
          active?: boolean;
          color?: string;
          commission_percent?: number;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          bio?: string | null;
          notes?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          specialty?: string | null;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string | null;
          working_hours?: Json;
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
      specialty_catalog: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          product_type: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id: string;
          name: string;
          product_type: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          product_type?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      specialty_service_suggestions: {
        Row: {
          active: boolean;
          category: string | null;
          duration_minutes: number;
          id: string;
          name: string;
          price_cents: number;
          service_key: string;
          sort_order: number;
          specialty_id: string;
        };
        Insert: {
          active?: boolean;
          category?: string | null;
          duration_minutes: number;
          id?: string;
          name: string;
          price_cents?: number;
          service_key: string;
          sort_order?: number;
          specialty_id: string;
        };
        Update: {
          active?: boolean;
          category?: string | null;
          duration_minutes?: number;
          id?: string;
          name?: string;
          price_cents?: number;
          service_key?: string;
          sort_order?: number;
          specialty_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "specialty_service_suggestions_specialty_id_fkey";
            columns: ["specialty_id"];
            isOneToOne: false;
            referencedRelation: "specialty_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_licenses: {
        Row: {
          created_at: string;
          current_period_ends_at: string | null;
          external_reference: string | null;
          id: string;
          product_type: string;
          starts_at: string;
          status: string;
          suspended_at: string | null;
          tenant_id: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_period_ends_at?: string | null;
          external_reference?: string | null;
          id?: string;
          product_type: string;
          starts_at?: string;
          status?: string;
          suspended_at?: string | null;
          tenant_id: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_period_ends_at?: string | null;
          external_reference?: string | null;
          id?: string;
          product_type?: string;
          starts_at?: string;
          status?: string;
          suspended_at?: string | null;
          tenant_id?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_outbox: {
        Row: {
          appointment_id: string | null;
          attempt_count: number;
          available_at: string;
          channel: string;
          created_at: string;
          event_type: string;
          id: string;
          last_error: string | null;
          payload: Json;
          provider: string;
          recipient: string | null;
          sent_at: string | null;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          appointment_id?: string | null;
          attempt_count?: number;
          available_at?: string;
          channel: string;
          created_at?: string;
          event_type: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          provider?: string;
          recipient?: string | null;
          sent_at?: string | null;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string | null;
          attempt_count?: number;
          available_at?: string;
          channel?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          provider?: string;
          recipient?: string | null;
          sent_at?: string | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_gallery: {
        Row: {
          active: boolean;
          alt_text: string | null;
          created_at: string;
          id: string;
          image_url: string;
          sort_order: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          image_url: string;
          sort_order?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string;
          sort_order?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_reviews: {
        Row: {
          active: boolean;
          client_name: string;
          comment: string;
          created_at: string;
          id: string;
          rating: number;
          sort_order: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          client_name: string;
          comment: string;
          created_at?: string;
          id?: string;
          rating: number;
          sort_order?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          client_name?: string;
          comment?: string;
          created_at?: string;
          id?: string;
          rating?: number;
          sort_order?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      professional_services: {
        Row: { created_at: string; professional_id: string; service_id: string; tenant_id: string };
        Insert: {
          created_at?: string;
          professional_id: string;
          service_id: string;
          tenant_id?: string;
        };
        Update: {
          created_at?: string;
          professional_id?: string;
          service_id?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      appointment_services: {
        Row: {
          appointment_id: string;
          created_at: string;
          duration_minutes: number;
          position: number;
          price_cents: number;
          service_id: string;
          tenant_id: string;
        };
        Insert: {
          appointment_id: string;
          created_at?: string;
          duration_minutes: number;
          position?: number;
          price_cents: number;
          service_id: string;
          tenant_id: string;
        };
        Update: {
          appointment_id?: string;
          created_at?: string;
          duration_minutes?: number;
          position?: number;
          price_cents?: number;
          service_id?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      marketing_automation_rules: {
        Row: {
          active: boolean;
          campaign_type: string;
          created_at: string;
          delay_days: number;
          id: string;
          inactive_days: number | null;
          name: string;
          template_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          campaign_type: string;
          created_at?: string;
          delay_days?: number;
          id?: string;
          inactive_days?: number | null;
          name: string;
          template_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          campaign_type?: string;
          created_at?: string;
          delay_days?: number;
          id?: string;
          inactive_days?: number | null;
          name?: string;
          template_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenant_memberships: {
        Row: {
          created_at: string;
          role: string;
          tenant_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: string;
          tenant_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_specialties: {
        Row: {
          created_at: string;
          is_primary: boolean;
          specialty_id: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          is_primary?: boolean;
          specialty_id: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          is_primary?: boolean;
          specialty_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_specialties_specialty_id_fkey";
            columns: ["specialty_id"];
            isOneToOne: false;
            referencedRelation: "specialty_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_specialties_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          accent_color: string;
          address_line: string | null;
          background_color: string;
          banner_url: string | null;
          booking_interval_minutes: number;
          business_hours: Json;
          button_color: string;
          cancellation_policy: string | null;
          cancellation_policy_enabled: boolean;
          card_color: string;
          city: string | null;
          created_at: string;
          description: string | null;
          document: string | null;
          deposit_enabled: boolean;
          deposit_type: string;
          deposit_value_cents: number;
          email: string | null;
          facebook: string | null;
          id: string;
          instagram: string | null;
          latitude: number | null;
          logo_url: string | null;
          longitude: number | null;
          map_url: string | null;
          menu_color: string;
          meta_access_token_secret_name: string;
          meta_phone_number_id: string | null;
          meta_waba_id: string | null;
          meta_webhook_verify_secret_name: string;
          name: string;
          onboarding_completed_at: string | null;
          owner_id: string;
          phone: string | null;
          payment_methods: Json;
          photo_url: string | null;
          postal_code: string | null;
          primary_color: string;
          product_type: string;
          public_information: string | null;
          public_store_enabled: boolean;
          show_public_location: boolean;
          public_name: string | null;
          public_page_status: string;
          secondary_color: string;
          slug: string;
          state: string | null;
          status: string;
          text_color: string;
          timezone: string;
          title_color: string;
          updated_at: string;
          welcome_message: string | null;
          whatsapp: string | null;
          whatsapp_integration_mode: string;
          whatsapp_initial_message: string | null;
          whatsapp_notification_phone: string | null;
        };
        Insert: {
          accent_color?: string;
          address_line?: string | null;
          background_color?: string;
          banner_url?: string | null;
          booking_interval_minutes?: number;
          business_hours?: Json;
          button_color?: string;
          cancellation_policy?: string | null;
          cancellation_policy_enabled?: boolean;
          card_color?: string;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          document?: string | null;
          deposit_enabled?: boolean;
          deposit_type?: string;
          deposit_value_cents?: number;
          email?: string | null;
          facebook?: string | null;
          id?: string;
          instagram?: string | null;
          latitude?: number | null;
          logo_url?: string | null;
          longitude?: number | null;
          map_url?: string | null;
          menu_color?: string;
          meta_access_token_secret_name?: string;
          meta_phone_number_id?: string | null;
          meta_waba_id?: string | null;
          meta_webhook_verify_secret_name?: string;
          name: string;
          onboarding_completed_at?: string | null;
          owner_id: string;
          phone?: string | null;
          payment_methods?: Json;
          photo_url?: string | null;
          postal_code?: string | null;
          primary_color?: string;
          product_type?: string;
          public_information?: string | null;
          public_store_enabled?: boolean;
          show_public_location?: boolean;
          public_name?: string | null;
          public_page_status?: string;
          secondary_color?: string;
          slug: string;
          state?: string | null;
          status?: string;
          text_color?: string;
          timezone?: string;
          title_color?: string;
          updated_at?: string;
          welcome_message?: string | null;
          whatsapp?: string | null;
          whatsapp_integration_mode?: string;
          whatsapp_initial_message?: string | null;
          whatsapp_notification_phone?: string | null;
        };
        Update: {
          accent_color?: string;
          address_line?: string | null;
          background_color?: string;
          banner_url?: string | null;
          booking_interval_minutes?: number;
          business_hours?: Json;
          button_color?: string;
          cancellation_policy?: string | null;
          cancellation_policy_enabled?: boolean;
          card_color?: string;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          document?: string | null;
          deposit_enabled?: boolean;
          deposit_type?: string;
          deposit_value_cents?: number;
          email?: string | null;
          facebook?: string | null;
          id?: string;
          instagram?: string | null;
          latitude?: number | null;
          logo_url?: string | null;
          longitude?: number | null;
          map_url?: string | null;
          menu_color?: string;
          meta_access_token_secret_name?: string;
          meta_phone_number_id?: string | null;
          meta_waba_id?: string | null;
          meta_webhook_verify_secret_name?: string;
          name?: string;
          onboarding_completed_at?: string | null;
          owner_id?: string;
          phone?: string | null;
          payment_methods?: Json;
          photo_url?: string | null;
          postal_code?: string | null;
          primary_color?: string;
          product_type?: string;
          public_information?: string | null;
          public_store_enabled?: boolean;
          show_public_location?: boolean;
          public_name?: string | null;
          public_page_status?: string;
          secondary_color?: string;
          slug?: string;
          state?: string | null;
          status?: string;
          text_color?: string;
          timezone?: string;
          title_color?: string;
          updated_at?: string;
          welcome_message?: string | null;
          whatsapp?: string | null;
          whatsapp_integration_mode?: string;
          whatsapp_initial_message?: string | null;
          whatsapp_notification_phone?: string | null;
        };
        Relationships: [];
      };
      user_active_tenants: {
        Row: {
          tenant_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          tenant_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          tenant_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_active_tenants_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_active_tenants_user_id_tenant_id_fkey";
            columns: ["user_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_memberships";
            referencedColumns: ["user_id", "tenant_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_list_platform_access: {
        Args: { search_email?: string };
        Returns: {
          access_type: string;
          created_at: string;
          email: string;
          expires_at: string | null;
          id: string;
          notes: string | null;
          product_type: string;
          starts_at: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        }[];
      };
      admin_remove_platform_access: {
        Args: { target_id: string };
        Returns: undefined;
      };
      admin_upsert_platform_access: {
        Args: {
          target_access_type: string;
          target_email: string;
          target_expires_at?: string | null;
          target_notes?: string | null;
          target_product: string;
          target_status: string;
        };
        Returns: string;
      };
      check_signup_attempt_and_account: {
        Args: { request_fingerprint: string; target_email: string };
        Returns: boolean;
      };
      create_company_for_current_user: {
        Args: { company_name: string; selected_product: string };
        Returns: string;
      };
      create_public_booking: {
        Args: {
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_fingerprint: string;
          p_honeypot?: string;
          p_notes: string;
          p_professional_id: string;
          p_request_id: string;
          p_service_id: string;
          p_slug: string;
          p_starts_at: string;
        };
        Returns: Json;
      };
      create_public_booking_v2: {
        Args: {
          p_customer_birth_date: string | null;
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_fingerprint: string;
          p_honeypot?: string;
          p_notes: string;
          p_professional_id: string;
          p_request_id: string;
          p_service_ids: string[];
          p_slug: string;
          p_starts_at: string;
        };
        Returns: Json;
      };
      create_public_booking_v3: {
        Args: {
          p_customer_name: string;
          p_customer_phone: string;
          p_fingerprint: string;
          p_honeypot?: string;
          p_payment_method: string;
          p_payment_option: string;
          p_professional_id: string;
          p_request_id: string;
          p_service_ids: string[];
          p_slug: string;
          p_starts_at: string;
        };
        Returns: Json;
      };
      create_public_store_order: {
        Args: {
          p_customer_name: string;
          p_customer_phone: string;
          p_fingerprint: string;
          p_honeypot?: string;
          p_items: Json;
          p_payment_method: string;
          p_request_id: string;
          p_slug: string;
        };
        Returns: Json;
      };
      get_public_booking_availability: {
        Args: {
          p_date: string;
          p_professional_id?: string;
          p_service_id: string;
          p_slug: string;
        };
        Returns: Json;
      };
      get_public_booking_availability_v2: {
        Args: {
          p_date: string;
          p_professional_id?: string | null;
          p_service_ids: string[];
          p_slug: string;
        };
        Returns: Json;
      };
      get_public_company_page: { Args: { p_slug: string }; Returns: Json };
      get_public_company_page_v2: { Args: { p_slug: string }; Returns: Json };
      get_public_company_page_v3: { Args: { p_slug: string }; Returns: Json };
      get_my_platform_access: { Args: Record<PropertyKey, never>; Returns: Json };
      get_my_session_bootstrap: { Args: Record<PropertyKey, never>; Returns: Json };
      apply_mercado_pago_payment: {
        Args: {
          p_tenant_id: string;
          p_external_reference: string;
          p_provider_payment_id: string;
          p_status: string;
          p_status_detail: string;
          p_amount_cents: number;
          p_approved_at?: string | null;
        };
        Returns: boolean;
      };
      switch_active_tenant: {
        Args: { target_tenant_id: string };
        Returns: undefined;
      };
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
