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
      channel_listings: {
        Row: {
          atributos: Json
          category_externa: string | null
          channel_id: string
          company_id: string
          created_at: string
          description: string | null
          external_id: string | null
          external_variation_id: string | null
          id: string
          last_error: string | null
          last_pushed_at: string | null
          payload: Json | null
          price: number
          product_id: string | null
          sku: string | null
          status: string
          stock_mode: string
          title: string
          updated_at: string
          variant_id: string | null
          virtual_qty: number
        }
        Insert: {
          atributos?: Json
          category_externa?: string | null
          channel_id: string
          company_id: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          external_variation_id?: string | null
          id?: string
          last_error?: string | null
          last_pushed_at?: string | null
          payload?: Json | null
          price?: number
          product_id?: string | null
          sku?: string | null
          status?: string
          stock_mode?: string
          title?: string
          updated_at?: string
          variant_id?: string | null
          virtual_qty?: number
        }
        Update: {
          atributos?: Json
          category_externa?: string | null
          channel_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          external_variation_id?: string | null
          id?: string
          last_error?: string | null
          last_pushed_at?: string | null
          payload?: Json | null
          price?: number
          product_id?: string | null
          sku?: string | null
          status?: string
          stock_mode?: string
          title?: string
          updated_at?: string
          variant_id?: string | null
          virtual_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_listings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_listings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_listings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_listings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_orders: {
        Row: {
          channel_id: string
          company_id: string
          erro: string | null
          external_order_id: string
          id: string
          raw: Json | null
          recebido_em: string
          status_externo: string | null
          store_order_id: string | null
          total: number | null
          ultimo_evento_em: string | null
        }
        Insert: {
          channel_id: string
          company_id: string
          erro?: string | null
          external_order_id: string
          id?: string
          raw?: Json | null
          recebido_em?: string
          status_externo?: string | null
          store_order_id?: string | null
          total?: number | null
          ultimo_evento_em?: string | null
        }
        Update: {
          channel_id?: string
          company_id?: string
          erro?: string | null
          external_order_id?: string
          id?: string
          raw?: Json | null
          recebido_em?: string
          status_externo?: string | null
          store_order_id?: string | null
          total?: number | null
          ultimo_evento_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_secrets: {
        Row: {
          access_token_enc: string | null
          channel_id: string
          expires_at: string | null
          refresh_token_enc: string | null
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token_enc?: string | null
          channel_id: string
          expires_at?: string | null
          refresh_token_enc?: string | null
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token_enc?: string | null
          channel_id?: string
          expires_at?: string | null
          refresh_token_enc?: string | null
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_secrets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channel_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_secrets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_sync_log: {
        Row: {
          channel_id: string | null
          company_id: string
          created_at: string
          direcao: string
          duracao_ms: number | null
          erro: string | null
          id: string
          payload: Json | null
          ref_id: string | null
          sucesso: boolean
          tipo: string
        }
        Insert: {
          channel_id?: string | null
          company_id: string
          created_at?: string
          direcao: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          payload?: Json | null
          ref_id?: string | null
          sucesso: boolean
          tipo: string
        }
        Update: {
          channel_id?: string | null
          company_id?: string
          created_at?: string
          direcao?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          payload?: Json | null
          ref_id?: string | null
          sucesso?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_sync_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_sync_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_sync_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_sync_queue: {
        Row: {
          channel_id: string
          company_id: string
          created_at: string
          erro: string | null
          id: string
          payload: Json
          proxima_tentativa: string
          ref_id: string | null
          status: string
          tentativas: number
          tipo: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          company_id: string
          created_at?: string
          erro?: string | null
          id?: string
          payload?: Json
          proxima_tentativa?: string
          ref_id?: string | null
          status?: string
          tentativas?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          company_id?: string
          created_at?: string
          erro?: string | null
          id?: string
          payload?: Json
          proxima_tentativa?: string
          ref_id?: string | null
          status?: string
          tentativas?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_sync_queue_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_sync_queue_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_sync_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
          bank_info: string | null
          city: string | null
          cnpj: string | null
          complement: string | null
          contract_terms: string | null
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
          logo_url: string | null
          name: string
          neighborhood: string | null
          owner_id: string
          phone: string | null
          preferred_pickup_point: string | null
          state: string | null
          state_registration: string | null
          store_access: boolean
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          bank_info?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          contract_terms?: string | null
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
          logo_url?: string | null
          name: string
          neighborhood?: string | null
          owner_id: string
          phone?: string | null
          preferred_pickup_point?: string | null
          state?: string | null
          state_registration?: string | null
          store_access?: boolean
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          bank_info?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          contract_terms?: string | null
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
          logo_url?: string | null
          name?: string
          neighborhood?: string | null
          owner_id?: string
          phone?: string | null
          preferred_pickup_point?: string | null
          state?: string | null
          state_registration?: string | null
          store_access?: boolean
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          permissions: Json
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          active: boolean
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
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
      sales_channels: {
        Row: {
          apelido: string
          company_id: string
          config: Json
          connected_at: string | null
          created_at: string
          error_message: string | null
          external_account_id: string | null
          id: string
          last_sync_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          apelido?: string
          company_id: string
          config?: Json
          connected_at?: string | null
          created_at?: string
          error_message?: string | null
          external_account_id?: string | null
          id?: string
          last_sync_at?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          apelido?: string
          company_id?: string
          config?: Json
          connected_at?: string | null
          created_at?: string
          error_message?: string | null
          external_account_id?: string | null
          id?: string
          last_sync_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_channels_company_id_fkey"
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
      channel_status: {
        Row: {
          anuncios_ativos: number | null
          apelido: string | null
          company_id: string | null
          config: Json | null
          connected_at: string | null
          error_message: string | null
          external_account_id: string | null
          fila_com_erro: number | null
          fila_pendente: number | null
          id: string | null
          last_sync_at: string | null
          provider: string | null
          status: string | null
          tem_token: boolean | null
          token_expira_em: string | null
          token_vencido: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_channels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      site_products: {
        Row: {
          active: boolean | null
          categoria: string | null
          crm_id: string | null
          destaque: boolean | null
          em_promocao: boolean | null
          exclusivo_revenda: boolean | null
          grupos_opcao: number | null
          id: string | null
          imagem: string | null
          imagens: number | null
          name: string | null
          novidade: boolean | null
          opcoes: number | null
          prazo_producao_dias: number | null
          preco_base: number | null
          preco_promocional: number | null
          preco_revenda: number | null
          quantidade_minima: number | null
          sku: string | null
          slug: string | null
          sync_status: string | null
          sync_version: number | null
          synced_at: string | null
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
      channel_queue_reservar: {
        Args: { p_limite?: number; p_minutos_travado?: number }
        Returns: {
          channel_id: string
          company_id: string
          created_at: string
          erro: string | null
          id: string
          payload: Json
          proxima_tentativa: string
          ref_id: string | null
          status: string
          tentativas: number
          tipo: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "channel_sync_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      crm_default_company: { Args: never; Returns: string }
      data_mode: { Args: { entidade: string }; Returns: string }
      get_auth_company_id: { Args: never; Returns: string }
      get_user_company_id: { Args: never; Returns: string }
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
  store: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          description: string | null
          entity: string | null
          entity_id: string | null
          id: string
          ip: string | null
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          cep: string
          city: string
          complement: string | null
          created_at: string
          customer_id: string | null
          district: string
          id: string
          is_default: boolean
          label: string
          number: string
          profile_id: string | null
          recipient: string | null
          reference: string | null
          state: string
          street: string
          updated_at: string
        }
        Insert: {
          cep: string
          city: string
          complement?: string | null
          created_at?: string
          customer_id?: string | null
          district: string
          id?: string
          is_default?: boolean
          label?: string
          number: string
          profile_id?: string | null
          recipient?: string | null
          reference?: string | null
          state: string
          street: string
          updated_at?: string
        }
        Update: {
          cep?: string
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string | null
          district?: string
          id?: string
          is_default?: boolean
          label?: string
          number?: string
          profile_id?: string | null
          recipient?: string | null
          reference?: string | null
          state?: string
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      art_approvals: {
        Row: {
          art_file_id: string | null
          comment: string | null
          created_at: string
          decided_by: string | null
          decided_by_name: string | null
          id: string
          order_id: string
          order_item_id: string | null
          status: string
          version: number
        }
        Insert: {
          art_file_id?: string | null
          comment?: string | null
          created_at?: string
          decided_by?: string | null
          decided_by_name?: string | null
          id?: string
          order_id: string
          order_item_id?: string | null
          status: string
          version?: number
        }
        Update: {
          art_file_id?: string | null
          comment?: string | null
          created_at?: string
          decided_by?: string | null
          decided_by_name?: string | null
          id?: string
          order_id?: string
          order_item_id?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "art_approvals_art_file_id_fkey"
            columns: ["art_file_id"]
            isOneToOne: false
            referencedRelation: "art_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_approvals_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      art_files: {
        Row: {
          analysis_note: string | null
          created_at: string
          customer_id: string | null
          extension: string | null
          file_name: string
          file_size: number
          id: string
          is_current: boolean
          kind: string
          mime_type: string | null
          order_id: string | null
          order_item_id: string | null
          profile_id: string | null
          quote_id: string | null
          status: string
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          analysis_note?: string | null
          created_at?: string
          customer_id?: string | null
          extension?: string | null
          file_name: string
          file_size?: number
          id?: string
          is_current?: boolean
          kind?: string
          mime_type?: string | null
          order_id?: string | null
          order_item_id?: string | null
          profile_id?: string | null
          quote_id?: string | null
          status?: string
          storage_path: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          analysis_note?: string | null
          created_at?: string
          customer_id?: string | null
          extension?: string | null
          file_name?: string
          file_size?: number
          id?: string
          is_current?: boolean
          kind?: string
          mime_type?: string | null
          order_id?: string | null
          order_item_id?: string | null
          profile_id?: string | null
          quote_id?: string | null
          status?: string
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "art_files_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_files_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_files_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string | null
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          link_url: string | null
          mobile_image_url: string | null
          placement: string
          position: number
          secondary_cta_label: string | null
          secondary_link_url: string | null
          starts_at: string | null
          subtitle: string | null
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          mobile_image_url?: string | null
          placement?: string
          position?: number
          secondary_cta_label?: string | null
          secondary_link_url?: string | null
          starts_at?: string | null
          subtitle?: string | null
          theme?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          mobile_image_url?: string | null
          placement?: string
          position?: number
          secondary_cta_label?: string | null
          secondary_link_url?: string | null
          starts_at?: string | null
          subtitle?: string | null
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          art_flow: string | null
          cart_id: string
          created_at: string
          id: string
          notes: string | null
          options: Json
          price_breakdown: Json
          product_id: string
          production_days: number
          quantity: number
          saved_for_later: boolean
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          art_flow?: string | null
          cart_id: string
          created_at?: string
          id?: string
          notes?: string | null
          options?: Json
          price_breakdown?: Json
          product_id: string
          production_days?: number
          quantity?: number
          saved_for_later?: boolean
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          art_flow?: string | null
          cart_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          options?: Json
          price_breakdown?: Json
          product_id?: string
          production_days?: number
          quantity?: number
          saved_for_later?: boolean
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          converted_order_id: string | null
          coupon_code: string | null
          created_at: string
          id: string
          notes: string | null
          profile_id: string | null
          session_token: string | null
          share_token: string | null
          shipping_cep: string | null
          shipping_cost: number
          shipping_days: number | null
          shipping_method: string | null
          updated_at: string
        }
        Insert: {
          converted_order_id?: string | null
          coupon_code?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string | null
          session_token?: string | null
          share_token?: string | null
          shipping_cep?: string | null
          shipping_cost?: number
          shipping_days?: number | null
          shipping_method?: string | null
          updated_at?: string
        }
        Update: {
          converted_order_id?: string | null
          coupon_code?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string | null
          session_token?: string | null
          share_token?: string | null
          shipping_cep?: string | null
          shipping_cost?: number
          shipping_days?: number | null
          shipping_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_session_id: string
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          order_id: string | null
          payment_method: string | null
          reference: string | null
          type: string
        }
        Insert: {
          amount: number
          cash_session_id: string
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          order_id?: string | null
          payment_method?: string | null
          reference?: string | null
          type: string
        }
        Update: {
          amount?: number
          cash_session_id?: string
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          order_id?: string | null
          payment_method?: string | null
          reference?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closing_amount: number | null
          difference_amount: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_amount: number
          operator_id: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closing_amount?: number | null
          difference_amount?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          operator_id: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closing_amount?: number | null
          difference_amount?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          operator_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          featured: boolean
          icon: string | null
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          position: number
          seo_description: string | null
          seo_title: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          featured?: boolean
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          position?: number
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          featured?: boolean
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          position?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          base_amount: number
          created_at: string
          id: string
          note: string | null
          order_id: string | null
          paid_at: string | null
          percentage: number
          profile_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          base_amount?: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          paid_at?: string | null
          percentage?: number
          profile_id: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          base_amount?: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          paid_at?: string | null
          percentage?: number
          profile_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_events: {
        Row: {
          attempts: number
          company_id: string
          created_at: string
          event_id: string
          event_name: string
          event_time: string
          events_received: number | null
          fbtrace_id: string | null
          id: string
          last_error_code: string | null
          last_error_message: string | null
          last_http_status: number | null
          locked_until: string | null
          next_attempt_at: string
          order_id: string | null
          payload: Json
          quote_id: string | null
          sent_at: string | null
          sent_mode: string | null
          session_id: string | null
          skip_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          company_id: string
          created_at?: string
          event_id: string
          event_name: string
          event_time: string
          events_received?: number | null
          fbtrace_id?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_http_status?: number | null
          locked_until?: string | null
          next_attempt_at?: string
          order_id?: string | null
          payload?: Json
          quote_id?: string | null
          sent_at?: string | null
          sent_mode?: string | null
          session_id?: string | null
          skip_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          company_id?: string
          created_at?: string
          event_id?: string
          event_name?: string
          event_time?: string
          events_received?: number | null
          fbtrace_id?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_http_status?: number | null
          locked_until?: string | null
          next_attempt_at?: string
          order_id?: string | null
          payload?: Json
          quote_id?: string | null
          sent_at?: string | null
          sent_mode?: string | null
          session_id?: string | null
          skip_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "marketing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_uses: {
        Row: {
          coupon_id: string
          created_at: string
          discount_amount: number
          id: string
          order_id: string | null
          profile_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          profile_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_uses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_uses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          applies_to_role: string | null
          category_id: string | null
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          first_purchase_only: boolean
          id: string
          max_discount: number | null
          min_order: number
          per_customer_limit: number
          product_id: string | null
          updated_at: string
          usage_limit: number | null
          used_count: number
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          applies_to_role?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          first_purchase_only?: boolean
          id?: string
          max_discount?: number | null
          min_order?: number
          per_customer_limit?: number
          product_id?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          applies_to_role?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          first_purchase_only?: boolean
          id?: string
          max_discount?: number | null
          min_order?: number
          per_customer_limit?: number
          product_id?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_requests: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          reason: string | null
          requested_limit: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          reason?: string | null
          requested_limit: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          reason?: string | null
          requested_limit?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          order_id: string | null
          profile_id: string
          reason: string
          type: string
        }
        Insert: {
          amount: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          profile_id: string
          reason: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          profile_id?: string
          reason?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          company_name: string | null
          created_at: string
          created_by: string | null
          customer_type: string
          document: string | null
          email: string | null
          id: string
          is_demo: boolean
          last_order_at: string | null
          name: string
          notes: string | null
          owner_reseller_id: string | null
          phone: string | null
          profile_id: string | null
          seller_id: string | null
          state_registration: string | null
          sync_origin: string
          system_key: string | null
          tags: string[]
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string
          document?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          last_order_at?: string | null
          name: string
          notes?: string | null
          owner_reseller_id?: string | null
          phone?: string | null
          profile_id?: string | null
          seller_id?: string | null
          state_registration?: string | null
          sync_origin?: string
          system_key?: string | null
          tags?: string[]
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string
          document?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          last_order_at?: string | null
          name?: string
          notes?: string | null
          owner_reseller_id?: string | null
          phone?: string | null
          profile_id?: string | null
          seller_id?: string | null
          state_registration?: string | null
          sync_origin?: string
          system_key?: string | null
          tags?: string[]
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_owner_reseller_id_fkey"
            columns: ["owner_reseller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_requests: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          quote_id: string | null
          reason: string | null
          requested_by: string
          requested_pct: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          quote_id?: string | null
          reason?: string | null
          requested_by: string
          requested_pct: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          quote_id?: string | null
          reason?: string | null
          requested_by?: string
          requested_pct?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          active: boolean
          answer: string
          category: string | null
          created_at: string
          id: string
          position: number
          question: string
        }
        Insert: {
          active?: boolean
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          position?: number
          question: string
        }
        Update: {
          active?: boolean
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          position?: number
          question?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          product_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string
          document_number: string | null
          due_date: string
          id: string
          is_demo: boolean
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          supplier: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description: string
          document_number?: string | null
          due_date: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          supplier?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string
          document_number?: string | null
          due_date?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          supplier?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_tables: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_default: boolean
          margin_type: string
          margin_value: number
          name: string
          reseller_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          margin_type?: string
          margin_value?: number
          name: string
          reseller_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          margin_type?: string
          margin_value?: number
          name?: string
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "margin_tables_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_assets: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          download_count: number
          file_size: number | null
          file_type: string | null
          id: string
          storage_path: string
          title: string
          whitelabel: boolean
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path: string
          title: string
          whitelabel?: boolean
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path?: string
          title?: string
          whitelabel?: boolean
        }
        Relationships: []
      }
      marketing_attribution_audit: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          before: Json | null
          company_id: string
          created_at: string
          id: number
          order_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          created_at?: string
          id?: never
          order_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          created_at?: string
          id?: never
          order_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_attribution_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_attribution_settings: {
        Row: {
          company_id: string
          primary_model: string
          updated_at: string
          updated_by: string | null
          version: number
          window_days: number
        }
        Insert: {
          company_id: string
          primary_model?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          window_days?: number
        }
        Update: {
          company_id?: string
          primary_model?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          window_days?: number
        }
        Relationships: []
      }
      marketing_session_links: {
        Row: {
          company_id: string
          id: string
          linked_at: string
          session_id: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          company_id: string
          id?: string
          linked_at?: string
          session_id: string
          subject_id: string
          subject_type: string
        }
        Update: {
          company_id?: string
          id?: string
          linked_at?: string
          session_id?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_session_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "marketing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sessions: {
        Row: {
          ads_consent: boolean
          client_user_agent: string | null
          company_id: string
          first_seen_at: string
          id: string
          last_seen_at: string
          profile_id: string | null
        }
        Insert: {
          ads_consent?: boolean
          client_user_agent?: string | null
          company_id: string
          first_seen_at?: string
          id: string
          last_seen_at?: string
          profile_id?: string | null
        }
        Update: {
          ads_consent?: boolean
          client_user_agent?: string | null
          company_id?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_signal_settings: {
        Row: {
          company_id: string
          enabled: boolean
          graph_api_version: string
          mode: string
          pixel_id: string | null
          site_url: string
          test_event_code: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          company_id: string
          enabled?: boolean
          graph_api_version?: string
          mode?: string
          pixel_id?: string | null
          site_url?: string
          test_event_code?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          company_id?: string
          enabled?: boolean
          graph_api_version?: string
          mode?: string
          pixel_id?: string | null
          site_url?: string
          test_event_code?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      marketing_touchpoints: {
        Row: {
          channel: string
          company_id: string
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          first_occurred_at: string
          hits: number
          id: string
          landing_path: string
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          occurred_at: string
          referrer_host: string | null
          session_id: string
          touch_key: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          channel: string
          company_id: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_occurred_at?: string
          hits?: number
          id?: string
          landing_path: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          occurred_at?: string
          referrer_host?: string | null
          session_id: string
          touch_key: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          channel?: string
          company_id?: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_occurred_at?: string
          hits?: number
          id?: string
          landing_path?: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          occurred_at?: string
          referrer_host?: string | null
          session_id?: string
          touch_key?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_touchpoints_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "marketing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          author_id: string | null
          author_name: string | null
          author_role: string | null
          body: string
          created_at: string
          id: string
          internal: boolean
          order_id: string | null
          order_item_id: string | null
          quote_id: string | null
          read_at: string | null
          ticket_id: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          author_id?: string | null
          author_name?: string | null
          author_role?: string | null
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          order_id?: string | null
          order_item_id?: string | null
          quote_id?: string | null
          read_at?: string | null
          ticket_id?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          author_id?: string | null
          author_name?: string | null
          author_role?: string | null
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          order_id?: string | null
          order_item_id?: string | null
          quote_id?: string | null
          read_at?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string | null
          source: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          notification_id: string
          payload: Json
          profile_id: string
          recipient: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id: string
          payload?: Json
          profile_id: string
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id?: string
          payload?: Json
          profile_id?: string
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          event: string
          id: string
          link: string | null
          profile_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          event: string
          id?: string
          link?: string | null
          profile_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          event?: string
          id?: string
          link?: string | null
          profile_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          company_name: string | null
          contact_name: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          estimated_value: number
          id: string
          is_demo: boolean
          lost_reason: string | null
          next_action: string | null
          next_contact_at: string | null
          notes: string | null
          order_id: string | null
          phone: string | null
          position: number
          probability: number
          product_interest: string | null
          quote_id: string | null
          seller_id: string | null
          source: string
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          estimated_value?: number
          id?: string
          is_demo?: boolean
          lost_reason?: string | null
          next_action?: string | null
          next_contact_at?: string | null
          notes?: string | null
          order_id?: string | null
          phone?: string | null
          position?: number
          probability?: number
          product_interest?: string | null
          quote_id?: string | null
          seller_id?: string | null
          source?: string
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          estimated_value?: number
          id?: string
          is_demo?: boolean
          lost_reason?: string | null
          next_action?: string | null
          next_contact_at?: string | null
          notes?: string | null
          order_id?: string | null
          phone?: string | null
          position?: number
          probability?: number
          product_interest?: string | null
          quote_id?: string | null
          seller_id?: string | null
          source?: string
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_activities: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          done: boolean
          done_at: string | null
          due_at: string | null
          id: string
          opportunity_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          done?: boolean
          done_at?: string | null
          due_at?: string | null
          id?: string
          opportunity_id: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          done?: boolean
          done_at?: string | null
          due_at?: string | null
          id?: string
          opportunity_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attributions: {
        Row: {
          attributed_at: string
          channel: string
          company_id: string
          currency: string
          id: string
          is_primary: boolean
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          model: string
          order_id: string
          order_number: string
          revenue: number
          reversal_reason: string | null
          reversed_at: string | null
          settings_version: number
          shipping: number
          source: string
          status: string
          touch_at: string | null
          touchpoint_id: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          window_days: number
        }
        Insert: {
          attributed_at?: string
          channel: string
          company_id: string
          currency?: string
          id?: string
          is_primary: boolean
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          model: string
          order_id: string
          order_number: string
          revenue: number
          reversal_reason?: string | null
          reversed_at?: string | null
          settings_version: number
          shipping?: number
          source?: string
          status?: string
          touch_at?: string | null
          touchpoint_id?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          window_days: number
        }
        Update: {
          attributed_at?: string
          channel?: string
          company_id?: string
          currency?: string
          id?: string
          is_primary?: boolean
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          model?: string
          order_id?: string
          order_number?: string
          revenue?: number
          reversal_reason?: string | null
          reversed_at?: string | null
          settings_version?: number
          shipping?: number
          source?: string
          status?: string
          touch_at?: string | null
          touchpoint_id?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_attributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_touchpoint_id_fkey"
            columns: ["touchpoint_id"]
            isOneToOne: false
            referencedRelation: "marketing_touchpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          art_flow: string | null
          art_status: string
          base_price: number
          created_at: string
          id: string
          notes: string | null
          options: Json
          order_id: string
          price_breakdown: Json
          product_id: string | null
          product_name: string
          product_slug: string | null
          production_days: number
          quantity: number
          sku: string | null
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          art_flow?: string | null
          art_status?: string
          base_price?: number
          created_at?: string
          id?: string
          notes?: string | null
          options?: Json
          order_id: string
          price_breakdown?: Json
          product_id?: string | null
          product_name: string
          product_slug?: string | null
          production_days?: number
          quantity?: number
          sku?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          art_flow?: string | null
          art_status?: string
          base_price?: number
          created_at?: string
          id?: string
          notes?: string | null
          options?: Json
          order_id?: string
          price_breakdown?: Json
          product_id?: string | null
          product_name?: string
          product_slug?: string | null
          production_days?: number
          quantity?: number
          sku?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_templates: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          art_flow: string | null
          billing: Json | null
          coupon_code: string | null
          coupon_discount: number
          created_at: string
          created_by: string | null
          credit_used: number
          customer_id: string | null
          delivered_at: string | null
          discount_total: number
          estimated_delivery: string | null
          id: string
          idempotency_key: string | null
          installments: number
          internal_notes: string | null
          is_demo: boolean
          is_rush: boolean
          notes: string | null
          number: string
          payment_method: string | null
          payment_status: string
          priority: string
          profile_id: string | null
          quote_id: string | null
          reseller_id: string | null
          seller_id: string | null
          shipping_address: Json | null
          shipping_cost: number
          shipping_method: string | null
          source: string
          status: string
          subtotal: number
          sync_origin: string
          total: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          art_flow?: string | null
          billing?: Json | null
          coupon_code?: string | null
          coupon_discount?: number
          created_at?: string
          created_by?: string | null
          credit_used?: number
          customer_id?: string | null
          delivered_at?: string | null
          discount_total?: number
          estimated_delivery?: string | null
          id?: string
          idempotency_key?: string | null
          installments?: number
          internal_notes?: string | null
          is_demo?: boolean
          is_rush?: boolean
          notes?: string | null
          number: string
          payment_method?: string | null
          payment_status?: string
          priority?: string
          profile_id?: string | null
          quote_id?: string | null
          reseller_id?: string | null
          seller_id?: string | null
          shipping_address?: Json | null
          shipping_cost?: number
          shipping_method?: string | null
          source?: string
          status?: string
          subtotal?: number
          sync_origin?: string
          total?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          art_flow?: string | null
          billing?: Json | null
          coupon_code?: string | null
          coupon_discount?: number
          created_at?: string
          created_by?: string | null
          credit_used?: number
          customer_id?: string | null
          delivered_at?: string | null
          discount_total?: number
          estimated_delivery?: string | null
          id?: string
          idempotency_key?: string | null
          installments?: number
          internal_notes?: string | null
          is_demo?: boolean
          is_rush?: boolean
          notes?: string | null
          number?: string
          payment_method?: string | null
          payment_status?: string
          priority?: string
          profile_id?: string | null
          quote_id?: string | null
          reseller_id?: string | null
          seller_id?: string | null
          shipping_address?: Json | null
          shipping_cost?: number
          shipping_method?: string | null
          source?: string
          status?: string
          subtotal?: number
          sync_origin?: string
          total?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_fk"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          active: boolean
          content: string
          created_at: string
          id: string
          position: number
          seo_description: string | null
          seo_title: string | null
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content?: string
          created_at?: string
          id?: string
          position?: number
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          id?: string
          position?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          barcode: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          gateway: string | null
          gateway_payment_id: string | null
          id: string
          idempotency_key: string | null
          installments: number
          method: string
          note: string | null
          order_id: string
          paid_at: string | null
          payment_link: string | null
          qr_code: string | null
          raw: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          barcode?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          gateway?: string | null
          gateway_payment_id?: string | null
          id?: string
          idempotency_key?: string | null
          installments?: number
          method: string
          note?: string | null
          order_id: string
          paid_at?: string | null
          payment_link?: string | null
          qr_code?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          barcode?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          gateway?: string | null
          gateway_payment_id?: string | null
          id?: string
          idempotency_key?: string | null
          installments?: number
          method?: string
          note?: string | null
          order_id?: string
          paid_at?: string | null
          payment_link?: string | null
          qr_code?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          id: string
          resource: string
          role: string
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          resource: string
          role: string
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          resource?: string
          role?: string
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          active: boolean
          category_id: string | null
          client_name: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_demo: boolean
          position: number
          title: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          position?: number
          title: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      price_rules: {
        Row: {
          active: boolean
          adjustment_type: string
          adjustment_value: number
          applies_to: string
          category_id: string | null
          conditions: Json
          created_at: string
          description: string | null
          id: string
          name: string
          priority: number
          product_id: string | null
          scope: string
          stackable: boolean
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          adjustment_type?: string
          adjustment_value?: number
          applies_to?: string
          category_id?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          priority?: number
          product_id?: string | null
          scope?: string
          stackable?: boolean
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          adjustment_type?: string
          adjustment_value?: number
          applies_to?: string
          category_id?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          priority?: number
          product_id?: string | null
          scope?: string
          stackable?: boolean
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tables: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          name: string
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name: string
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          cost_price: number
          notes: string | null
          product_id: string
          supplier_cost: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cost_price?: number
          notes?: string | null
          product_id: string
          supplier_cost?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cost_price?: number
          notes?: string | null
          product_id?: string
          supplier_cost?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_faqs: {
        Row: {
          answer: string
          id: string
          position: number
          product_id: string
          question: string
        }
        Insert: {
          answer: string
          id?: string
          position?: number
          product_id: string
          question: string
        }
        Update: {
          answer?: string
          id?: string
          position?: number
          product_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_faqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_faqs_product_id_fkey"
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
          created_at: string
          id: string
          kind: string
          position: number
          product_id: string
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          kind?: string
          position?: number
          product_id: string
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          kind?: string
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
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
      product_materials: {
        Row: {
          id: string
          product_id: string
          quantity_per_unit: number
          stock_item_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity_per_unit?: number
          stock_item_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity_per_unit?: number
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          help_text: string | null
          id: string
          input_type: string
          key: string
          multiple: boolean
          name: string
          position: number
          product_id: string
          required: boolean
        }
        Insert: {
          help_text?: string | null
          id?: string
          input_type?: string
          key: string
          multiple?: boolean
          name: string
          position?: number
          product_id: string
          required?: boolean
        }
        Update: {
          help_text?: string | null
          id?: string
          input_type?: string
          key?: string
          multiple?: boolean
          name?: string
          position?: number
          product_id?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          active: boolean
          default_selected: boolean
          description: string | null
          group_id: string
          id: string
          image_url: string | null
          label: string
          modifier_type: string
          modifier_value: number
          position: number
          production_days_delta: number
          value: string
        }
        Insert: {
          active?: boolean
          default_selected?: boolean
          description?: string | null
          group_id: string
          id?: string
          image_url?: string | null
          label: string
          modifier_type?: string
          modifier_value?: number
          position?: number
          production_days_delta?: number
          value: string
        }
        Update: {
          active?: boolean
          default_selected?: boolean
          description?: string | null
          group_id?: string
          id?: string
          image_url?: string | null
          label?: string
          modifier_type?: string
          modifier_value?: number
          position?: number
          production_days_delta?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          id: string
          max_qty: number | null
          min_qty: number
          position: number
          product_id: string
          production_days: number | null
          reseller_unit_price: number | null
          unit_price: number
        }
        Insert: {
          id?: string
          max_qty?: number | null
          min_qty: number
          position?: number
          product_id: string
          production_days?: number | null
          reseller_unit_price?: number | null
          unit_price: number
        }
        Update: {
          id?: string
          max_qty?: number | null
          min_qty?: number
          position?: number
          product_id?: string
          production_days?: number | null
          reseller_unit_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          approved: boolean
          author_name: string
          comment: string | null
          created_at: string
          id: string
          is_demo: boolean
          order_id: string | null
          product_id: string
          profile_id: string | null
          rating: number
          replied_at: string | null
          reply: string | null
          service_rating: number | null
          title: string | null
        }
        Insert: {
          approved?: boolean
          author_name: string
          comment?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          order_id?: string | null
          product_id: string
          profile_id?: string | null
          rating: number
          replied_at?: string | null
          reply?: string | null
          service_rating?: number | null
          title?: string | null
        }
        Update: {
          approved?: boolean
          author_name?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          order_id?: string | null
          product_id?: string
          profile_id?: string | null
          rating?: number
          replied_at?: string | null
          reply?: string | null
          service_rating?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_shipping_rules: {
        Row: {
          blocked: boolean
          extra_cost: number
          extra_days: number
          id: string
          method: string
          product_id: string
        }
        Insert: {
          blocked?: boolean
          extra_cost?: number
          extra_days?: number
          id?: string
          method: string
          product_id: string
        }
        Update: {
          blocked?: boolean
          extra_cost?: number
          extra_days?: number
          id?: string
          method?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_shipping_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shipping_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sync_queue: {
        Row: {
          attempts: number
          company_id: string | null
          completed_at: string | null
          created_at: string
          crm_product_id: string
          events: string[]
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          requested_at: string
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          crm_product_id: string
          events?: string[]
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          requested_at?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          crm_product_id?: string
          events?: string[]
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          requested_at?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variant_price_tiers: {
        Row: {
          id: string
          position: number
          production_days: number | null
          quantity: number
          total_price: number
          unit_price: number
          variant_id: string
        }
        Insert: {
          id?: string
          position?: number
          production_days?: number | null
          quantity: number
          total_price: number
          unit_price: number
          variant_id: string
        }
        Update: {
          id?: string
          position?: number
          production_days?: number | null
          quantity?: number
          total_price?: number
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_price_tiers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          available: boolean
          created_at: string
          id: string
          is_default: boolean
          position: number
          product_id: string
          production_days: number | null
          selection: Json
          sku: string | null
          source_external_id: string | null
          source_variant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          position?: number
          product_id: string
          production_days?: number | null
          selection?: Json
          sku?: string | null
          source_external_id?: string | null
          source_variant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          position?: number
          product_id?: string
          production_days?: number | null
          selection?: Json
          sku?: string | null
          source_external_id?: string | null
          source_variant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
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
      production_orders: {
        Row: {
          actual_minutes: number | null
          assigned_section: string | null
          assigned_to: string | null
          checklist: Json
          created_at: string
          due_date: string | null
          estimated_minutes: number
          finished_at: string | null
          finishing: string | null
          id: string
          is_demo: boolean
          material: string | null
          measure: string | null
          notes: string | null
          number: string
          order_id: string
          order_item_id: string | null
          position: number
          priority: string
          product_name: string
          quantity: number
          stage: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          actual_minutes?: number | null
          assigned_section?: string | null
          assigned_to?: string | null
          checklist?: Json
          created_at?: string
          due_date?: string | null
          estimated_minutes?: number
          finished_at?: string | null
          finishing?: string | null
          id?: string
          is_demo?: boolean
          material?: string | null
          measure?: string | null
          notes?: string | null
          number: string
          order_id: string
          order_item_id?: string | null
          position?: number
          priority?: string
          product_name: string
          quantity?: number
          stage?: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          actual_minutes?: number | null
          assigned_section?: string | null
          assigned_to?: string | null
          checklist?: Json
          created_at?: string
          due_date?: string | null
          estimated_minutes?: number
          finished_at?: string | null
          finishing?: string | null
          id?: string
          is_demo?: boolean
          material?: string | null
          measure?: string | null
          notes?: string | null
          number?: string
          order_id?: string
          order_item_id?: string | null
          position?: number
          priority?: string
          product_name?: string
          quantity?: number
          stage?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stage_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_stage: string | null
          id: string
          note: string | null
          production_order_id: string
          to_stage: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          production_order_id: string
          to_stage: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          production_order_id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stage_history_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          allow_reseller: boolean
          applications: string[]
          archived_at: string | null
          art_instructions: string | null
          art_required: boolean
          auto_sync: boolean
          base_price: number
          benefits: string[]
          business_only: boolean
          category_id: string | null
          commission_pct: number
          content_hash: string | null
          created_at: string
          crm_id: string | null
          default_height: number | null
          default_width: number | null
          description: string | null
          digital_delivery: boolean
          dimension_unit: string
          featured: boolean
          id: string
          is_demo: boolean
          is_new: boolean
          last_sync_error: string | null
          materials: string[]
          max_height: number | null
          max_quantity: number | null
          max_width: number | null
          min_height: number | null
          min_quantity: number
          min_width: number | null
          name: string
          on_sale: boolean
          price_unit: string
          production_days: number
          quantity_mode: string
          quantity_step: number
          rating_avg: number
          rating_count: number
          reseller_only: boolean
          reseller_price: number | null
          rush_days: number | null
          rush_fee_pct: number
          sale_price: number | null
          sales_count: number
          seo_description: string | null
          seo_title: string | null
          setup_fee: number
          short_description: string | null
          sku: string
          slug: string
          source_updated_at: string | null
          subcategory_id: string | null
          suggested_price: number | null
          sync_origin: string
          sync_status: string
          sync_version: number
          synced_at: string | null
          tags: string[]
          template_url: string | null
          unpublished_at: string | null
          updated_at: string
          view_count: number
          withdrawn_by: string | null
          withdrawn_reason: string | null
        }
        Insert: {
          active?: boolean
          allow_reseller?: boolean
          applications?: string[]
          archived_at?: string | null
          art_instructions?: string | null
          art_required?: boolean
          auto_sync?: boolean
          base_price?: number
          benefits?: string[]
          business_only?: boolean
          category_id?: string | null
          commission_pct?: number
          content_hash?: string | null
          created_at?: string
          crm_id?: string | null
          default_height?: number | null
          default_width?: number | null
          description?: string | null
          digital_delivery?: boolean
          dimension_unit?: string
          featured?: boolean
          id?: string
          is_demo?: boolean
          is_new?: boolean
          last_sync_error?: string | null
          materials?: string[]
          max_height?: number | null
          max_quantity?: number | null
          max_width?: number | null
          min_height?: number | null
          min_quantity?: number
          min_width?: number | null
          name: string
          on_sale?: boolean
          price_unit?: string
          production_days?: number
          quantity_mode?: string
          quantity_step?: number
          rating_avg?: number
          rating_count?: number
          reseller_only?: boolean
          reseller_price?: number | null
          rush_days?: number | null
          rush_fee_pct?: number
          sale_price?: number | null
          sales_count?: number
          seo_description?: string | null
          seo_title?: string | null
          setup_fee?: number
          short_description?: string | null
          sku: string
          slug: string
          source_updated_at?: string | null
          subcategory_id?: string | null
          suggested_price?: number | null
          sync_origin?: string
          sync_status?: string
          sync_version?: number
          synced_at?: string | null
          tags?: string[]
          template_url?: string | null
          unpublished_at?: string | null
          updated_at?: string
          view_count?: number
          withdrawn_by?: string | null
          withdrawn_reason?: string | null
        }
        Update: {
          active?: boolean
          allow_reseller?: boolean
          applications?: string[]
          archived_at?: string | null
          art_instructions?: string | null
          art_required?: boolean
          auto_sync?: boolean
          base_price?: number
          benefits?: string[]
          business_only?: boolean
          category_id?: string | null
          commission_pct?: number
          content_hash?: string | null
          created_at?: string
          crm_id?: string | null
          default_height?: number | null
          default_width?: number | null
          description?: string | null
          digital_delivery?: boolean
          dimension_unit?: string
          featured?: boolean
          id?: string
          is_demo?: boolean
          is_new?: boolean
          last_sync_error?: string | null
          materials?: string[]
          max_height?: number | null
          max_quantity?: number | null
          max_width?: number | null
          min_height?: number | null
          min_quantity?: number
          min_width?: number | null
          name?: string
          on_sale?: boolean
          price_unit?: string
          production_days?: number
          quantity_mode?: string
          quantity_step?: number
          rating_avg?: number
          rating_count?: number
          reseller_only?: boolean
          reseller_price?: number | null
          rush_days?: number | null
          rush_fee_pct?: number
          sale_price?: number | null
          sales_count?: number
          seo_description?: string | null
          seo_title?: string | null
          setup_fee?: number
          short_description?: string | null
          sku?: string
          slug?: string
          source_updated_at?: string | null
          subcategory_id?: string | null
          suggested_price?: number | null
          sync_origin?: string
          sync_status?: string
          sync_version?: number
          synced_at?: string | null
          tags?: string[]
          template_url?: string | null
          unpublished_at?: string | null
          updated_at?: string
          view_count?: number
          withdrawn_by?: string | null
          withdrawn_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          anonymized_at: string | null
          avatar_url: string | null
          company_name: string | null
          created_at: string
          credit_balance: number
          customer_type: string | null
          document: string | null
          email: string | null
          full_name: string
          id: string
          last_login_at: string | null
          notification_prefs: Json
          phone: string | null
          price_table_id: string | null
          reseller_id: string | null
          role: string
          seller_id: string | null
          state_registration: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          anonymized_at?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          credit_balance?: number
          customer_type?: string | null
          document?: string | null
          email?: string | null
          full_name?: string
          id: string
          last_login_at?: string | null
          notification_prefs?: Json
          phone?: string | null
          price_table_id?: string | null
          reseller_id?: string | null
          role?: string
          seller_id?: string | null
          state_registration?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          anonymized_at?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          credit_balance?: number
          customer_type?: string | null
          document?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          notification_prefs?: Json
          phone?: string | null
          price_table_id?: string | null
          reseller_id?: string | null
          role?: string
          seller_id?: string | null
          state_registration?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_price_table_fk"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          active: boolean
          body: string
          category: string | null
          id: string
          position: number
          title: string
        }
        Insert: {
          active?: boolean
          body: string
          category?: string | null
          id?: string
          position?: number
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          category?: string | null
          id?: string
          position?: number
          title?: string
        }
        Relationships: []
      }
      quote_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          id: string
          note: string | null
          quote_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          id?: string
          note?: string | null
          quote_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          id?: string
          note?: string | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          base_price: number
          description: string
          detail: string | null
          id: string
          internal_cost: number | null
          options: Json
          position: number
          product_id: string | null
          production_days: number | null
          quantity: number
          quote_id: string
          source_origin: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          base_price?: number
          description: string
          detail?: string | null
          id?: string
          internal_cost?: number | null
          options?: Json
          position?: number
          product_id?: string | null
          production_days?: number | null
          quantity?: number
          quote_id: string
          source_origin?: string | null
          total_price?: number
          unit_price?: number
        }
        Update: {
          base_price?: number
          description?: string
          detail?: string | null
          id?: string
          internal_cost?: number | null
          options?: Json
          position?: number
          product_id?: string | null
          production_days?: number | null
          quantity?: number
          quote_id?: string
          source_origin?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
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
        ]
      }
      quotes: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          converted_order_id: string | null
          created_at: string
          created_by: string | null
          crm_id: string | null
          customer_id: string | null
          delivery_days: number | null
          discount_total: number
          discount_type: string | null
          discount_value: number
          hide_cost: boolean
          id: string
          idempotency_key: string | null
          internal_notes: string | null
          is_demo: boolean
          margin_type: string | null
          margin_value: number
          notes: string | null
          number: string
          payment_terms: string | null
          profile_id: string | null
          public_token: string | null
          reseller_id: string | null
          responded_at: string | null
          seller_id: string | null
          shipping_cost: number
          shipping_method: string | null
          source: string
          status: string
          subtotal: number
          sync_origin: string
          title: string | null
          total: number
          updated_at: string
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_id?: string | null
          customer_id?: string | null
          delivery_days?: number | null
          discount_total?: number
          discount_type?: string | null
          discount_value?: number
          hide_cost?: boolean
          id?: string
          idempotency_key?: string | null
          internal_notes?: string | null
          is_demo?: boolean
          margin_type?: string | null
          margin_value?: number
          notes?: string | null
          number: string
          payment_terms?: string | null
          profile_id?: string | null
          public_token?: string | null
          reseller_id?: string | null
          responded_at?: string | null
          seller_id?: string | null
          shipping_cost?: number
          shipping_method?: string | null
          source?: string
          status?: string
          subtotal?: number
          sync_origin?: string
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_id?: string | null
          customer_id?: string | null
          delivery_days?: number | null
          discount_total?: number
          discount_type?: string | null
          discount_value?: number
          hide_cost?: boolean
          id?: string
          idempotency_key?: string | null
          internal_notes?: string | null
          is_demo?: boolean
          margin_type?: string | null
          margin_value?: number
          notes?: string | null
          number?: string
          payment_terms?: string | null
          profile_id?: string | null
          public_token?: string | null
          reseller_id?: string | null
          responded_at?: string | null
          seller_id?: string | null
          shipping_cost?: number
          shipping_method?: string | null
          source?: string
          status?: string
          subtotal?: number
          sync_origin?: string
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_email: string | null
          referred_profile_id: string | null
          referrer_id: string
          reward_amount: number
          rewarded_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_profile_id?: string | null
          referrer_id: string
          reward_amount?: number
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_profile_id?: string | null
          referrer_id?: string
          reward_amount?: number
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_profile_id_fkey"
            columns: ["referred_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      related_products: {
        Row: {
          position: number
          product_id: string
          related_id: string
        }
        Insert: {
          position?: number
          product_id: string
          related_id: string
        }
        Update: {
          position?: number
          product_id?: string
          related_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "related_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_products_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "crm_product_sync_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_products_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_limit_movements: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string
          order_id: string
          profile_id: string
          type: string
          used_after: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key: string
          order_id: string
          profile_id: string
          type: string
          used_after: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          profile_id?: string
          type?: string
          used_after?: number
        }
        Relationships: [
          {
            foreignKeyName: "reseller_limit_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_limit_movements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_profiles: {
        Row: {
          allow_whitelabel: boolean
          approved: boolean
          cashback_balance: number
          commission_pct: number
          company_name: string | null
          created_at: string
          credit_limit: number
          credit_used: number
          default_margin_type: string
          default_margin_value: number
          logo_url: string | null
          monthly_goal: number
          payment_terms: string | null
          profile_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          allow_whitelabel?: boolean
          approved?: boolean
          cashback_balance?: number
          commission_pct?: number
          company_name?: string | null
          created_at?: string
          credit_limit?: number
          credit_used?: number
          default_margin_type?: string
          default_margin_value?: number
          logo_url?: string | null
          monthly_goal?: number
          payment_terms?: string | null
          profile_id: string
          tier?: string
          updated_at?: string
        }
        Update: {
          allow_whitelabel?: boolean
          approved?: boolean
          cashback_balance?: number
          commission_pct?: number
          company_name?: string | null
          created_at?: string
          credit_limit?: number
          credit_used?: number
          default_margin_type?: string
          default_margin_value?: number
          logo_url?: string | null
          monthly_goal?: number
          payment_terms?: string | null
          profile_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          commission_pct: number
          created_at: string
          discount_limit_pct: number
          monthly_goal: number
          profile_id: string
          team: string | null
          updated_at: string
        }
        Insert: {
          commission_pct?: number
          created_at?: string
          discount_limit_pct?: number
          monthly_goal?: number
          profile_id: string
          team?: string | null
          updated_at?: string
        }
        Update: {
          commission_pct?: number
          created_at?: string
          discount_limit_pct?: number
          monthly_goal?: number
          profile_id?: string
          team?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          group_name: string
          key: string
          label: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          group_name?: string
          key: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          group_name?: string
          key?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          cost: number
          created_at: string
          delivered_at: string | null
          estimated_days: number | null
          id: string
          method: string
          notes: string | null
          order_id: string
          received_by: string | null
          shipped_at: string | null
          tracking_code: string | null
          tracking_url: string | null
        }
        Insert: {
          carrier?: string | null
          cost?: number
          created_at?: string
          delivered_at?: string | null
          estimated_days?: number | null
          id?: string
          method: string
          notes?: string | null
          order_id: string
          received_by?: string | null
          shipped_at?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
        }
        Update: {
          carrier?: string | null
          cost?: number
          created_at?: string
          delivered_at?: string | null
          estimated_days?: number | null
          id?: string
          method?: string
          notes?: string | null
          order_id?: string
          received_by?: string | null
          shipped_at?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          active: boolean
          cep_end: string | null
          cep_start: string | null
          created_at: string
          delivery_days: number
          free_above: number | null
          id: string
          method: string
          min_order: number
          name: string
          notes: string | null
          position: number
          price: number
          price_per_kg: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cep_end?: string | null
          cep_start?: string | null
          created_at?: string
          delivery_days?: number
          free_above?: number | null
          id?: string
          method: string
          min_order?: number
          name: string
          notes?: string | null
          position?: number
          price?: number
          price_per_kg?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cep_end?: string | null
          cep_start?: string | null
          created_at?: string
          delivery_days?: number
          free_above?: number | null
          id?: string
          method?: string
          min_order?: number
          name?: string
          notes?: string | null
          position?: number
          price?: number
          price_per_kg?: number
          updated_at?: string
        }
        Relationships: []
      }
      social_product_campaigns: {
        Row: {
          caption: string | null
          completed_at: string | null
          copy: Json | null
          created_at: string
          feed_path: string | null
          id: string
          last_error: string | null
          notification_status: string | null
          notified_at: string | null
          product_id: string
          product_snapshot: Json | null
          status: string
          story_path: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          completed_at?: string | null
          copy?: Json | null
          created_at?: string
          feed_path?: string | null
          id?: string
          last_error?: string | null
          notification_status?: string | null
          notified_at?: string | null
          product_id: string
          product_snapshot?: Json | null
          status?: string
          story_path?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          completed_at?: string | null
          copy?: Json | null
          created_at?: string
          feed_path?: string | null
          id?: string
          last_error?: string | null
          notification_status?: string | null
          notified_at?: string | null
          product_id?: string
          product_snapshot?: Json | null
          status?: string
          story_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          active: boolean
          avg_cost: number
          code: string
          created_at: string
          id: string
          is_demo: boolean
          kind: string
          location: string | null
          min_quantity: number
          name: string
          notes: string | null
          quantity: number
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          avg_cost?: number
          code: string
          created_at?: string
          id?: string
          is_demo?: boolean
          kind?: string
          location?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          quantity?: number
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          avg_cost?: number
          code?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          kind?: string
          location?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          quantity?: number
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          balance_after: number | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string | null
          production_order_id: string | null
          quantity: number
          reference: string | null
          stock_item_id: string
          type: string
          unit_cost: number | null
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          production_order_id?: string | null
          quantity: number
          reference?: string | null
          stock_item_id: string
          type: string
          unit_cost?: number | null
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          production_order_id?: string | null
          quantity?: number
          reference?: string | null
          stock_item_id?: string
          type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          created_at: string
          id: string
          order_id: string
          production_order_id: string
          quantity: number
          resolved_at: string | null
          status: string
          stock_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          production_order_id: string
          quantity: number
          resolved_at?: string | null
          status?: string
          stock_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          production_order_id?: string
          quantity?: number
          resolved_at?: string | null
          status?: string
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          acao: string
          created_at: string
          destino_id: string | null
          direcao: string
          entidade: string
          erro: string | null
          id: string
          origem_id: string | null
          payload: Json | null
          sucesso: boolean
        }
        Insert: {
          acao: string
          created_at?: string
          destino_id?: string | null
          direcao: string
          entidade: string
          erro?: string | null
          id?: string
          origem_id?: string | null
          payload?: Json | null
          sucesso?: boolean
        }
        Update: {
          acao?: string
          created_at?: string
          destino_id?: string | null
          direcao?: string
          entidade?: string
          erro?: string | null
          id?: string
          origem_id?: string | null
          payload?: Json | null
          sucesso?: boolean
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          active: boolean
          author_name: string
          author_role: string | null
          avatar_url: string | null
          company: string | null
          content: string
          created_at: string
          id: string
          is_demo: boolean
          position: number
          rating: number
        }
        Insert: {
          active?: boolean
          author_name: string
          author_role?: string | null
          avatar_url?: string | null
          company?: string | null
          content: string
          created_at?: string
          id?: string
          is_demo?: boolean
          position?: number
          rating?: number
        }
        Update: {
          active?: boolean
          author_name?: string
          author_role?: string | null
          avatar_url?: string | null
          company?: string | null
          content?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          position?: number
          rating?: number
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          customer_id: string | null
          id: string
          number: string
          order_id: string | null
          priority: string
          profile_id: string | null
          rating: number | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          number: string
          order_id?: string | null
          priority?: string
          profile_id?: string | null
          rating?: number | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          number?: string
          order_id?: string | null
          priority?: string
          profile_id?: string | null
          rating?: number | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      crm_product_sync_health: {
        Row: {
          active: boolean | null
          archived_at: string | null
          auto_sync: boolean | null
          content_hash: string | null
          crm_changed: boolean | null
          crm_id: string | null
          crm_updated_at: string | null
          divergence: string | null
          id: string | null
          last_sync_error: string | null
          name: string | null
          orphan: boolean | null
          queue_attempts: number | null
          queue_events: string[] | null
          queue_last_error: string | null
          queue_next_attempt_at: string | null
          queue_status: string | null
          site_changed: boolean | null
          site_hash: string | null
          site_updated_at: string | null
          slug: string | null
          source_updated_at: string | null
          stored_status: string | null
          sync_status: string | null
          sync_version: number | null
          synced_at: string | null
          unpublished_at: string | null
          withdrawn_by: string | null
          withdrawn_reason: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_remove_product: { Args: { p_product_id: string }; Returns: string }
      archive_crm_product: {
        Args: { p_crm_product_id: string; p_reason: string }
        Returns: Json
      }
      attribute_order: { Args: { p_order_id: string }; Returns: undefined }
      auth_role: { Args: never; Returns: string }
      can_access_customer: { Args: { target: string }; Returns: boolean }
      cancel_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      claim_conversion_events: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          event_id: string
          event_name: string
          id: string
          payload: Json
        }[]
      }
      close_cash_session: {
        Args: { p_closing_amount: number; p_notes?: string }
        Returns: Json
      }
      complete_conversion_event: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_events_received?: number
          p_fbtrace_id?: string
          p_http_status: number
          p_id: string
          p_mode: string
        }
        Returns: string
      }
      conversion_session_for: {
        Args: { p_order_id: string; p_quote_id: string }
        Returns: {
          ads_consent: boolean
          client_user_agent: string | null
          company_id: string
          first_seen_at: string
          id: string
          last_seen_at: string
          profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "marketing_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_quote_to_order: { Args: { p_quote_id: string }; Returns: Json }
      correct_order_attribution: {
        Args: { p_order_id: string; p_reason: string; p_touchpoint_id: string }
        Returns: Json
      }
      create_order: {
        Args: { p_idempotency_key: string; p_items: Json; p_order: Json }
        Returns: Json
      }
      create_order_as: {
        Args: {
          p_actor: string
          p_idempotency_key: string
          p_items: Json
          p_order: Json
        }
        Returns: Json
      }
      create_quote: {
        Args: { p_idempotency_key: string; p_items: Json; p_quote: Json }
        Returns: Json
      }
      crm_move_order: {
        Args: { p_column: string; p_order_id: string }
        Returns: Json
      }
      crm_slug: { Args: { value: string }; Returns: string }
      crm_strip_supplier_ref: {
        Args: { p_supplier_sku: string; p_text: string }
        Returns: string
      }
      crm_variant_selection: {
        Args: { p_attrs: Json; p_store_product_id: string }
        Returns: Json
      }
      dispatch_conversion_events: { Args: never; Returns: boolean }
      dispatch_social_product_campaign: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      enqueue_lead_event: { Args: { p_quote_id: string }; Returns: undefined }
      enqueue_product_sync: {
        Args: { p_crm_product_id: string; p_event: string }
        Returns: undefined
      }
      enqueue_purchase_event: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      get_public_quote: { Args: { token: string }; Returns: Json }
      increment_marketing_download: {
        Args: { p_asset_id: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_reseller: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      jsonb_numeric: {
        Args: { key_name: string; value: Json }
        Returns: number
      }
      link_marketing_session: {
        Args: {
          p_session_id: string
          p_subject_id: string
          p_subject_type: string
        }
        Returns: boolean
      }
      marketing_attributed_orders: {
        Args: { p_from: string; p_limit?: number; p_to: string }
        Returns: {
          attributed_at: string
          channel: string
          meta_ad_id: string
          meta_campaign_id: string
          order_id: string
          order_number: string
          order_status: string
          payment_status: string
          revenue: number
          reversal_reason: string
          source: string
          status: string
          touch_at: string
          utm_campaign: string
          utm_content: string
          utm_source: string
        }[]
      }
      marketing_channel: {
        Args: {
          p_fbclid: string
          p_medium: string
          p_meta_ad_id: string
          p_referrer_host: string
          p_source: string
        }
        Returns: string
      }
      marketing_clean: {
        Args: { p_lower?: boolean; p_value: string }
        Returns: string
      }
      marketing_correction_options: {
        Args: { p_order_id: string }
        Returns: {
          channel: string
          meta_ad_id: string
          occurred_at: string
          touchpoint_id: string
          utm_campaign: string
          utm_content: string
          utm_source: string
        }[]
      }
      marketing_overview: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      marketing_signal_status: { Args: never; Returns: Json }
      meta_capi_config: { Args: never; Returns: Json }
      meta_hash: { Args: { p_value: string }; Returns: string }
      meta_phone: { Args: { p_value: string }; Returns: string }
      open_cash_session: { Args: { p_opening_amount?: number }; Returns: Json }
      order_status_rank: { Args: { p_status: string }; Returns: number }
      process_product_sync_queue: { Args: { p_limit?: number }; Returns: Json }
      product_commercial_refs: {
        Args: { p_product_id: string }
        Returns: string[]
      }
      product_content_hash: { Args: { p_product_id: string }; Returns: string }
      product_publish_problems: {
        Args: { p_product_id: string }
        Returns: string[]
      }
      product_sync_backoff: { Args: { p_attempts: number }; Returns: string }
      product_sync_state: {
        Args: { p_product_id: string }
        Returns: {
          crm_changed: boolean
          divergence: string
          orphan: boolean
          site_changed: boolean
          site_hash: string
          status: string
        }[]
      }
      public_tracking_config: { Args: never; Returns: Json }
      publish_crm_product: { Args: { p_crm_product_id: string }; Returns: Json }
      publish_crm_product_apply: {
        Args: { p_crm_product_id: string }
        Returns: Json
      }
      publish_crm_product_internal: {
        Args: { p_crm_product_id: string; p_origin: string }
        Returns: Json
      }
      record_marketing_consent: {
        Args: {
          p_ads_consent: boolean
          p_fbc?: string
          p_fbp?: string
          p_session_id: string
          p_user_agent?: string
        }
        Returns: boolean
      }
      record_marketing_touchpoint: {
        Args: { p_payload: Json; p_session_id: string }
        Returns: string
      }
      remove_product_internal: {
        Args: { p_origin: string; p_product_id: string }
        Returns: string
      }
      request_public_quote: {
        Args: {
          company: string
          deadline: string
          email: string
          message: string
          name: string
          phone: string
          product: string
          quantity: string
          website?: string
        }
        Returns: Json
      }
      respond_public_quote: {
        Args: { decision: string; message?: string; token: string }
        Returns: Json
      }
      review_credit_request: {
        Args: {
          p_approved_limit?: number
          p_decision: string
          p_note?: string
          p_request_id: string
        }
        Returns: Json
      }
      rotulo_status_pedido: { Args: { p_status: string }; Returns: string }
      set_marketing_attribution_settings: {
        Args: { p_primary_model: string; p_window_days: number }
        Returns: Json
      }
      set_marketing_signal_settings: {
        Args: {
          p_enabled: boolean
          p_graph_api_version?: string
          p_mode: string
          p_pixel_id: string
          p_test_event_code?: string
        }
        Returns: Json
      }
      slugify: { Args: { value: string }; Returns: string }
      text_array_to_string: { Args: { value: string[] }; Returns: string }
      unpublish_crm_product: {
        Args: { p_crm_product_id: string; p_reason: string }
        Returns: Json
      }
      upsert_conversion_event: {
        Args: {
          p_company: string
          p_event_id: string
          p_event_time: string
          p_name: string
          p_order: string
          p_payload: Json
          p_quote: string
          p_session: string
          p_skip_reason: string
        }
        Returns: undefined
      }
      withdraw_crm_product: {
        Args: { p_crm_product_id: string; p_mode: string; p_reason: string }
        Returns: Json
      }
      withdraw_crm_product_internal: {
        Args: {
          p_mode: string
          p_origin: string
          p_product_id: string
          p_reason: string
        }
        Returns: Json
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
  store: {
    Enums: {},
  },
} as const

