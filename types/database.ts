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
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          message: string
          metadata: Json
          org_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          message: string
          metadata?: Json
          org_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          message?: string
          metadata?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          created_at: string
          id: string
          location_id: string
          material_id: string
          org_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          material_id: string
          org_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          material_id?: string
          org_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_balances_location_org"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "fk_inventory_balances_material_org"
            columns: ["material_id", "org_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "inventory_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          min_stock: number
          name: string
          org_id: string
          sku: string
          subcategory: string | null
          uom: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          org_id: string
          sku: string
          subcategory?: string | null
          uom?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          org_id?: string
          sku?: string
          subcategory?: string | null
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          org_name: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          org_id: string
          org_name: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          org_name?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_users: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_billing: {
        Row: {
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end: boolean
          current_period_end: string | null
          last_stripe_event_created_at: string | null
          last_stripe_event_id: string | null
          org_id: string
          past_due_since: string | null
          plan: Database["public"]["Enums"]["billing_plan"]
          scheduled_effective_at: string | null
          scheduled_interval:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          scheduled_plan: Database["public"]["Enums"]["billing_plan"] | null
          status: Database["public"]["Enums"]["billing_status"]
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_item_id: string | null
          stripe_subscription_schedule_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          org_id: string
          past_due_since?: string | null
          plan?: Database["public"]["Enums"]["billing_plan"]
          scheduled_effective_at?: string | null
          scheduled_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          scheduled_plan?: Database["public"]["Enums"]["billing_plan"] | null
          status?: Database["public"]["Enums"]["billing_status"]
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          stripe_subscription_schedule_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          org_id?: string
          past_due_since?: string | null
          plan?: Database["public"]["Enums"]["billing_plan"]
          scheduled_effective_at?: string | null
          scheduled_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          scheduled_plan?: Database["public"]["Enums"]["billing_plan"] | null
          status?: Database["public"]["Enums"]["billing_status"]
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          stripe_subscription_schedule_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_billing_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_access_log: {
        Row: {
          action: string
          actor_role: Database["public"]["Enums"]["platform_admin_role"]
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_role: Database["public"]["Enums"]["platform_admin_role"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_role?: Database["public"]["Enums"]["platform_admin_role"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          disabled_at: string | null
          role: Database["public"]["Enums"]["platform_admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          role?: Database["public"]["Enums"]["platform_admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          role?: Database["public"]["Enums"]["platform_admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      po_lines: {
        Row: {
          created_at: string
          id: string
          material_id: string
          org_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          org_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          org_id?: string
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_po_lines_material_org"
            columns: ["material_id", "org_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "fk_po_lines_purchase_order_org"
            columns: ["purchase_order_id", "org_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "po_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          expected_at: string | null
          id: string
          notes: string | null
          org_id: string
          po_number: string
          received_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_at?: string | null
          id?: string
          notes?: string | null
          org_id: string
          po_number: string
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_at?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          po_number?: string
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_orders_supplier_org"
            columns: ["supplier_id", "org_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          material_id: string
          note: string | null
          org_id: string
          quantity_delta: number
          reason: Database["public"]["Enums"]["movement_reason"]
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          material_id: string
          note?: string | null
          org_id: string
          quantity_delta: number
          reason: Database["public"]["Enums"]["movement_reason"]
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          material_id?: string
          note?: string | null
          org_id?: string
          quantity_delta?: number
          reason?: Database["public"]["Enums"]["movement_reason"]
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_movements_location_org"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "fk_stock_movements_material_org"
            columns: ["material_id", "org_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          attempt_count: number
          claimed_at: string
          event_created_at: string
          event_id: string
          event_type: string
          failed_at: string | null
          last_attempt_at: string
          last_error_code: string | null
          last_error_message: string | null
          processed_at: string
          status: string
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string
          event_created_at: string
          event_id: string
          event_type: string
          failed_at?: string | null
          last_attempt_at?: string
          last_error_code?: string | null
          last_error_message?: string | null
          processed_at?: string
          status?: string
        }
        Update: {
          attempt_count?: number
          claimed_at?: string
          event_created_at?: string
          event_id?: string
          event_type?: string
          failed_at?: string | null
          last_attempt_at?: string
          last_error_code?: string | null
          last_error_message?: string | null
          processed_at?: string
          status?: string
        }
        Relationships: []
      }
      supplier_materials: {
        Row: {
          created_at: string
          currency: string
          id: string
          last_price: number | null
          material_id: string
          org_id: string
          preferred: boolean
          supplier_id: string
          supplier_sku: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          last_price?: number | null
          material_id: string
          org_id: string
          preferred?: boolean
          supplier_id: string
          supplier_sku?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          last_price?: number | null
          material_id?: string
          org_id?: string
          preferred?: boolean
          supplier_id?: string
          supplier_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_supplier_materials_material_org"
            columns: ["material_id", "org_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "fk_supplier_materials_supplier_org"
            columns: ["supplier_id", "org_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "supplier_materials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          lead_time_days: number
          name: string
          org_id: string
          payment_terms: string | null
          phone: string | null
          updated_at: string
          vendor_number: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name: string
          org_id: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          vendor_number?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name?: string
          org_id?: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          vendor_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          created_by: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          email: string | null
          full_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_trial_redemptions: {
        Row: {
          org_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          org_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          org_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_trial_redemptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_org_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      apply_stock_movement_internal: {
        Args: {
          p_actor: string
          p_location_id: string
          p_material_id: string
          p_note: string
          p_org_id: string
          p_quantity_delta: number
          p_reason: Database["public"]["Enums"]["movement_reason"]
          p_reference_id: string
          p_reference_type: string
        }
        Returns: string
      }
      claim_stripe_webhook_event: {
        Args: {
          p_event_created_at: string
          p_event_id: string
          p_event_type: string
          p_stale_after?: string
        }
        Returns: {
          attempt_count: number
          claimed: boolean
          claimed_at: string
          event_created_at: string
          event_id: string
          event_type: string
          failed_at: string
          last_error_code: string
          last_error_message: string
          processed_at: string
          status: string
        }[]
      }
      complete_stripe_webhook_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      create_organization_with_owner: {
        Args: {
          p_name: string
          p_plan?: Database["public"]["Enums"]["billing_plan"]
          p_start_trial?: boolean
        }
        Returns: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_workspace_checkout: {
        Args: { p_org_id: string }
        Returns: { claim_token: string | null; state: string; stripe_checkout_session_id: string | null; stripe_customer_id: string | null }[]
      }
      complete_workspace_checkout_claim: {
        Args: { p_claim_token: string; p_org_id: string; p_stripe_checkout_session_id: string; p_stripe_customer_id: string | null }
        Returns: undefined
      }
      release_workspace_checkout_session: {
        Args: { p_org_id: string; p_stripe_checkout_session_id: string }
        Returns: undefined
      }
      start_workspace_trial: {
        Args: { p_org_id: string }
        Returns: {
          org_id: string
          trial_ends_at: string
        }[]
      }
      create_purchase_order_with_lines: {
        Args: {
          p_currency: string
          p_expected_at?: string
          p_lines: Json
          p_notes?: string
          p_org_id: string
          p_po_number: string
          p_supplier_id: string
        }
        Returns: Json
      }
      create_stock_movement: {
        Args: {
          p_created_by?: string
          p_location_id: string
          p_material_id: string
          p_note?: string
          p_org_id: string
          p_quantity_delta: number
          p_reason: Database["public"]["Enums"]["movement_reason"]
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: string
      }
      create_stock_transfer: {
        Args: {
          p_created_by?: string
          p_from_location_id: string
          p_material_id: string
          p_note?: string
          p_org_id: string
          p_quantity: number
          p_to_location_id: string
        }
        Returns: string[]
      }
      create_team_with_owner: {
        Args: { p_description?: string; p_name: string; p_org_id: string }
        Returns: Json
      }
      fail_stripe_webhook_event: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_event_id: string
        }
        Returns: undefined
      }
      get_low_stock_materials: {
        Args: { p_org_id: string }
        Returns: {
          deficit: number
          material_id: string
          min_stock: number
          name: string
          quantity: number
          sku: string
        }[]
      }
      get_org_member_account_profiles: {
        Args: { target_org_id: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_stock_health: {
        Args: { p_org_id: string }
        Returns: {
          low_stock: number
          out_of_stock: number
          total_materials: number
          total_quantity: number
        }[]
      }
      is_org_member: { Args: { target_org_id: string }; Returns: boolean }
      is_org_owner: { Args: { target_org_id: string }; Returns: boolean }
      is_org_role_at_least: {
        Args: {
          minimum_role: Database["public"]["Enums"]["org_role"]
          target_org_id: string
        }
        Returns: boolean
      }
      receive_purchase_order: {
        Args: {
          p_org_id: string
          p_po_id: string
          p_receipts: Json
          p_received_by: string
        }
        Returns: {
          fully_received_lines: number
          po_status: Database["public"]["Enums"]["po_status"]
          total_lines: number
        }[]
      }
      reject_org_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      remove_org_member_with_team_memberships: {
        Args: { p_org_id: string; p_target_user_id: string }
        Returns: Json
      }
      transition_purchase_order_status: {
        Args: {
          p_org_id: string
          p_po_id: string
          p_status: Database["public"]["Enums"]["po_status"]
        }
        Returns: Json
      }
      workspace_has_write_access: {
        Args: { target_org_id: string }
        Returns: boolean
      }
    }
    Enums: {
      billing_interval: "monthly" | "annual" | "custom"
      billing_plan: "starter" | "operations" | "business" | "enterprise"
      billing_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused"
      movement_reason:
        | "adjustment"
        | "transfer_in"
        | "transfer_out"
        | "purchase_receive"
        | "correction"
        | "transfer"
        | "consumption"
      org_role: "owner" | "manager" | "member" | "viewer"
      platform_admin_role: "support" | "operator" | "admin"
      po_status: "draft" | "sent" | "partial" | "received" | "cancelled"
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
      billing_interval: ["monthly", "annual", "custom"],
      billing_plan: ["starter", "operations", "business", "enterprise"],
      billing_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
      movement_reason: [
        "adjustment",
        "transfer_in",
        "transfer_out",
        "purchase_receive",
        "correction",
        "transfer",
        "consumption",
      ],
      org_role: ["owner", "manager", "member", "viewer"],
      platform_admin_role: ["support", "operator", "admin"],
      po_status: ["draft", "sent", "partial", "received", "cancelled"],
    },
  },
} as const
