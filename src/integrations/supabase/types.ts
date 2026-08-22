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
          status: string | null
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
          status?: string | null
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
          status?: string | null
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
          status: string | null
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
          status?: string | null
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
          status?: string | null
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
          production_status: string | null
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
          production_status?: string | null
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
          production_status?: string | null
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
      product_model_attributes: {
        Row: {
          attribute_id: string
          conditional_rules: Json | null
          id: string
          model_id: string
          order_index: number | null
        }
        Insert: {
          attribute_id: string
          conditional_rules?: Json | null
          id?: string
          model_id: string
          order_index?: number | null
        }
        Update: {
          attribute_id?: string
          conditional_rules?: Json | null
          id?: string
          model_id?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_model_attributes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "technical_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_model_attributes_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
        ]
      }
      product_models: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_models_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      product_supplier_links: {
        Row: {
          availability: string | null
          company_id: string
          cost: number | null
          created_at: string
          delay_index: number | null
          freight: number | null
          id: string
          is_preferred: boolean
          lead_time_days: number | null
          min_quantity: number | null
          problem_index: number | null
          product_id: string
          quality_rating: number | null
          source_url: string | null
          supplier_id: string
          supplier_product_id: string | null
          updated_at: string
        }
        Insert: {
          availability?: string | null
          company_id: string
          cost?: number | null
          created_at?: string
          delay_index?: number | null
          freight?: number | null
          id?: string
          is_preferred?: boolean
          lead_time_days?: number | null
          min_quantity?: number | null
          problem_index?: number | null
          product_id: string
          quality_rating?: number | null
          source_url?: string | null
          supplier_id: string
          supplier_product_id?: string | null
          updated_at?: string
        }
        Update: {
          availability?: string | null
          company_id?: string
          cost?: number | null
          created_at?: string
          delay_index?: number | null
          freight?: number | null
          id?: string
          is_preferred?: boolean
          lead_time_days?: number | null
          min_quantity?: number | null
          problem_index?: number | null
          product_id?: string
          quality_rating?: number | null
          source_url?: string | null
          supplier_id?: string
          supplier_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_supplier_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_supplier_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_supplier_links_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_supplier_links_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
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
      production_checklist_answers: {
        Row: {
          answered_at: string | null
          answered_by: string | null
          checklist_id: string
          id: string
          is_checked: boolean | null
          notes: string | null
          step_id: string
        }
        Insert: {
          answered_at?: string | null
          answered_by?: string | null
          checklist_id: string
          id?: string
          is_checked?: boolean | null
          notes?: string | null
          step_id: string
        }
        Update: {
          answered_at?: string | null
          answered_by?: string | null
          checklist_id?: string
          id?: string
          is_checked?: boolean | null
          notes?: string | null
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_checklist_answers_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_checklist_answers_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "production_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_checklist_answers_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      production_checklists: {
        Row: {
          company_id: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          model_id: string | null
          question: string
          step_name: string
        }
        Insert: {
          company_id: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          model_id?: string | null
          question: string
          step_name: string
        }
        Update: {
          company_id?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          model_id?: string | null
          question?: string
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_checklists_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
        ]
      }
      production_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
          production_order_id: string | null
          production_order_item_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          production_order_id?: string | null
          production_order_item_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          production_order_id?: string | null
          production_order_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_history_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_history_production_order_item_id_fkey"
            columns: ["production_order_item_id"]
            isOneToOne: false
            referencedRelation: "production_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      production_item_attributes: {
        Row: {
          attribute_id: string
          id: string
          production_order_item_id: string
          value: string | null
          version: number | null
        }
        Insert: {
          attribute_id: string
          id?: string
          production_order_item_id: string
          value?: string | null
          version?: number | null
        }
        Update: {
          attribute_id?: string
          id?: string
          production_order_item_id?: string
          value?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_item_attributes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "technical_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_item_attributes_production_order_item_id_fkey"
            columns: ["production_order_item_id"]
            isOneToOne: false
            referencedRelation: "production_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      production_machines: {
        Row: {
          capacity: number | null
          company_id: string
          cost_per_hour: number | null
          id: string
          is_active: boolean | null
          name: string
          type: string | null
        }
        Insert: {
          capacity?: number | null
          company_id: string
          cost_per_hour?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          type?: string | null
        }
        Update: {
          capacity?: number | null
          company_id?: string
          cost_per_hour?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_machines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_materials_consumption: {
        Row: {
          actual_qty: number | null
          created_at: string | null
          estimated_qty: number | null
          id: string
          loss_qty: number | null
          material_name: string
          recorded_by: string | null
          step_id: string
          unit_cost: number | null
        }
        Insert: {
          actual_qty?: number | null
          created_at?: string | null
          estimated_qty?: number | null
          id?: string
          loss_qty?: number | null
          material_name: string
          recorded_by?: string | null
          step_id: string
          unit_cost?: number | null
        }
        Update: {
          actual_qty?: number | null
          created_at?: string | null
          estimated_qty?: number | null
          id?: string
          loss_qty?: number | null
          material_name?: string
          recorded_by?: string | null
          step_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_materials_consumption_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_materials_consumption_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          product_model_id: string | null
          production_order_id: string
          quantity: number
          status: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_model_id?: string | null
          production_order_id: string
          quantity?: number
          status?: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_model_id?: string | null
          production_order_id?: string
          quantity?: number
          status?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_product_model_id_fkey"
            columns: ["product_model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          order_number: string
          priority: string | null
          quote_id: string | null
          status: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_number: string
          priority?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          priority?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_reworks: {
        Row: {
          created_at: string | null
          id: string
          production_order_item_id: string
          reason: string
          reported_by: string | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          production_order_item_id: string
          reason: string
          reported_by?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          production_order_item_id?: string
          reason?: string
          reported_by?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_reworks_production_order_item_id_fkey"
            columns: ["production_order_item_id"]
            isOneToOne: false
            referencedRelation: "production_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_reworks_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_steps: {
        Row: {
          created_at: string | null
          end_time: string | null
          estimated_time_minutes: number | null
          id: string
          machine_id: string | null
          operator_id: string | null
          order_index: number | null
          production_order_item_id: string
          start_time: string | null
          status: string
          step_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          estimated_time_minutes?: number | null
          id?: string
          machine_id?: string | null
          operator_id?: string | null
          order_index?: number | null
          production_order_item_id: string
          start_time?: string | null
          status?: string
          step_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          estimated_time_minutes?: number | null
          id?: string
          machine_id?: string | null
          operator_id?: string | null
          order_index?: number | null
          production_order_item_id?: string
          start_time?: string | null
          status?: string
          step_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_steps_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "production_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_steps_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_steps_production_order_item_id_fkey"
            columns: ["production_order_item_id"]
            isOneToOne: false
            referencedRelation: "production_order_items"
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
          model_id: string | null
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
          model_id?: string | null
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
          model_id?: string | null
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
            foreignKeyName: "products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
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
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_cost: number | null
          company_id: string
          created_at: string
          delivery_snapshot: Json | null
          expected_delivery: string | null
          id: string
          notes: string | null
          order_id: string | null
          po_number: string
          purchase_notes: string | null
          purchased_at: string | null
          quote_id: string | null
          receiving_mode: string | null
          status: string
          supplier_account_id: string | null
          supplier_id: string | null
          supplier_order_number: string | null
          total_cost: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          company_id: string
          created_at?: string
          delivery_snapshot?: Json | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          po_number: string
          purchase_notes?: string | null
          purchased_at?: string | null
          quote_id?: string | null
          receiving_mode?: string | null
          status?: string
          supplier_account_id?: string | null
          supplier_id?: string | null
          supplier_order_number?: string | null
          total_cost?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          company_id?: string
          created_at?: string
          delivery_snapshot?: Json | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          po_number?: string
          purchase_notes?: string | null
          purchased_at?: string | null
          quote_id?: string | null
          receiving_mode?: string | null
          status?: string
          supplier_account_id?: string | null
          supplier_id?: string | null
          supplier_order_number?: string | null
          total_cost?: number
          tracking_code?: string | null
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
            foreignKeyName: "purchase_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts_safe"
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
          combination_hash: string | null
          commercial_product_id: string | null
          cost_price: number
          created_at: string
          description: string | null
          external_product_id: string | null
          id: string
          internal_operations_cost: number | null
          internal_services_cost: number | null
          item_attributes: Json | null
          item_name: string
          margin_percent: number
          mirror_supplier_mode: boolean | null
          notes: string | null
          price_status: string | null
          product_service_id: string | null
          profit_amount: number | null
          quantity: number
          quote_id: string
          safety_margin_amount: number | null
          selected_extras: Json | null
          selected_services: Json | null
          snapshot_id: string | null
          source_origin: string
          supplier_extras_cost: number | null
          supplier_freight_cost: number | null
          supplier_id: string | null
          supplier_product_cost: number | null
          supplier_services_cost: number | null
          tax_amount: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          combination_hash?: string | null
          commercial_product_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          external_product_id?: string | null
          id?: string
          internal_operations_cost?: number | null
          internal_services_cost?: number | null
          item_attributes?: Json | null
          item_name: string
          margin_percent?: number
          mirror_supplier_mode?: boolean | null
          notes?: string | null
          price_status?: string | null
          product_service_id?: string | null
          profit_amount?: number | null
          quantity?: number
          quote_id: string
          safety_margin_amount?: number | null
          selected_extras?: Json | null
          selected_services?: Json | null
          snapshot_id?: string | null
          source_origin?: string
          supplier_extras_cost?: number | null
          supplier_freight_cost?: number | null
          supplier_id?: string | null
          supplier_product_cost?: number | null
          supplier_services_cost?: number | null
          tax_amount?: number | null
          total_price?: number
          unit_price?: number
        }
        Update: {
          combination_hash?: string | null
          commercial_product_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          external_product_id?: string | null
          id?: string
          internal_operations_cost?: number | null
          internal_services_cost?: number | null
          item_attributes?: Json | null
          item_name?: string
          margin_percent?: number
          mirror_supplier_mode?: boolean | null
          notes?: string | null
          price_status?: string | null
          product_service_id?: string | null
          profit_amount?: number | null
          quantity?: number
          quote_id?: string
          safety_margin_amount?: number | null
          selected_extras?: Json | null
          selected_services?: Json | null
          snapshot_id?: string | null
          source_origin?: string
          supplier_extras_cost?: number | null
          supplier_freight_cost?: number | null
          supplier_id?: string | null
          supplier_product_cost?: number | null
          supplier_services_cost?: number | null
          tax_amount?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_commercial_products"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "quote_items_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "supplier_price_snapshots"
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
          delivery_days: number | null
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
          revalidated_at: string | null
          revalidated_by: string | null
          revalidation_status: string | null
          sale_price: number | null
          service_desc: string
          status: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          cost_value?: number | null
          created_at?: string
          deadline?: string | null
          delivery_days?: number | null
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
          revalidated_at?: string | null
          revalidated_by?: string | null
          revalidation_status?: string | null
          sale_price?: number | null
          service_desc: string
          status?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          cost_value?: number | null
          created_at?: string
          deadline?: string | null
          delivery_days?: number | null
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
          revalidated_at?: string | null
          revalidated_by?: string | null
          revalidation_status?: string | null
          sale_price?: number | null
          service_desc?: string
          status?: string | null
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
          {
            foreignKeyName: "quotes_revalidated_by_fkey"
            columns: ["revalidated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      supplier_alerts: {
        Row: {
          acknowledged_by: string | null
          alert_type: string
          company_id: string
          created_at: string
          data: Json
          id: string
          message: string | null
          resolved_at: string | null
          severity: string
          status: string
          supplier_id: string | null
          title: string
        }
        Insert: {
          acknowledged_by?: string | null
          alert_type: string
          company_id: string
          created_at?: string
          data?: Json
          id?: string
          message?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          supplier_id?: string | null
          title: string
        }
        Update: {
          acknowledged_by?: string | null
          alert_type?: string
          company_id?: string
          created_at?: string
          data?: Json
          id?: string
          message?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          supplier_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_alerts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_calculation_logs: {
        Row: {
          action_taken: string | null
          calculated_price: number | null
          company_id: string
          created_at: string
          details: Json | null
          diff_amount: number | null
          diff_percent: number | null
          error_message: string | null
          executed_at: string
          executed_by: string | null
          expected_price: number | null
          id: string
          passed: boolean
          test_id: string
        }
        Insert: {
          action_taken?: string | null
          calculated_price?: number | null
          company_id: string
          created_at?: string
          details?: Json | null
          diff_amount?: number | null
          diff_percent?: number | null
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          expected_price?: number | null
          id?: string
          passed: boolean
          test_id: string
        }
        Update: {
          action_taken?: string | null
          calculated_price?: number | null
          company_id?: string
          created_at?: string
          details?: Json | null
          diff_amount?: number | null
          diff_percent?: number | null
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          expected_price?: number | null
          id?: string
          passed?: boolean
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_calculation_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_calculation_logs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_calculation_logs_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "supplier_calculation_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_calculation_tests: {
        Row: {
          company_id: string
          created_at: string
          expected_extras: Json | null
          expected_lead_time: number | null
          expected_price: number
          external_code: string | null
          family_id: string
          id: string
          is_active: boolean
          last_calculated_price: number | null
          last_diff_amount: number | null
          last_diff_percent: number | null
          last_result: string | null
          name: string | null
          options: Json
          quantity: number
          updated_at: string
          url: string | null
          validated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          expected_extras?: Json | null
          expected_lead_time?: number | null
          expected_price: number
          external_code?: string | null
          family_id: string
          id?: string
          is_active?: boolean
          last_calculated_price?: number | null
          last_diff_amount?: number | null
          last_diff_percent?: number | null
          last_result?: string | null
          name?: string | null
          options?: Json
          quantity: number
          updated_at?: string
          url?: string | null
          validated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          expected_extras?: Json | null
          expected_lead_time?: number | null
          expected_price?: number
          external_code?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          last_calculated_price?: number | null
          last_diff_amount?: number | null
          last_diff_percent?: number | null
          last_result?: string | null
          name?: string | null
          options?: Json
          quantity?: number
          updated_at?: string
          url?: string | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_calculation_tests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_calculation_tests_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_families"
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
      supplier_categories: {
        Row: {
          company_id: string
          created_at: string
          external_id: string | null
          id: string
          mapped_category_id: string | null
          name: string
          parent_external_id: string | null
          path: string | null
          site_id: string | null
          supplier_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          mapped_category_id?: string | null
          name: string
          parent_external_id?: string | null
          path?: string | null
          site_id?: string | null
          supplier_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          mapped_category_id?: string | null
          name?: string
          parent_external_id?: string | null
          path?: string | null
          site_id?: string | null
          supplier_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_categories_mapped_category_id_fkey"
            columns: ["mapped_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_categories_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "supplier_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_categories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_change_events: {
        Row: {
          change_percent: number | null
          company_id: string
          confidence: number | null
          crawl_run_id: string | null
          created_at: string
          event_type: string
          field: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          supplier_id: string
          supplier_product_id: string | null
        }
        Insert: {
          change_percent?: number | null
          company_id: string
          confidence?: number | null
          crawl_run_id?: string | null
          created_at?: string
          event_type: string
          field?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supplier_id: string
          supplier_product_id?: string | null
        }
        Update: {
          change_percent?: number | null
          company_id?: string
          confidence?: number | null
          crawl_run_id?: string | null
          created_at?: string
          event_type?: string
          field?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supplier_id?: string
          supplier_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_change_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_change_events_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_change_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_change_events_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_change_events_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_commercial_product_options: {
        Row: {
          commercial_product_id: string
          id: string
          option_value_id: string
        }
        Insert: {
          commercial_product_id: string
          id?: string
          option_value_id: string
        }
        Update: {
          commercial_product_id?: string
          id?: string
          option_value_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_commercial_product_options_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_commercial_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_commercial_product_options_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "supplier_option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_commercial_products: {
        Row: {
          availability: string
          combination_hash: string
          company_id: string
          complete_name: string | null
          created_at: string
          currency: string
          enhancement: string | null
          external_product_id: string | null
          external_sku: string | null
          family_id: string
          finishing: string | null
          format: string | null
          grammage: string | null
          height: number | null
          id: string
          last_synced_at: string | null
          list_price: number | null
          material: string | null
          model: string | null
          print_color: string | null
          production_days: number | null
          promotional_price: number | null
          quantity: number
          quantity_unit: string | null
          raw_source_data: Json
          size: string | null
          source_url: string | null
          supplier_id: string
          type: string | null
          updated_at: string
          version: number
          width: number | null
        }
        Insert: {
          availability?: string
          combination_hash: string
          company_id: string
          complete_name?: string | null
          created_at?: string
          currency?: string
          enhancement?: string | null
          external_product_id?: string | null
          external_sku?: string | null
          family_id: string
          finishing?: string | null
          format?: string | null
          grammage?: string | null
          height?: number | null
          id?: string
          last_synced_at?: string | null
          list_price?: number | null
          material?: string | null
          model?: string | null
          print_color?: string | null
          production_days?: number | null
          promotional_price?: number | null
          quantity: number
          quantity_unit?: string | null
          raw_source_data?: Json
          size?: string | null
          source_url?: string | null
          supplier_id: string
          type?: string | null
          updated_at?: string
          version?: number
          width?: number | null
        }
        Update: {
          availability?: string
          combination_hash?: string
          company_id?: string
          complete_name?: string | null
          created_at?: string
          currency?: string
          enhancement?: string | null
          external_product_id?: string | null
          external_sku?: string | null
          family_id?: string
          finishing?: string | null
          format?: string | null
          grammage?: string | null
          height?: number | null
          id?: string
          last_synced_at?: string | null
          list_price?: number | null
          material?: string | null
          model?: string | null
          print_color?: string | null
          production_days?: number | null
          promotional_price?: number | null
          quantity?: number
          quantity_unit?: string | null
          raw_source_data?: Json
          size?: string | null
          source_url?: string | null
          supplier_id?: string
          type?: string | null
          updated_at?: string
          version?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_commercial_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_commercial_products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_commercial_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_crawl_runs: {
        Row: {
          company_id: string
          confidence: number | null
          created_at: string
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          pages_error: number
          pages_ok: number
          products_found: number
          profile_id: string | null
          run_type: string
          sample: Json
          site_id: string | null
          started_at: string | null
          stats: Json
          status: string
          supplier_id: string
        }
        Insert: {
          company_id: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          pages_error?: number
          pages_ok?: number
          products_found?: number
          profile_id?: string | null
          run_type?: string
          sample?: Json
          site_id?: string | null
          started_at?: string | null
          stats?: Json
          status?: string
          supplier_id: string
        }
        Update: {
          company_id?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          pages_error?: number
          pages_ok?: number
          products_found?: number
          profile_id?: string | null
          run_type?: string
          sample?: Json
          site_id?: string | null
          started_at?: string | null
          stats?: Json
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_crawl_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_crawl_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_crawl_runs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "supplier_mapping_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_crawl_runs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "supplier_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_crawl_runs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_credentials: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kind: string
          meta: Json
          secret_enc: string | null
          site_id: string | null
          supplier_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          secret_enc?: string | null
          site_id?: string | null
          supplier_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          secret_enc?: string | null
          site_id?: string | null
          supplier_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credentials_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "supplier_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credentials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_custom_size_rules: {
        Row: {
          bobbin_width: number | null
          company_id: string
          created_at: string
          family_id: string
          fixed_production_cost: number | null
          formula: string | null
          id: string
          max_height: number | null
          max_width: number | null
          min_area: number | null
          min_height: number | null
          min_price: number | null
          min_width: number | null
          needs_live_query: boolean
          notes: string | null
          price_ranges: Json | null
          pricing_strategy: string
          rounding_area: number | null
          rounding_height: number | null
          rounding_width: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          bobbin_width?: number | null
          company_id: string
          created_at?: string
          family_id: string
          fixed_production_cost?: number | null
          formula?: string | null
          id?: string
          max_height?: number | null
          max_width?: number | null
          min_area?: number | null
          min_height?: number | null
          min_price?: number | null
          min_width?: number | null
          needs_live_query?: boolean
          notes?: string | null
          price_ranges?: Json | null
          pricing_strategy?: string
          rounding_area?: number | null
          rounding_height?: number | null
          rounding_width?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          bobbin_width?: number | null
          company_id?: string
          created_at?: string
          family_id?: string
          fixed_production_cost?: number | null
          formula?: string | null
          id?: string
          max_height?: number | null
          max_width?: number | null
          min_area?: number | null
          min_height?: number | null
          min_price?: number | null
          min_width?: number | null
          needs_live_query?: boolean
          notes?: string | null
          price_ranges?: Json | null
          pricing_strategy?: string
          rounding_area?: number | null
          rounding_height?: number | null
          rounding_width?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_custom_size_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_custom_size_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_extra_compatibility: {
        Row: {
          commercial_product_id: string | null
          company_id: string
          created_at: string
          extra_id: string
          format_filter: Json | null
          id: string
          is_active: boolean
          material_filter: Json | null
          print_filter: Json | null
        }
        Insert: {
          commercial_product_id?: string | null
          company_id: string
          created_at?: string
          extra_id: string
          format_filter?: Json | null
          id?: string
          is_active?: boolean
          material_filter?: Json | null
          print_filter?: Json | null
        }
        Update: {
          commercial_product_id?: string | null
          company_id?: string
          created_at?: string
          extra_id?: string
          format_filter?: Json | null
          id?: string
          is_active?: boolean
          material_filter?: Json | null
          print_filter?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_extra_compatibility_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_commercial_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_extra_compatibility_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_extra_compatibility_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "supplier_extras"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_extra_prices: {
        Row: {
          additional_days: number
          available: boolean
          collected_at: string
          company_id: string
          compatibility_id: string | null
          created_at: string
          extra_id: string
          id: string
          price: number
          quantity: number
        }
        Insert: {
          additional_days?: number
          available?: boolean
          collected_at?: string
          company_id: string
          compatibility_id?: string | null
          created_at?: string
          extra_id: string
          id?: string
          price: number
          quantity: number
        }
        Update: {
          additional_days?: number
          available?: boolean
          collected_at?: string
          company_id?: string
          compatibility_id?: string | null
          created_at?: string
          extra_id?: string
          id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_extra_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_extra_prices_compatibility_id_fkey"
            columns: ["compatibility_id"]
            isOneToOne: false
            referencedRelation: "supplier_extra_compatibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_extra_prices_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "supplier_extras"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_extras: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          description: string | null
          extra_type: string
          family_id: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          extra_type?: string
          family_id: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          extra_type?: string
          family_id?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_extras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_extras_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_import_errors: {
        Row: {
          company_id: string
          crawl_run_id: string | null
          created_at: string
          details: Json
          error_code: string | null
          id: string
          message: string | null
          resolved: boolean
          retry_count: number
          stage: string | null
          supplier_id: string | null
          supplier_product_id: string | null
          url: string | null
        }
        Insert: {
          company_id: string
          crawl_run_id?: string | null
          created_at?: string
          details?: Json
          error_code?: string | null
          id?: string
          message?: string | null
          resolved?: boolean
          retry_count?: number
          stage?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
          url?: string | null
        }
        Update: {
          company_id?: string
          crawl_run_id?: string | null
          created_at?: string
          details?: Json
          error_code?: string | null
          id?: string
          message?: string | null
          resolved?: boolean
          retry_count?: number
          stage?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_import_errors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_errors_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_errors_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_errors_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_import_logs: {
        Row: {
          company_id: string
          crawl_run_id: string | null
          created_at: string
          data: Json
          id: string
          level: string
          message: string | null
          stage: string | null
          supplier_id: string | null
          supplier_product_id: string | null
        }
        Insert: {
          company_id: string
          crawl_run_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          level?: string
          message?: string | null
          stage?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
        }
        Update: {
          company_id?: string
          crawl_run_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          level?: string
          message?: string | null
          stage?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_import_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_logs_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_logs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_logs_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
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
      supplier_mapping_feedback: {
        Row: {
          applied_rule: string | null
          category: string | null
          company_id: string
          context: Json
          corrected_value: string | null
          created_at: string
          field: string
          found_value: string | null
          id: string
          interpreted_value: string | null
          scope: string
          selector: string | null
          source: string | null
          supplier_id: string | null
          supplier_product_id: string | null
          user_id: string | null
        }
        Insert: {
          applied_rule?: string | null
          category?: string | null
          company_id: string
          context?: Json
          corrected_value?: string | null
          created_at?: string
          field: string
          found_value?: string | null
          id?: string
          interpreted_value?: string | null
          scope?: string
          selector?: string | null
          source?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
          user_id?: string | null
        }
        Update: {
          applied_rule?: string | null
          category?: string | null
          company_id?: string
          context?: Json
          corrected_value?: string | null
          created_at?: string
          field?: string
          found_value?: string | null
          id?: string
          interpreted_value?: string | null
          scope?: string
          selector?: string | null
          source?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_mapping_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_mapping_feedback_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_mapping_feedback_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_mapping_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_mapping_profiles: {
        Row: {
          adapter_key: string | null
          approved_at: string | null
          approved_by: string | null
          category_pattern: string | null
          company_id: string
          confidence: number | null
          created_at: string
          health: number | null
          id: string
          last_validated_at: string | null
          name: string
          normalization_rules: Json
          pagination: Json
          product_pattern: string | null
          selectors: Json
          site_id: string | null
          source_priority: Json
          specs_source: string | null
          status: string
          supplier_id: string
          technology: string | null
          updated_at: string
          url_patterns: Json
          version: number
        }
        Insert: {
          adapter_key?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category_pattern?: string | null
          company_id: string
          confidence?: number | null
          created_at?: string
          health?: number | null
          id?: string
          last_validated_at?: string | null
          name?: string
          normalization_rules?: Json
          pagination?: Json
          product_pattern?: string | null
          selectors?: Json
          site_id?: string | null
          source_priority?: Json
          specs_source?: string | null
          status?: string
          supplier_id: string
          technology?: string | null
          updated_at?: string
          url_patterns?: Json
          version?: number
        }
        Update: {
          adapter_key?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category_pattern?: string | null
          company_id?: string
          confidence?: number | null
          created_at?: string
          health?: number | null
          id?: string
          last_validated_at?: string | null
          name?: string
          normalization_rules?: Json
          pagination?: Json
          product_pattern?: string | null
          selectors?: Json
          site_id?: string | null
          source_priority?: Json
          specs_source?: string | null
          status?: string
          supplier_id?: string
          technology?: string | null
          updated_at?: string
          url_patterns?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_mapping_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_mapping_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_mapping_profiles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "supplier_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_mapping_profiles_supplier_id_fkey"
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
      supplier_mapping_versions: {
        Row: {
          change_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          profile_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_note?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          profile_id: string
          snapshot: Json
          version: number
        }
        Update: {
          change_note?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          profile_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_mapping_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_mapping_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_mapping_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "supplier_mapping_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_option_groups: {
        Row: {
          code: string
          company_id: string
          created_at: string
          family_id: string
          id: string
          is_required: boolean
          name: string
          normalized_name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          family_id: string
          id?: string
          is_required?: boolean
          name: string
          normalized_name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          family_id?: string
          id?: string
          is_required?: boolean
          name?: string
          normalized_name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_option_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_option_groups_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_option_values: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          external_id: string | null
          group_id: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string
          order_index: number
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          external_id?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
          order_index?: number
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          external_id?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_option_values_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_option_values_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "supplier_option_groups"
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
      supplier_pages: {
        Row: {
          canonical_url: string | null
          company_id: string
          confidence: number | null
          content_hash: string | null
          crawl_run_id: string | null
          created_at: string
          fetched_at: string | null
          http_status: number | null
          id: string
          page_type: string | null
          parse_status: string | null
          site_id: string | null
          snapshot_id: string | null
          supplier_id: string
          url: string
        }
        Insert: {
          canonical_url?: string | null
          company_id: string
          confidence?: number | null
          content_hash?: string | null
          crawl_run_id?: string | null
          created_at?: string
          fetched_at?: string | null
          http_status?: number | null
          id?: string
          page_type?: string | null
          parse_status?: string | null
          site_id?: string | null
          snapshot_id?: string | null
          supplier_id: string
          url: string
        }
        Update: {
          canonical_url?: string | null
          company_id?: string
          confidence?: number | null
          content_hash?: string | null
          crawl_run_id?: string | null
          created_at?: string
          fetched_at?: string | null
          http_status?: number | null
          id?: string
          page_type?: string | null
          parse_status?: string | null
          site_id?: string | null
          snapshot_id?: string | null
          supplier_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_pages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_pages_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_pages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "supplier_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_pages_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "supplier_page_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_pages_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_history: {
        Row: {
          approved_by: string | null
          change_percent: number | null
          changed_at: string
          company_id: string
          confidence: number | null
          crawl_run_id: string | null
          created_at: string
          currency: string
          id: string
          new_price: number | null
          old_price: number | null
          quantity: number | null
          source: string | null
          supplier_id: string
          supplier_product_id: string | null
          variant_external_id: string | null
        }
        Insert: {
          approved_by?: string | null
          change_percent?: number | null
          changed_at?: string
          company_id: string
          confidence?: number | null
          crawl_run_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          new_price?: number | null
          old_price?: number | null
          quantity?: number | null
          source?: string | null
          supplier_id: string
          supplier_product_id?: string | null
          variant_external_id?: string | null
        }
        Update: {
          approved_by?: string | null
          change_percent?: number | null
          changed_at?: string
          company_id?: string
          confidence?: number | null
          crawl_run_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          new_price?: number | null
          old_price?: number | null
          quantity?: number | null
          source?: string | null
          supplier_id?: string
          supplier_product_id?: string | null
          variant_external_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_history_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_history_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_history_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_snapshots: {
        Row: {
          base_lead_time_days: number | null
          collected_at: string | null
          combination_hash: string | null
          company_id: string
          created_at: string
          created_by: string | null
          external_code: string | null
          extras: Json
          extras_lead_time_days: number | null
          extras_total: number
          family_id: string | null
          family_name: string | null
          final_sale_price: number
          freight_cost: number | null
          freight_days: number | null
          freight_method: string | null
          freight_zip: string | null
          id: string
          internal_operations_cost: number
          internal_services_cost: number
          margin_percent: number | null
          normal_price: number | null
          profit_amount: number
          promo_campaign: string | null
          promo_end: string | null
          promo_origin: string | null
          promo_start: string | null
          promotional_price: number | null
          quantity: number
          quote_item_id: string | null
          safety_margin_amount: number
          selected_options: Json
          services: Json
          services_total: number
          snapshot_at: string
          source_url: string | null
          supplier_extras_cost: number
          supplier_freight_cost: number
          supplier_id: string
          supplier_name: string | null
          supplier_product_cost: number
          supplier_services_cost: number
          tax_amount: number
          total_lead_time_days: number | null
          total_price: number
          total_supplier_cost: number
          unit_price_display: number | null
        }
        Insert: {
          base_lead_time_days?: number | null
          collected_at?: string | null
          combination_hash?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          external_code?: string | null
          extras?: Json
          extras_lead_time_days?: number | null
          extras_total?: number
          family_id?: string | null
          family_name?: string | null
          final_sale_price: number
          freight_cost?: number | null
          freight_days?: number | null
          freight_method?: string | null
          freight_zip?: string | null
          id?: string
          internal_operations_cost?: number
          internal_services_cost?: number
          margin_percent?: number | null
          normal_price?: number | null
          profit_amount?: number
          promo_campaign?: string | null
          promo_end?: string | null
          promo_origin?: string | null
          promo_start?: string | null
          promotional_price?: number | null
          quantity: number
          quote_item_id?: string | null
          safety_margin_amount?: number
          selected_options?: Json
          services?: Json
          services_total?: number
          snapshot_at?: string
          source_url?: string | null
          supplier_extras_cost?: number
          supplier_freight_cost?: number
          supplier_id: string
          supplier_name?: string | null
          supplier_product_cost: number
          supplier_services_cost?: number
          tax_amount?: number
          total_lead_time_days?: number | null
          total_price: number
          total_supplier_cost: number
          unit_price_display?: number | null
        }
        Update: {
          base_lead_time_days?: number | null
          collected_at?: string | null
          combination_hash?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          external_code?: string | null
          extras?: Json
          extras_lead_time_days?: number | null
          extras_total?: number
          family_id?: string | null
          family_name?: string | null
          final_sale_price?: number
          freight_cost?: number | null
          freight_days?: number | null
          freight_method?: string | null
          freight_zip?: string | null
          id?: string
          internal_operations_cost?: number
          internal_services_cost?: number
          margin_percent?: number | null
          normal_price?: number | null
          profit_amount?: number
          promo_campaign?: string | null
          promo_end?: string | null
          promo_origin?: string | null
          promo_start?: string | null
          promotional_price?: number | null
          quantity?: number
          quote_item_id?: string | null
          safety_margin_amount?: number
          selected_options?: Json
          services?: Json
          services_total?: number
          snapshot_at?: string
          source_url?: string | null
          supplier_extras_cost?: number
          supplier_freight_cost?: number
          supplier_id?: string
          supplier_name?: string | null
          supplier_product_cost?: number
          supplier_services_cost?: number
          tax_amount?: number
          total_lead_time_days?: number | null
          total_price?: number
          total_supplier_cost?: number
          unit_price_display?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_product_families: {
        Row: {
          catalog_product_id: string | null
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          is_active: boolean
          last_synced_at: string | null
          lead_time_rule: string
          name: string
          pricing_strategy: string
          slug: string | null
          source_url: string | null
          supplier_id: string
          updated_at: string
          version: number
        }
        Insert: {
          catalog_product_id?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_synced_at?: string | null
          lead_time_rule?: string
          name: string
          pricing_strategy?: string
          slug?: string | null
          source_url?: string | null
          supplier_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          catalog_product_id?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_synced_at?: string | null
          lead_time_rule?: string
          name?: string
          pricing_strategy?: string
          slug?: string | null
          source_url?: string | null
          supplier_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_families_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_families_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_families_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_product_price_history: {
        Row: {
          availability: string | null
          captured_at: string
          change_percent: number | null
          commercial_product_id: string | null
          company_id: string
          created_at: string
          executed_by: string | null
          external_product_id: string | null
          id: string
          new_price: number | null
          old_price: number | null
          production_days: number | null
          promotional_price: number | null
          source: string | null
          supplier_id: string
        }
        Insert: {
          availability?: string | null
          captured_at?: string
          change_percent?: number | null
          commercial_product_id?: string | null
          company_id: string
          created_at?: string
          executed_by?: string | null
          external_product_id?: string | null
          id?: string
          new_price?: number | null
          old_price?: number | null
          production_days?: number | null
          promotional_price?: number | null
          source?: string | null
          supplier_id: string
        }
        Update: {
          availability?: string | null
          captured_at?: string
          change_percent?: number | null
          commercial_product_id?: string | null
          company_id?: string
          created_at?: string
          executed_by?: string | null
          external_product_id?: string | null
          id?: string
          new_price?: number | null
          old_price?: number | null
          production_days?: number | null
          promotional_price?: number | null
          source?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_price_history_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_commercial_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_price_history_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_product_variants: {
        Row: {
          available: boolean
          catalog_variant_id: string | null
          company_id: string
          content_hash: string | null
          created_at: string
          external_id: string | null
          id: string
          normalized_attributes: Json
          raw_attributes: Json
          sku: string | null
          supplier_product_id: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          catalog_variant_id?: string | null
          company_id: string
          content_hash?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          normalized_attributes?: Json
          raw_attributes?: Json
          sku?: string | null
          supplier_product_id: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          catalog_variant_id?: string | null
          company_id?: string
          content_hash?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          normalized_attributes?: Json
          raw_attributes?: Json
          sku?: string | null
          supplier_product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_variants_catalog_variant_id_fkey"
            columns: ["catalog_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_variants_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          canonical_url: string | null
          catalog_product_id: string | null
          company_id: string
          confidence: number | null
          content_hash: string | null
          crawl_run_id: string | null
          created_at: string
          external_id: string | null
          first_seen_at: string
          id: string
          last_changed_at: string | null
          last_seen_at: string
          normalized_data: Json
          raw_data: Json
          raw_name: string | null
          site_id: string | null
          source_url: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          catalog_product_id?: string | null
          company_id: string
          confidence?: number | null
          content_hash?: string | null
          crawl_run_id?: string | null
          created_at?: string
          external_id?: string | null
          first_seen_at?: string
          id?: string
          last_changed_at?: string | null
          last_seen_at?: string
          normalized_data?: Json
          raw_data?: Json
          raw_name?: string | null
          site_id?: string | null
          source_url: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          catalog_product_id?: string | null
          company_id?: string
          confidence?: number | null
          content_hash?: string | null
          crawl_run_id?: string | null
          created_at?: string
          external_id?: string | null
          first_seen_at?: string
          id?: string
          last_changed_at?: string | null
          last_seen_at?: string
          normalized_data?: Json
          raw_data?: Json
          raw_name?: string | null
          site_id?: string | null
          source_url?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "supplier_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_promotions: {
        Row: {
          campaign: string | null
          commercial_product_id: string | null
          company_id: string
          created_at: string
          detected_at: string
          discount_percent: number | null
          ends_at: string | null
          family_id: string | null
          id: string
          normal_price: number | null
          origin: string | null
          promo_price: number | null
          quantity: number | null
          starts_at: string | null
          status: string
          supplier_id: string
          supplier_product_id: string | null
          updated_at: string
          variant_external_id: string | null
        }
        Insert: {
          campaign?: string | null
          commercial_product_id?: string | null
          company_id: string
          created_at?: string
          detected_at?: string
          discount_percent?: number | null
          ends_at?: string | null
          family_id?: string | null
          id?: string
          normal_price?: number | null
          origin?: string | null
          promo_price?: number | null
          quantity?: number | null
          starts_at?: string | null
          status?: string
          supplier_id: string
          supplier_product_id?: string | null
          updated_at?: string
          variant_external_id?: string | null
        }
        Update: {
          campaign?: string | null
          commercial_product_id?: string | null
          company_id?: string
          created_at?: string
          detected_at?: string
          discount_percent?: number | null
          ends_at?: string | null
          family_id?: string | null
          id?: string
          normal_price?: number | null
          origin?: string | null
          promo_price?: number | null
          quantity?: number | null
          starts_at?: string | null
          status?: string
          supplier_id?: string
          supplier_product_id?: string | null
          updated_at?: string
          variant_external_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_promotions_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_commercial_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_promotions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_promotions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_promotions_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_service_prices: {
        Row: {
          collected_at: string
          commercial_product_id: string | null
          company_id: string
          created_at: string
          currency: string
          family_id: string | null
          id: string
          price: number
          service_id: string
        }
        Insert: {
          collected_at?: string
          commercial_product_id?: string | null
          company_id: string
          created_at?: string
          currency?: string
          family_id?: string | null
          id?: string
          price: number
          service_id: string
        }
        Update: {
          collected_at?: string
          commercial_product_id?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          family_id?: string | null
          id?: string
          price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_service_prices_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_commercial_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_service_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_service_prices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "supplier_services"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_services: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_site_nodes: {
        Row: {
          breadcrumb: Json
          canonical_url: string | null
          company_id: string
          confidence: number | null
          crawl_run_id: string | null
          created_at: string
          depth: number
          discovered_via: string | null
          id: string
          ignored: boolean
          node_type: string
          parent_id: string | null
          product_count: number
          site_id: string | null
          supplier_id: string
          title: string | null
          url: string
        }
        Insert: {
          breadcrumb?: Json
          canonical_url?: string | null
          company_id: string
          confidence?: number | null
          crawl_run_id?: string | null
          created_at?: string
          depth?: number
          discovered_via?: string | null
          id?: string
          ignored?: boolean
          node_type?: string
          parent_id?: string | null
          product_count?: number
          site_id?: string | null
          supplier_id: string
          title?: string | null
          url: string
        }
        Update: {
          breadcrumb?: Json
          canonical_url?: string | null
          company_id?: string
          confidence?: number | null
          crawl_run_id?: string | null
          created_at?: string
          depth?: number
          discovered_via?: string | null
          id?: string
          ignored?: boolean
          node_type?: string
          parent_id?: string | null
          product_count?: number
          site_id?: string | null
          supplier_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_site_nodes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_site_nodes_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_site_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "supplier_site_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_site_nodes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "supplier_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_site_nodes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_sites: {
        Row: {
          allowed: boolean
          base_url: string | null
          company_id: string
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          name: string | null
          navigation_strategy: string | null
          notes: string | null
          robots_checked_at: string | null
          robots_txt: string | null
          sitemap_url: string | null
          supplier_id: string
          technology: string | null
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          base_url?: string | null
          company_id: string
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          name?: string | null
          navigation_strategy?: string | null
          notes?: string | null
          robots_checked_at?: string | null
          robots_txt?: string | null
          sitemap_url?: string | null
          supplier_id: string
          technology?: string | null
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          base_url?: string | null
          company_id?: string
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          name?: string | null
          navigation_strategy?: string | null
          notes?: string | null
          robots_checked_at?: string | null
          robots_txt?: string | null
          sitemap_url?: string | null
          supplier_id?: string
          technology?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_sites_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_sync_schedules: {
        Row: {
          cadence: string
          company_id: string
          created_at: string
          created_by: string | null
          cron: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          next_run_at: string | null
          options: Json
          profile_id: string | null
          site_id: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          cadence?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          cron?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          options?: Json
          profile_id?: string | null
          site_id?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          cron?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          options?: Json
          profile_id?: string | null
          site_id?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_sync_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_sync_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_sync_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "supplier_mapping_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_sync_schedules_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "supplier_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_sync_schedules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active_profile_id: string | null
          company_id: string
          confidence_auto: number
          confidence_review: number
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_margin: number | null
          domain: string | null
          health_score: number | null
          id: string
          integration_status: string
          last_synced_at: string | null
          name: string
          next_sync_at: string | null
          notes: string | null
          status: string
          technology: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          active_profile_id?: string | null
          company_id: string
          confidence_auto?: number
          confidence_review?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_margin?: number | null
          domain?: string | null
          health_score?: number | null
          id?: string
          integration_status?: string
          last_synced_at?: string | null
          name: string
          next_sync_at?: string | null
          notes?: string | null
          status?: string
          technology?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          active_profile_id?: string | null
          company_id?: string
          confidence_auto?: number
          confidence_review?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_margin?: number | null
          domain?: string | null
          health_score?: number | null
          id?: string
          integration_status?: string
          last_synced_at?: string | null
          name?: string
          next_sync_at?: string | null
          notes?: string | null
          status?: string
          technology?: string | null
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
      technical_attribute_groups: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_attribute_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_attribute_options: {
        Row: {
          attribute_id: string
          color_code: string | null
          id: string
          label: string
          order_index: number | null
          price_impact: number | null
          supplier_id: string | null
          value: string
        }
        Insert: {
          attribute_id: string
          color_code?: string | null
          id?: string
          label: string
          order_index?: number | null
          price_impact?: number | null
          supplier_id?: string | null
          value: string
        }
        Update: {
          attribute_id?: string
          color_code?: string | null
          id?: string
          label?: string
          order_index?: number | null
          price_impact?: number | null
          supplier_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_attribute_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "technical_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_attribute_options_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_attributes: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          default_value: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          name: string
          type: string
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          default_value?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name: string
          type: string
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          default_value?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_attributes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_attributes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "technical_attribute_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      site_products: {
        Row: {
          active: boolean | null
          categoria: string | null
          crm_id: string | null
          destaque: boolean | null
          em_promocao: boolean | null
          exclusivo_revenda: boolean | null
          id: string | null
          imagem: string | null
          imagens: number | null
          name: string | null
          novidade: boolean | null
          opcoes: number | null
          grupos_opcao: number | null
          prazo_producao_dias: number | null
          preco_base: number | null
          preco_promocional: number | null
          preco_revenda: number | null
          quantidade_minima: number | null
          sku: string | null
          slug: string | null
          sync_status: string | null
          synced_at: string | null
          sync_version: number | null
          tiragens: number | null
          unidade_preco: string | null
          updated_at: string | null
          variantes: number | null
        }
        Relationships: []
      }
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
      crm_default_company: { Args: never; Returns: string }
      get_auth_company_id: { Args: never; Returns: string }
      map_client_type_back: { Args: { p_type: string }; Returns: string }
      map_customer_type: { Args: { p_type: string }; Returns: string }
      map_payment_status: { Args: { p_status: string }; Returns: string }
      map_production_status: { Args: { p_status: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
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

