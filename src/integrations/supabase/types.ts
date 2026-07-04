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
      clients: {
        Row: {
          address: string | null
          city: string | null
          client_type: string | null
          company_id: string
          company_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          instagram: string | null
          name: string
          notes: string | null
          state: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_type?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          client_type?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          address_number: string | null
          cnpj: string | null
          complement: string | null
          created_at: string
          default_delivery_preference: string | null
          default_receiving_mode: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_complement: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_phone: string | null
          delivery_recipient: string | null
          delivery_same_as_fiscal: boolean | null
          delivery_state: string | null
          delivery_zip: string | null
          email: string | null
          id: string
          ie: string | null
          legal_name: string | null
          name: string
          neighborhood: string | null
          owner_id: string
          phone: string | null
          preferred_pickup_point: string | null
          state_registration: string | null
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string
          default_delivery_preference?: string | null
          default_receiving_mode?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_phone?: string | null
          delivery_recipient?: string | null
          delivery_same_as_fiscal?: boolean | null
          delivery_state?: string | null
          delivery_zip?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          legal_name?: string | null
          name: string
          neighborhood?: string | null
          owner_id: string
          phone?: string | null
          preferred_pickup_point?: string | null
          state_registration?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string
          default_delivery_preference?: string | null
          default_receiving_mode?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_phone?: string | null
          delivery_recipient?: string | null
          delivery_same_as_fiscal?: boolean | null
          delivery_state?: string | null
          delivery_zip?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          legal_name?: string | null
          name?: string
          neighborhood?: string | null
          owner_id?: string
          phone?: string | null
          preferred_pickup_point?: string | null
          state_registration?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          alteration_terms: string | null
          approval_terms: string | null
          client_id: string | null
          company_id: string
          contract_number: string
          created_at: string
          delivery_date: string | null
          down_payment: number | null
          id: string
          notes: string | null
          payment_method: string | null
          production_deadline: string | null
          quote_id: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
          total_value: number
          updated_at: string
        }
        Insert: {
          alteration_terms?: string | null
          approval_terms?: string | null
          client_id?: string | null
          company_id: string
          contract_number: string
          created_at?: string
          delivery_date?: string | null
          down_payment?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          production_deadline?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          total_value: number
          updated_at?: string
        }
        Update: {
          alteration_terms?: string | null
          approval_terms?: string | null
          client_id?: string | null
          company_id?: string
          contract_number?: string
          created_at?: string
          delivery_date?: string | null
          down_payment?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          production_deadline?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          category: string | null
          company_id: string
          company_name: string
          created_at: string
          id: string
          phone: string | null
          rating: number | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          company_id: string
          company_name: string
          created_at?: string
          id?: string
          phone?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          company_id?: string
          company_name?: string
          created_at?: string
          id?: string
          phone?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_credentials: {
        Row: {
          company_id: string
          created_at: string | null
          credential_key: string
          credential_secret: string | null
          error_message: string | null
          extra_config: Json | null
          id: string
          last_verified_at: string | null
          platform: string
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          credential_key?: string
          credential_secret?: string | null
          error_message?: string | null
          extra_config?: Json | null
          id?: string
          last_verified_at?: string | null
          platform: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          credential_key?: string
          credential_secret?: string | null
          error_message?: string | null
          extra_config?: Json | null
          id?: string
          last_verified_at?: string | null
          platform?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_drafts: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          error_message: string | null
          external_id: string | null
          id: string
          keywords: Json | null
          marketplace: string
          price: number
          product_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          keywords?: Json | null
          marketplace: string
          price?: number
          product_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          keywords?: Json | null
          marketplace?: string
          price?: number
          product_id?: string | null
          status?: string
          title?: string
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
          },
        ]
      }
      orders: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          deadline: string
          id: string
          machine_section: string | null
          notes: string | null
          order_number: string
          payment_status: string | null
          priority: string | null
          product_desc: string
          production_status:
            | Database["public"]["Enums"]["production_status"]
            | null
          quote_id: string | null
          total_value: number
          updated_at: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          deadline: string
          id?: string
          machine_section?: string | null
          notes?: string | null
          order_number: string
          payment_status?: string | null
          priority?: string | null
          product_desc: string
          production_status?:
            | Database["public"]["Enums"]["production_status"]
            | null
          quote_id?: string | null
          total_value: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          deadline?: string
          id?: string
          machine_section?: string | null
          notes?: string | null
          order_number?: string
          payment_status?: string | null
          priority?: string | null
          product_desc?: string
          production_status?:
            | Database["public"]["Enums"]["production_status"]
            | null
          quote_id?: string | null
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_values: {
        Row: {
          attribute_id: string
          company_id: string
          created_at: string
          external_id: string | null
          id: string
          normalized_value: string
          value: string
          variant_id: string | null
        }
        Insert: {
          attribute_id: string
          company_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          normalized_value: string
          value: string
          variant_id?: string | null
        }
        Update: {
          attribute_id?: string
          company_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          normalized_value?: string
          value?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "product_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          normalized_name: string
          product_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          normalized_name: string
          product_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attributes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category_mappings: {
        Row: {
          category_id: string | null
          company_id: string
          confidence: number | null
          created_at: string
          id: string
          product_id: string | null
          reason: string | null
          segment_id: string | null
        }
        Insert: {
          category_id?: string | null
          company_id: string
          confidence?: number | null
          created_at?: string
          id?: string
          product_id?: string | null
          reason?: string | null
          segment_id?: string | null
        }
        Update: {
          category_id?: string | null
          company_id?: string
          confidence?: number | null
          created_at?: string
          id?: string
          product_id?: string | null
          reason?: string | null
          segment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_mappings_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "product_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extras: {
        Row: {
          company_id: string
          created_at: string
          currency: string | null
          extra_days: number | null
          id: string
          name: string
          normalized_name: string | null
          price: number | null
          product_id: string
          url: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string | null
          extra_days?: number | null
          id?: string
          name: string
          normalized_name?: string | null
          price?: number | null
          product_id: string
          url?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string | null
          extra_days?: number | null
          id?: string
          name?: string
          normalized_name?: string | null
          price?: number | null
          product_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_extras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extras_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          company_id: string
          created_at: string
          hires_url: string | null
          id: string
          is_main: boolean | null
          position: number | null
          product_id: string
          storage_path: string | null
          url: string
        }
        Insert: {
          alt?: string | null
          company_id: string
          created_at?: string
          hires_url?: string | null
          id?: string
          is_main?: boolean | null
          position?: number | null
          product_id: string
          storage_path?: string | null
          url: string
        }
        Update: {
          alt?: string | null
          company_id?: string
          created_at?: string
          hires_url?: string | null
          id?: string
          is_main?: boolean | null
          position?: number | null
          product_id?: string
          storage_path?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_items: {
        Row: {
          company_id: string
          created_at: string
          errors: Json | null
          external_id: string | null
          id: string
          import_job_id: string | null
          normalized_data: Json | null
          product_id: string | null
          raw_data: Json | null
          source_url: string
          status: string
          warnings: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          errors?: Json | null
          external_id?: string | null
          id?: string
          import_job_id?: string | null
          normalized_data?: Json | null
          product_id?: string | null
          raw_data?: Json | null
          source_url: string
          status?: string
          warnings?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          errors?: Json | null
          external_id?: string | null
          id?: string
          import_job_id?: string | null
          normalized_data?: Json | null
          product_id?: string | null
          raw_data?: Json | null
          source_url?: string
          status?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "product_import_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_items_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "product_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_jobs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          error_log: Json | null
          finished_at: string | null
          id: string
          import_mode: string
          source_url: string | null
          started_at: string | null
          status: string
          supplier_id: string | null
          total_error: number | null
          total_found: number | null
          total_processed: number | null
          total_success: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          error_log?: Json | null
          finished_at?: string | null
          id?: string
          import_mode?: string
          source_url?: string | null
          started_at?: string | null
          status?: string
          supplier_id?: string | null
          total_error?: number | null
          total_found?: number | null
          total_processed?: number | null
          total_success?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          error_log?: Json | null
          finished_at?: string | null
          id?: string
          import_mode?: string
          source_url?: string | null
          started_at?: string | null
          status?: string
          supplier_id?: string | null
          total_error?: number | null
          total_found?: number | null
          total_processed?: number | null
          total_success?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_jobs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          available: boolean | null
          collected_at: string
          company_id: string
          currency: string | null
          discount_percent: number | null
          external_id: string | null
          id: string
          old_price: number | null
          promotional_price: number | null
          quantity: number
          total_price: number
          unit: string | null
          unit_price: number | null
          variant_id: string
        }
        Insert: {
          available?: boolean | null
          collected_at?: string
          company_id: string
          currency?: string | null
          discount_percent?: number | null
          external_id?: string | null
          id?: string
          old_price?: number | null
          promotional_price?: number | null
          quantity: number
          total_price: number
          unit?: string | null
          unit_price?: number | null
          variant_id: string
        }
        Update: {
          available?: boolean | null
          collected_at?: string
          company_id?: string
          currency?: string | null
          discount_percent?: number | null
          external_id?: string | null
          id?: string
          old_price?: number | null
          promotional_price?: number | null
          quantity?: number
          total_price?: number
          unit?: string | null
          unit_price?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tiers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_segments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_templates: {
        Row: {
          collected_at: string
          company_id: string
          format: string | null
          id: string
          name: string | null
          product_id: string
          type: string | null
          url: string
          variant_id: string | null
        }
        Insert: {
          collected_at?: string
          company_id: string
          format?: string | null
          id?: string
          name?: string | null
          product_id: string
          type?: string | null
          url: string
          variant_id?: string | null
        }
        Update: {
          collected_at?: string
          company_id?: string
          format?: string | null
          id?: string
          name?: string | null
          product_id?: string
          type?: string | null
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_templates_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          available: boolean | null
          company_id: string
          created_at: string
          depth_mm: number | null
          enoblement: string | null
          external_id: string | null
          finishing: string | null
          format_original: string | null
          height_mm: number | null
          id: string
          material: string | null
          model: string | null
          print_color: string | null
          product_id: string
          production_days: number | null
          raw_attributes: Json | null
          size: string | null
          sku: string | null
          title: string | null
          width_mm: number | null
        }
        Insert: {
          available?: boolean | null
          company_id: string
          created_at?: string
          depth_mm?: number | null
          enoblement?: string | null
          external_id?: string | null
          finishing?: string | null
          format_original?: string | null
          height_mm?: number | null
          id?: string
          material?: string | null
          model?: string | null
          print_color?: string | null
          product_id: string
          production_days?: number | null
          raw_attributes?: Json | null
          size?: string | null
          sku?: string | null
          title?: string | null
          width_mm?: number | null
        }
        Update: {
          available?: boolean | null
          company_id?: string
          created_at?: string
          depth_mm?: number | null
          enoblement?: string | null
          external_id?: string | null
          finishing?: string | null
          format_original?: string | null
          height_mm?: number | null
          id?: string
          material?: string | null
          model?: string | null
          print_color?: string | null
          product_id?: string
          production_days?: number | null
          raw_attributes?: Json | null
          size?: string | null
          sku?: string | null
          title?: string | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_production_time: string | null
          base_cost: number | null
          category: string | null
          classification_confidence: number | null
          commercial_name: string | null
          company_id: string
          cost_price: number | null
          created_at: string
          description: string | null
          editor_meta: Json | null
          extra_services: Json | null
          gallery_images: Json | null
          id: string
          image_url: string | null
          import_status: string | null
          imported_from_supplier: boolean | null
          internal_sku: string | null
          main_image_url: string | null
          margin_percent: number | null
          marketplace_description: string | null
          marketplace_keywords: Json | null
          marketplace_title: string | null
          min_price: number | null
          minimum_quantity: number | null
          name: string
          notes: string | null
          origin: string | null
          production_deadline: string | null
          quantity_price_table: Json | null
          quantity_prices: Json | null
          review_required: boolean | null
          sale_price: number | null
          source_url: string | null
          specifications: Json | null
          status: string | null
          subcategory: string | null
          suggested_price: number | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_sku: string | null
          target_margin: number | null
          technical_description: string | null
          template_links: Json | null
          type: string | null
          unit_measure: string | null
          updated_at: string
          variations: Json | null
        }
        Insert: {
          avg_production_time?: string | null
          base_cost?: number | null
          category?: string | null
          classification_confidence?: number | null
          commercial_name?: string | null
          company_id: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          editor_meta?: Json | null
          extra_services?: Json | null
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          import_status?: string | null
          imported_from_supplier?: boolean | null
          internal_sku?: string | null
          main_image_url?: string | null
          margin_percent?: number | null
          marketplace_description?: string | null
          marketplace_keywords?: Json | null
          marketplace_title?: string | null
          min_price?: number | null
          minimum_quantity?: number | null
          name: string
          notes?: string | null
          origin?: string | null
          production_deadline?: string | null
          quantity_price_table?: Json | null
          quantity_prices?: Json | null
          review_required?: boolean | null
          sale_price?: number | null
          source_url?: string | null
          specifications?: Json | null
          status?: string | null
          subcategory?: string | null
          suggested_price?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_sku?: string | null
          target_margin?: number | null
          technical_description?: string | null
          template_links?: Json | null
          type?: string | null
          unit_measure?: string | null
          updated_at?: string
          variations?: Json | null
        }
        Update: {
          avg_production_time?: string | null
          base_cost?: number | null
          category?: string | null
          classification_confidence?: number | null
          commercial_name?: string | null
          company_id?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          editor_meta?: Json | null
          extra_services?: Json | null
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          import_status?: string | null
          imported_from_supplier?: boolean | null
          internal_sku?: string | null
          main_image_url?: string | null
          margin_percent?: number | null
          marketplace_description?: string | null
          marketplace_keywords?: Json | null
          marketplace_title?: string | null
          min_price?: number | null
          minimum_quantity?: number | null
          name?: string
          notes?: string | null
          origin?: string | null
          production_deadline?: string | null
          quantity_price_table?: Json | null
          quantity_prices?: Json | null
          review_required?: boolean | null
          sale_price?: number | null
          source_url?: string | null
          specifications?: Json | null
          status?: string | null
          subcategory?: string | null
          suggested_price?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_sku?: string | null
          target_margin?: number | null
          technical_description?: string | null
          template_links?: Json | null
          type?: string | null
          unit_measure?: string | null
          updated_at?: string
          variations?: Json | null
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
          },
        ]
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
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          purchase_order_id: string
          quantity: number
          quote_item_id: string | null
          source_url: string | null
          supplier_sku: string | null
          total_cost: number
          unit_cost: number
          variant_selection: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          purchase_order_id: string
          quantity?: number
          quote_item_id?: string | null
          source_url?: string | null
          supplier_sku?: string | null
          total_cost?: number
          unit_cost?: number
          variant_selection?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          purchase_order_id?: string
          quantity?: number
          quote_item_id?: string | null
          source_url?: string | null
          supplier_sku?: string | null
          total_cost?: number
          unit_cost?: number
          variant_selection?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          delivery_snapshot: Json | null
          id: string
          notes: string | null
          order_id: string | null
          po_number: string
          quote_id: string | null
          receiving_mode: string | null
          status: string
          supplier_account_id: string | null
          supplier_id: string | null
          total_cost: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delivery_snapshot?: Json | null
          id?: string
          notes?: string | null
          order_id?: string | null
          po_number: string
          quote_id?: string | null
          receiving_mode?: string | null
          status?: string
          supplier_account_id?: string | null
          supplier_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_snapshot?: Json | null
          id?: string
          notes?: string | null
          order_id?: string | null
          po_number?: string
          quote_id?: string | null
          receiving_mode?: string | null
          status?: string
          supplier_account_id?: string | null
          supplier_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          cost_price: number
          created_at: string
          description: string | null
          id: string
          item_name: string
          margin_percent: number
          notes: string | null
          product_service_id: string | null
          quantity: number
          quote_id: string
          source_origin: string
          supplier_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          item_name: string
          margin_percent?: number
          notes?: string | null
          product_service_id?: string | null
          quantity?: number
          quote_id: string
          source_origin?: string
          supplier_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          item_name?: string
          margin_percent?: number
          notes?: string | null
          product_service_id?: string | null
          quantity?: number
          quote_id?: string
          source_origin?: string
          supplier_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string | null
          company_id: string
          cost_value: number | null
          created_at: string
          deadline: string | null
          discount: number | null
          final_value: number
          finishing: string | null
          id: string
          margin_percentage: number | null
          material: string | null
          measures: string | null
          notes: string | null
          quantity: number
          quote_number: string
          sale_price: number | null
          service_desc: string
          status: Database["public"]["Enums"]["quote_status"] | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          cost_value?: number | null
          created_at?: string
          deadline?: string | null
          discount?: number | null
          final_value: number
          finishing?: string | null
          id?: string
          margin_percentage?: number | null
          material?: string | null
          measures?: string | null
          notes?: string | null
          quantity: number
          quote_number: string
          sale_price?: number | null
          service_desc: string
          status?: Database["public"]["Enums"]["quote_status"] | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          cost_value?: number | null
          created_at?: string
          deadline?: string | null
          discount?: number | null
          final_value?: number
          finishing?: string | null
          id?: string
          margin_percentage?: number | null
          material?: string | null
          measures?: string | null
          notes?: string | null
          quantity?: number
          quote_number?: string
          sale_price?: number | null
          service_desc?: string
          status?: Database["public"]["Enums"]["quote_status"] | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_accounts: {
        Row: {
          company_id: string
          created_at: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_complement: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_override: boolean | null
          delivery_phone: string | null
          delivery_recipient: string | null
          delivery_state: string | null
          delivery_zip: string | null
          id: string
          login_password_enc: string | null
          login_username: string | null
          notes: string | null
          preferred_pickup_point: string | null
          receiving_mode: string | null
          registration_cnpj: string | null
          registration_email: string | null
          registration_name: string | null
          registration_phone: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_override?: boolean | null
          delivery_phone?: string | null
          delivery_recipient?: string | null
          delivery_state?: string | null
          delivery_zip?: string | null
          id?: string
          login_password_enc?: string | null
          login_username?: string | null
          notes?: string | null
          preferred_pickup_point?: string | null
          receiving_mode?: string | null
          registration_cnpj?: string | null
          registration_email?: string | null
          registration_name?: string | null
          registration_phone?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_override?: boolean | null
          delivery_phone?: string | null
          delivery_recipient?: string | null
          delivery_state?: string | null
          delivery_zip?: string | null
          id?: string
          login_password_enc?: string | null
          login_username?: string | null
          notes?: string | null
          preferred_pickup_point?: string | null
          receiving_mode?: string | null
          registration_cnpj?: string | null
          registration_email?: string | null
          registration_name?: string | null
          registration_phone?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_accounts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_catalog_items: {
        Row: {
          active: boolean
          category: string | null
          company_id: string
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          name: string
          quantity_prices: Json | null
          sku: string
          specifications: Json | null
          supplier_id: string
          template_links: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          quantity_prices?: Json | null
          sku: string
          specifications?: Json | null
          supplier_id: string
          template_links?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          quantity_prices?: Json | null
          sku?: string
          specifications?: Json | null
          supplier_id?: string
          template_links?: Json | null
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
          },
        ]
      }
      supplier_imports: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          current_price: number | null
          discount_percent: number | null
          error_message: string | null
          extra_services: Json | null
          extraction_status: string
          gallery_images: Json | null
          id: string
          main_image_url: string | null
          original_price: number | null
          product_name: string | null
          production_deadline: string | null
          quantity_prices: Json | null
          raw_text_sample: string | null
          source_url: string
          specifications: Json | null
          subcategory: string | null
          supplier_domain: string
          supplier_id: string | null
          supplier_sku: string | null
          template_links: Json | null
          updated_at: string
          variations: Json | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          current_price?: number | null
          discount_percent?: number | null
          error_message?: string | null
          extra_services?: Json | null
          extraction_status?: string
          gallery_images?: Json | null
          id?: string
          main_image_url?: string | null
          original_price?: number | null
          product_name?: string | null
          production_deadline?: string | null
          quantity_prices?: Json | null
          raw_text_sample?: string | null
          source_url: string
          specifications?: Json | null
          subcategory?: string | null
          supplier_domain: string
          supplier_id?: string | null
          supplier_sku?: string | null
          template_links?: Json | null
          updated_at?: string
          variations?: Json | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          current_price?: number | null
          discount_percent?: number | null
          error_message?: string | null
          extra_services?: Json | null
          extraction_status?: string
          gallery_images?: Json | null
          id?: string
          main_image_url?: string | null
          original_price?: number | null
          product_name?: string | null
          production_deadline?: string | null
          quantity_prices?: Json | null
          raw_text_sample?: string | null
          source_url?: string
          specifications?: Json | null
          subcategory?: string | null
          supplier_domain?: string
          supplier_id?: string | null
          supplier_sku?: string | null
          template_links?: Json | null
          updated_at?: string
          variations?: Json | null
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
          },
        ]
      }
      supplier_mapping_rules: {
        Row: {
          active: boolean
          attribute_name: string | null
          company_id: string
          created_at: string
          extraction_method: string
          field_key: string
          id: string
          label_anchor: string | null
          regex_pattern: string | null
          sample_value: string | null
          selector: string | null
          supplier_domain: string
          transform_rule: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          attribute_name?: string | null
          company_id: string
          created_at?: string
          extraction_method: string
          field_key: string
          id?: string
          label_anchor?: string | null
          regex_pattern?: string | null
          sample_value?: string | null
          selector?: string | null
          supplier_domain: string
          transform_rule?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          attribute_name?: string | null
          company_id?: string
          created_at?: string
          extraction_method?: string
          field_key?: string
          id?: string
          label_anchor?: string | null
          regex_pattern?: string | null
          sample_value?: string | null
          selector?: string | null
          supplier_domain?: string
          transform_rule?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_mapping_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_page_snapshots: {
        Row: {
          company_id: string
          created_at: string
          html_content: string
          id: string
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string
          html_content: string
          id?: string
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string
          html_content?: string
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_page_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_margin: number | null
          domain: string | null
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_margin?: number | null
          domain?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_margin?: number | null
          domain?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      supplier_accounts_safe: {
        Row: {
          company_id: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_complement: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_override: boolean | null
          delivery_phone: string | null
          delivery_recipient: string | null
          delivery_state: string | null
          delivery_zip: string | null
          has_password: boolean | null
          id: string | null
          login_username: string | null
          notes: string | null
          preferred_pickup_point: string | null
          receiving_mode: string | null
          registration_cnpj: string | null
          registration_email: string | null
          registration_name: string | null
          registration_phone: string | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_override?: boolean | null
          delivery_phone?: string | null
          delivery_recipient?: string | null
          delivery_state?: string | null
          delivery_zip?: string | null
          has_password?: never
          id?: string | null
          login_username?: string | null
          notes?: string | null
          preferred_pickup_point?: string | null
          receiving_mode?: string | null
          registration_cnpj?: string | null
          registration_email?: string | null
          registration_name?: string | null
          registration_phone?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_override?: boolean | null
          delivery_phone?: string | null
          delivery_recipient?: string | null
          delivery_state?: string | null
          delivery_zip?: string | null
          has_password?: never
          id?: string | null
          login_username?: string | null
          notes?: string | null
          preferred_pickup_point?: string | null
          receiving_mode?: string | null
          registration_cnpj?: string | null
          registration_email?: string | null
          registration_name?: string | null
          registration_phone?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_accounts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      upsert_supplier_account: {
        Args: {
          p_company_id: string
          p_delivery_address?: string
          p_delivery_city?: string
          p_delivery_complement?: string
          p_delivery_neighborhood?: string
          p_delivery_number?: string
          p_delivery_override?: boolean
          p_delivery_phone?: string
          p_delivery_recipient?: string
          p_delivery_state?: string
          p_delivery_zip?: string
          p_login_password?: string
          p_login_username?: string
          p_notes?: string
          p_preferred_pickup_point?: string
          p_receiving_mode?: string
          p_registration_cnpj?: string
          p_registration_email?: string
          p_registration_name?: string
          p_registration_phone?: string
          p_supplier_id: string
        }
        Returns: {
          company_id: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_complement: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_override: boolean | null
          delivery_phone: string | null
          delivery_recipient: string | null
          delivery_state: string | null
          delivery_zip: string | null
          has_password: boolean | null
          id: string | null
          login_username: string | null
          notes: string | null
          preferred_pickup_point: string | null
          receiving_mode: string | null
          registration_cnpj: string | null
          registration_email: string | null
          registration_name: string | null
          registration_phone: string | null
          supplier_id: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "supplier_accounts_safe"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      user_owns_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      // Afrouxados para `string`: a aplicação grava status em minúsculas
      // (ex.: "pedido_criado", "aprovado", "fechado"), divergente dos rótulos
      // Title Case do banco. Manter como string evita conflitos de tipo sem
      // alterar comportamento em runtime. NÃO regenerar para union de literais.
      contract_status: string
      lead_status: string
      production_status: string
      quote_status: string
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
      contract_status: [
        "Rascunho",
        "Enviado",
        "Aguardando assinatura",
        "Assinado",
        "Cancelado",
        "Finalizado",
      ],
      lead_status: [
        "Novo",
        "Contatado",
        "Interessado",
        "Orcamento enviado",
        "Fechado",
        "Perdido",
      ],
      production_status: [
        "Pedido criado",
        "Arte pendente",
        "Arte em criacao",
        "Arte enviada",
        "Arte aprovada",
        "Em producao",
        "Acabamento",
        "Pronto",
        "Entregue",
        "Cancelado",
      ],
      quote_status: [
        "Rascunho",
        "Enviado",
        "Aguardando cliente",
        "Aprovado",
        "Recusado",
        "Vencido",
        "Convertido em pedido",
      ],
    },
  },
} as const
