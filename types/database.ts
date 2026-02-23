export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      org_users: {
        Row: {
          org_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["org_role"];
          created_at: string;
        };
        Insert: {
          org_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          created_at?: string;
        };
        Update: {
          org_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          created_at?: string;
        };
      };
      teams: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_members: {
        Row: {
          team_id: string;
          user_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          team_id: string;
          user_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          team_id?: string;
          user_id?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      locations: {
        Row: {
          id: string;
          org_id: string;
          code: string | null;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          code?: string | null;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          code?: string | null;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      materials: {
        Row: {
          id: string;
          org_id: string;
          sku: string;
          name: string;
          description: string | null;
          uom: string;
          min_stock: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          sku: string;
          name: string;
          description?: string | null;
          uom?: string;
          min_stock?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          sku?: string;
          name?: string;
          description?: string | null;
          uom?: string;
          min_stock?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          lead_time_days: number;
          payment_terms: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          lead_time_days?: number;
          payment_terms?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          lead_time_days?: number;
          payment_terms?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      supplier_materials: {
        Row: {
          id: string;
          org_id: string;
          supplier_id: string;
          material_id: string;
          supplier_sku: string | null;
          last_price: number | null;
          currency: string;
          preferred: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          supplier_id: string;
          material_id: string;
          supplier_sku?: string | null;
          last_price?: number | null;
          currency?: string;
          preferred?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          supplier_id?: string;
          material_id?: string;
          supplier_sku?: string | null;
          last_price?: number | null;
          currency?: string;
          preferred?: boolean;
          created_at?: string;
        };
      };
      inventory_balances: {
        Row: {
          id: string;
          org_id: string;
          material_id: string;
          location_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          material_id: string;
          location_id: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          material_id?: string;
          location_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          org_id: string;
          material_id: string;
          location_id: string;
          quantity_delta: number;
          reason: Database["public"]["Enums"]["movement_reason"];
          note: string | null;
          reference_type: string | null;
          reference_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          material_id: string;
          location_id: string;
          quantity_delta: number;
          reason: Database["public"]["Enums"]["movement_reason"];
          note?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          material_id?: string;
          location_id?: string;
          quantity_delta?: number;
          reason?: Database["public"]["Enums"]["movement_reason"];
          note?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      purchase_orders: {
        Row: {
          id: string;
          org_id: string;
          supplier_id: string;
          po_number: string;
          status: Database["public"]["Enums"]["po_status"];
          expected_at: string | null;
          notes: string | null;
          sent_at: string | null;
          received_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          supplier_id: string;
          po_number: string;
          status?: Database["public"]["Enums"]["po_status"];
          expected_at?: string | null;
          notes?: string | null;
          sent_at?: string | null;
          received_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          supplier_id?: string;
          po_number?: string;
          status?: Database["public"]["Enums"]["po_status"];
          expected_at?: string | null;
          notes?: string | null;
          sent_at?: string | null;
          received_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      po_lines: {
        Row: {
          id: string;
          org_id: string;
          purchase_order_id: string;
          material_id: string;
          quantity_ordered: number;
          quantity_received: number;
          unit_price: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          purchase_order_id: string;
          material_id: string;
          quantity_ordered: number;
          quantity_received?: number;
          unit_price?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          purchase_order_id?: string;
          material_id?: string;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_price?: number | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_stock_movement: {
        Args: {
          p_org_id: string;
          p_material_id: string;
          p_location_id: string;
          p_quantity_delta: number;
          p_reason: Database["public"]["Enums"]["movement_reason"];
          p_note?: string | null;
          p_reference_type?: string | null;
          p_reference_id?: string | null;
          p_created_by?: string | null;
        };
        Returns: string;
      };
      receive_purchase_order: {
        Args: {
          p_org_id: string;
          p_po_id: string;
          p_received_by: string;
          p_receipts: Json;
        };
        Returns: {
          po_status: Database["public"]["Enums"]["po_status"];
          total_lines: number;
          fully_received_lines: number;
        }[];
      };
    };
    Enums: {
      org_role: "owner" | "manager" | "member" | "viewer";
      po_status: "draft" | "sent" | "partial" | "received" | "cancelled";
      movement_reason: "adjustment" | "transfer_in" | "transfer_out" | "purchase_receive" | "correction";
    };
    CompositeTypes: Record<string, never>;
  };
};
