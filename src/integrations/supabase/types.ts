export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          id: string
          company_id: string
          name: string
          company_name: string | null
          document: string | null
          whatsapp: string | null
          email: string | null
          address: string | null
          city: string | null
          state: string | null
          instagram: string | null
          client_type: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          company_name?: string | null
          document?: string | null
          whatsapp?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          instagram?: string | null
          client_type?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          company_name?: string | null
          document?: string | null
          whatsapp?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          instagram?: string | null
          client_type?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      leads: {
        Row: {
          id: string
          company_id: string
          company_name: string
          category: string | null
          address: string | null
          phone: string | null
          rating: number | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          company_name: string
          category?: string | null
          address?: string | null
          phone?: string | null
          rating?: number | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          company_name?: string
          category?: string | null
          address?: string | null
          phone?: string | null
          rating?: number | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          id: string
          company_id: string
          name: string
          category: string | null
          subcategory: string | null
          description: string | null
          unit_measure: string | null
          base_cost: number | null
          min_price: number | null
          suggested_price: number | null
          target_margin: number | null
          avg_production_time: string | null
          notes: string | null
          status: string | null
          created_at: string
          updated_at: string
          // Novos campos de fornecedor:
          supplier_id: string | null
          source_url: string | null
          supplier_sku: string | null
          cost_price: number | null
          sale_price: number | null
          margin_percent: number | null
          marketplace_title: string | null
          marketplace_description: string | null
          marketplace_keywords: Json
          imported_from_supplier: boolean | null
          import_status: string | null
          main_image_url: string | null
          gallery_images: Json
          specifications: Json
          variations: Json
          quantity_prices: Json
          extra_services: Json
          template_links: Json
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          category?: string | null
          subcategory?: string | null
          description?: string | null
          unit_measure?: string | null
          base_cost?: number | null
          min_price?: number | null
          suggested_price?: number | null
          target_margin?: number | null
          avg_production_time?: string | null
          notes?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
          // Novos campos de fornecedor:
          supplier_id?: string | null
          source_url?: string | null
          supplier_sku?: string | null
          cost_price?: number | null
          sale_price?: number | null
          margin_percent?: number | null
          marketplace_title?: string | null
          marketplace_description?: string | null
          marketplace_keywords?: Json
          imported_from_supplier?: boolean | null
          import_status?: string | null
          main_image_url?: string | null
          gallery_images?: Json
          specifications?: Json
          variations?: Json
          quantity_prices?: Json
          extra_services?: Json
          template_links?: Json
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          category?: string | null
          subcategory?: string | null
          description?: string | null
          unit_measure?: string | null
          base_cost?: number | null
          min_price?: number | null
          suggested_price?: number | null
          target_margin?: number | null
          avg_production_time?: string | null
          notes?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
          // Novos campos de fornecedor:
          supplier_id?: string | null
          source_url?: string | null
          supplier_sku?: string | null
          cost_price?: number | null
          sale_price?: number | null
          margin_percent?: number | null
          marketplace_title?: string | null
          marketplace_description?: string | null
          marketplace_keywords?: Json
          imported_from_supplier?: boolean | null
          import_status?: string | null
          main_image_url?: string | null
          gallery_images?: Json
          specifications?: Json
          variations?: Json
          quantity_prices?: Json
          extra_services?: Json
          template_links?: Json
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      suppliers: {
        Row: {
          id: string
          company_id: string
          name: string
          domain: string | null
          website_url: string | null
          contact_email: string | null
          contact_phone: string | null
          notes: string | null
          default_margin: number | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          domain?: string | null
          website_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          notes?: string | null
          default_margin?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          domain?: string | null
          website_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          notes?: string | null
          default_margin?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_imports: {
        Row: {
          id: string
          company_id: string
          supplier_id: string | null
          source_url: string
          supplier_domain: string
          product_name: string | null
          supplier_sku: string | null
          category: string | null
          subcategory: string | null
          main_image_url: string | null
          gallery_images: Json
          original_price: number | null
          current_price: number | null
          discount_percent: number | null
          production_deadline: string | null
          specifications: Json
          variations: Json
          quantity_prices: Json
          extra_services: Json
          template_links: Json
          raw_text_sample: string | null
          extraction_status: string
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          supplier_id?: string | null
          source_url: string
          supplier_domain: string
          product_name?: string | null
          supplier_sku?: string | null
          category?: string | null
          subcategory?: string | null
          main_image_url?: string | null
          gallery_images?: Json
          original_price?: number | null
          current_price?: number | null
          discount_percent?: number | null
          production_deadline?: string | null
          specifications?: Json
          variations?: Json
          quantity_prices?: Json
          extra_services?: Json
          template_links?: Json
          raw_text_sample?: string | null
          extraction_status?: string
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          supplier_id?: string | null
          source_url?: string
          supplier_domain?: string
          product_name?: string | null
          supplier_sku?: string | null
          category?: string | null
          subcategory?: string | null
          main_image_url?: string | null
          gallery_images?: Json
          original_price?: number | null
          current_price?: number | null
          discount_percent?: number | null
          production_deadline?: string | null
          specifications?: Json
          variations?: Json
          quantity_prices?: Json
          extra_services?: Json
          template_links?: Json
          raw_text_sample?: string | null
          extraction_status?: string
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_imports_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_mapping_rules: {
        Row: {
          id: string
          company_id: string
          supplier_domain: string
          field_key: string
          extraction_method: string
          selector: string | null
          regex_pattern: string | null
          label_anchor: string | null
          attribute_name: string | null
          transform_rule: string | null
          sample_value: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          supplier_domain: string
          field_key: string
          extraction_method: string
          selector?: string | null
          regex_pattern?: string | null
          label_anchor?: string | null
          attribute_name?: string | null
          transform_rule?: string | null
          sample_value?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          supplier_domain?: string
          field_key?: string
          extraction_method?: string
          selector?: string | null
          regex_pattern?: string | null
          label_anchor?: string | null
          attribute_name?: string | null
          transform_rule?: string | null
          sample_value?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_mapping_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_page_snapshots: {
        Row: {
          id: string
          company_id: string
          url: string
          html_content: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          url: string
          html_content: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          url?: string
          html_content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_page_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      marketplace_drafts: {
        Row: {
          id: string
          company_id: string
          product_id: string | null
          marketplace: string
          title: string
          description: string | null
          price: number
          category: string | null
          keywords: Json
          status: string
          external_id: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          product_id?: string | null
          marketplace: string
          title: string
          description?: string | null
          price?: number
          category?: string | null
          keywords?: Json
          status?: string
          external_id?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          product_id?: string | null
          marketplace?: string
          title?: string
          description?: string | null
          price?: number
          category?: string | null
          keywords?: Json
          status?: string
          external_id?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_drafts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_catalog_items: {
        Row: {
          id: string
          company_id: string
          supplier_id: string
          sku: string
          name: string
          category: string | null
          cost_price: number
          image_url: string | null
          specifications: Json
          quantity_prices: Json
          template_links: Json
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          supplier_id: string
          sku: string
          name: string
          category?: string | null
          cost_price?: number
          image_url?: string | null
          specifications?: Json
          quantity_prices?: Json
          template_links?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          supplier_id?: string
          sku?: string
          name?: string
          category?: string | null
          cost_price?: number
          image_url?: string | null
          specifications?: Json
          quantity_prices?: Json
          template_links?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      quotes: {
        Row: {
          id: string
          company_id: string
          client_id: string | null
          quote_number: string
          service_desc: string
          quantity: number
          measures: string | null
          material: string | null
          finishing: string | null
          deadline: string | null
          cost_value: number | null
          sale_price: number | null
          margin_percentage: number | null
          discount: number | null
          final_value: number
          notes: string | null
          status: string | null
          valid_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          client_id?: string | null
          quote_number: string
          service_desc: string
          quantity: number
          measures?: string | null
          material?: string | null
          finishing?: string | null
          deadline?: string | null
          cost_value?: number | null
          sale_price?: number | null
          margin_percentage?: number | null
          discount?: number | null
          final_value: number
          notes?: string | null
          status?: string | null
          valid_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          client_id?: string | null
          quote_number?: string
          service_desc?: string
          quantity?: number
          measures?: string | null
          material?: string | null
          finishing?: string | null
          deadline?: string | null
          cost_value?: number | null
          sale_price?: number | null
          margin_percentage?: number | null
          discount?: number | null
          final_value?: number
          notes?: string | null
          status?: string | null
          valid_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      orders: {
        Row: {
          id: string
          company_id: string
          client_id: string
          quote_id: string | null
          order_number: string
          product_desc: string
          total_value: number
          payment_status: string | null
          production_status: string | null
          deadline: string
          priority: string | null
          machine_section: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          client_id: string
          quote_id?: string | null
          order_number: string
          product_desc: string
          total_value: number
          payment_status?: string | null
          production_status?: string | null
          deadline: string
          priority?: string | null
          machine_section?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          client_id?: string
          quote_id?: string | null
          order_number?: string
          product_desc?: string
          total_value?: number
          payment_status?: string | null
          production_status?: string | null
          deadline?: string
          priority?: string | null
          machine_section?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          }
        ]
      }
      contracts: {
        Row: {
          id: string
          company_id: string
          client_id: string | null
          quote_id: string | null
          contract_number: string
          total_value: number
          down_payment: number | null
          payment_method: string | null
          delivery_date: string | null
          production_deadline: string | null
          alteration_terms: string | null
          approval_terms: string | null
          notes: string | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          client_id?: string | null
          quote_id?: string | null
          contract_number: string
          total_value: number
          down_payment?: number | null
          payment_method?: string | null
          delivery_date?: string | null
          production_deadline?: string | null
          alteration_terms?: string | null
          approval_terms?: string | null
          notes?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          client_id?: string | null
          quote_id?: string | null
          contract_number?: string
          total_value?: number
          down_payment?: number | null
          payment_method?: string | null
          delivery_date?: string | null
          production_deadline?: string | null
          alteration_terms?: string | null
          approval_terms?: string | null
          notes?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          }
        ]
      }
      marketplace_credentials: {
        Row: {
          id: string
          company_id: string
          platform: string
          credential_key: string
          credential_secret: string | null
          extra_config: Json
          status: string
          last_verified_at: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          platform: string
          credential_key?: string
          credential_secret?: string | null
          extra_config?: Json
          status?: string
          last_verified_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          platform?: string
          credential_key?: string
          credential_secret?: string | null
          extra_config?: Json
          status?: string
          last_verified_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
