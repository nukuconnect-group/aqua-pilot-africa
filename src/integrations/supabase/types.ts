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
      accounting_transactions: {
        Row: {
          amount: number
          category: string
          client: string | null
          created_at: string | null
          currency: string | null
          date: string
          description: string | null
          id: string
          payment_method: string | null
          purchase_id: string | null
          reference: string | null
          status: string | null
          supplier: string | null
          type: string
          unit_id: string | null
          unit_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          client?: string | null
          created_at?: string | null
          currency?: string | null
          date: string
          description?: string | null
          id?: string
          payment_method?: string | null
          purchase_id?: string | null
          reference?: string | null
          status?: string | null
          supplier?: string | null
          type: string
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          client?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          purchase_id?: string | null
          reference?: string | null
          status?: string | null
          supplier?: string | null
          type?: string
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_transactions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          module: string
          severity: string
          timestamp: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          module: string
          severity: string
          timestamp?: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          module?: string
          severity?: string
          timestamp?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      ai_analyses: {
        Row: {
          alerte: boolean
          ammonium: number
          conseil: string
          created_at: string
          id: string
          nitrite: number
          oxygene_dissous: number
          ph: number
          temperature: number
          unit_id: string | null
          user_id: string
        }
        Insert: {
          alerte: boolean
          ammonium: number
          conseil: string
          created_at?: string
          id?: string
          nitrite: number
          oxygene_dissous: number
          ph: number
          temperature: number
          unit_id?: string | null
          user_id: string
        }
        Update: {
          alerte?: boolean
          ammonium?: number
          conseil?: string
          created_at?: string
          id?: string
          nitrite?: number
          oxygene_dissous?: number
          ph?: number
          temperature?: number
          unit_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      alert_history: {
        Row: {
          alert_type: string
          created_at: string
          email_error: string | null
          email_sent: boolean
          id: string
          message: string
          stock_details: Json | null
          stock_id: string | null
          user_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          email_error?: string | null
          email_sent?: boolean
          id?: string
          message: string
          stock_details?: Json | null
          stock_id?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          email_error?: string | null
          email_sent?: boolean
          id?: string
          message?: string
          stock_details?: Json | null
          stock_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "feed_stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      anonymous_visits: {
        Row: {
          country: string | null
          country_code: string | null
          created_at: string
          device_info: string | null
          device_type: string | null
          id: string
          ip_hash: string | null
          last_activity_at: string
          page_path: string | null
          referrer: string | null
          session_id: string
          user_agent: string | null
        }
        Insert: {
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          last_activity_at?: string
          page_path?: string | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
        }
        Update: {
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          last_activity_at?: string
          page_path?: string | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      aqua_assistant_conversations: {
        Row: {
          created_at: string
          id: string
          last_category: string | null
          messages: Json
          title: string
          unit_id: string | null
          unit_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_category?: string | null
          messages?: Json
          title?: string
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_category?: string | null
          messages?: Json
          title?: string
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aqua_diagnoses: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          notes: string | null
          other_symptoms: string | null
          results: Json
          risk_level: string | null
          selected_symptoms: string[]
          top_disease_id: string | null
          unit_id: string | null
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          other_symptoms?: string | null
          results?: Json
          risk_level?: string | null
          selected_symptoms?: string[]
          top_disease_id?: string | null
          unit_id?: string | null
          user_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          other_symptoms?: string | null
          results?: Json
          risk_level?: string | null
          selected_symptoms?: string[]
          top_disease_id?: string | null
          unit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqua_diagnoses_top_disease_id_fkey"
            columns: ["top_disease_id"]
            isOneToOne: false
            referencedRelation: "aqua_diseases"
            referencedColumns: ["id"]
          },
        ]
      }
      aqua_diseases: {
        Row: {
          category: string
          causes: string | null
          created_at: string
          description: string | null
          documents: string[] | null
          favoring_factors: string | null
          id: string
          images: string[] | null
          is_active: boolean
          mortality_rate_pct: number | null
          name: string
          prevention: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          category: string
          causes?: string | null
          created_at?: string
          description?: string | null
          documents?: string[] | null
          favoring_factors?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          mortality_rate_pct?: number | null
          name: string
          prevention?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          category?: string
          causes?: string | null
          created_at?: string
          description?: string | null
          documents?: string[] | null
          favoring_factors?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          mortality_rate_pct?: number | null
          name?: string
          prevention?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      cycle_infrastructures: {
        Row: {
          created_at: string | null
          current_quantity: number | null
          cycle_id: string
          id: string
          infrastructure_name: string
          infrastructure_type: string
          livestock_batch_id: string | null
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_quantity?: number | null
          cycle_id: string
          id?: string
          infrastructure_name: string
          infrastructure_type: string
          livestock_batch_id?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_quantity?: number | null
          cycle_id?: string
          id?: string
          infrastructure_name?: string
          infrastructure_type?: string
          livestock_batch_id?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_cycle"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "production_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_livestock_batch"
            columns: ["livestock_batch_id"]
            isOneToOne: false
            referencedRelation: "livestock_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      depreciable_assets: {
        Row: {
          accumulated_depreciation: number | null
          category: string
          created_at: string | null
          currency: string | null
          current_value: number | null
          depreciation_method: string | null
          id: string
          name: string
          purchase_date: string
          purchase_price: number
          status: string | null
          unit_id: string | null
          updated_at: string | null
          useful_life: number | null
          user_id: string
        }
        Insert: {
          accumulated_depreciation?: number | null
          category: string
          created_at?: string | null
          currency?: string | null
          current_value?: number | null
          depreciation_method?: string | null
          id?: string
          name: string
          purchase_date: string
          purchase_price?: number
          status?: string | null
          unit_id?: string | null
          updated_at?: string | null
          useful_life?: number | null
          user_id: string
        }
        Update: {
          accumulated_depreciation?: number | null
          category?: string
          created_at?: string | null
          currency?: string | null
          current_value?: number | null
          depreciation_method?: string | null
          id?: string
          name?: string
          purchase_date?: string
          purchase_price?: number
          status?: string | null
          unit_id?: string | null
          updated_at?: string | null
          useful_life?: number | null
          user_id?: string
        }
        Relationships: []
      }
      disease_symptom_map: {
        Row: {
          disease_id: string
          id: string
          symptom_id: string
          weight: number
        }
        Insert: {
          disease_id: string
          id?: string
          symptom_id: string
          weight?: number
        }
        Update: {
          disease_id?: string
          id?: string
          symptom_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "disease_symptom_map_disease_id_fkey"
            columns: ["disease_id"]
            isOneToOne: false
            referencedRelation: "aqua_diseases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disease_symptom_map_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "disease_symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      disease_symptoms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      disease_treatments: {
        Row: {
          active_ingredient: string | null
          administration: string | null
          created_at: string
          disease_id: string
          dosage: string | null
          duration: string | null
          follow_up: string | null
          id: string
          isolation_required: boolean | null
          name: string
          order_index: number | null
          updated_at: string
          water_actions: string | null
        }
        Insert: {
          active_ingredient?: string | null
          administration?: string | null
          created_at?: string
          disease_id: string
          dosage?: string | null
          duration?: string | null
          follow_up?: string | null
          id?: string
          isolation_required?: boolean | null
          name: string
          order_index?: number | null
          updated_at?: string
          water_actions?: string | null
        }
        Update: {
          active_ingredient?: string | null
          administration?: string | null
          created_at?: string
          disease_id?: string
          dosage?: string | null
          duration?: string | null
          follow_up?: string | null
          id?: string
          isolation_required?: boolean | null
          name?: string
          order_index?: number | null
          updated_at?: string
          water_actions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disease_treatments_disease_id_fkey"
            columns: ["disease_id"]
            isOneToOne: false
            referencedRelation: "aqua_diseases"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          contract_type: string
          created_at: string
          email: string | null
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          phone: string | null
          position: string | null
          salary: number
          status: string
          unit_id: string
          unit_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_type?: string
          created_at?: string
          email?: string | null
          first_name: string
          hire_date?: string | null
          id?: string
          last_name: string
          phone?: string | null
          position?: string | null
          salary?: number
          status?: string
          unit_id: string
          unit_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          email?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          position?: string | null
          salary?: number
          status?: string
          unit_id?: string
          unit_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employment_contracts: {
        Row: {
          benefits: string | null
          clauses: string | null
          contract_type: string
          created_at: string
          currency: string
          document_url: string | null
          employee_id: string
          end_date: string | null
          gross_salary: number
          id: string
          job_title: string | null
          notes: string | null
          notice_period_days: number | null
          reference: string | null
          signed_at: string | null
          signed_by_employee: string | null
          signed_by_employer: string | null
          start_date: string
          status: string
          trial_period_days: number | null
          updated_at: string
          user_id: string
          weekly_hours: number | null
          workplace: string | null
        }
        Insert: {
          benefits?: string | null
          clauses?: string | null
          contract_type: string
          created_at?: string
          currency?: string
          document_url?: string | null
          employee_id: string
          end_date?: string | null
          gross_salary?: number
          id?: string
          job_title?: string | null
          notes?: string | null
          notice_period_days?: number | null
          reference?: string | null
          signed_at?: string | null
          signed_by_employee?: string | null
          signed_by_employer?: string | null
          start_date: string
          status?: string
          trial_period_days?: number | null
          updated_at?: string
          user_id: string
          weekly_hours?: number | null
          workplace?: string | null
        }
        Update: {
          benefits?: string | null
          clauses?: string | null
          contract_type?: string
          created_at?: string
          currency?: string
          document_url?: string | null
          employee_id?: string
          end_date?: string | null
          gross_salary?: number
          id?: string
          job_title?: string | null
          notes?: string | null
          notice_period_days?: number | null
          reference?: string | null
          signed_at?: string | null
          signed_by_employee?: string | null
          signed_by_employer?: string | null
          start_date?: string
          status?: string
          trial_period_days?: number | null
          updated_at?: string
          user_id?: string
          weekly_hours?: number | null
          workplace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_calculations: {
        Row: {
          avg_weight_g: number
          batch_id: string | null
          biomass_kg: number
          calc_mode: string | null
          created_at: string
          cycle_days: number | null
          daily_ration_kg: number
          density_fish_per_m2: number | null
          density_kg_per_m3: number | null
          expected_cost: number | null
          expected_margin: number | null
          expected_revenue: number | null
          fcr: number | null
          feed_price_per_kg: number | null
          feed_rate_pct: number
          fish_count: number
          id: string
          infrastructure_id: string | null
          infrastructure_name: string | null
          infrastructure_type: string | null
          meal_schedule: Json | null
          meals_per_day: number
          notes: string | null
          projected_final_weight_g: number | null
          projected_total_feed_kg: number | null
          ration_per_meal_kg: number
          sale_price_per_kg: number | null
          species_id: string | null
          species_name: string | null
          stage: string | null
          surface_m2: number | null
          unit_id: string | null
          user_id: string
          volume_m3: number | null
          water_temp: number | null
        }
        Insert: {
          avg_weight_g: number
          batch_id?: string | null
          biomass_kg: number
          calc_mode?: string | null
          created_at?: string
          cycle_days?: number | null
          daily_ration_kg: number
          density_fish_per_m2?: number | null
          density_kg_per_m3?: number | null
          expected_cost?: number | null
          expected_margin?: number | null
          expected_revenue?: number | null
          fcr?: number | null
          feed_price_per_kg?: number | null
          feed_rate_pct: number
          fish_count: number
          id?: string
          infrastructure_id?: string | null
          infrastructure_name?: string | null
          infrastructure_type?: string | null
          meal_schedule?: Json | null
          meals_per_day: number
          notes?: string | null
          projected_final_weight_g?: number | null
          projected_total_feed_kg?: number | null
          ration_per_meal_kg: number
          sale_price_per_kg?: number | null
          species_id?: string | null
          species_name?: string | null
          stage?: string | null
          surface_m2?: number | null
          unit_id?: string | null
          user_id: string
          volume_m3?: number | null
          water_temp?: number | null
        }
        Update: {
          avg_weight_g?: number
          batch_id?: string | null
          biomass_kg?: number
          calc_mode?: string | null
          created_at?: string
          cycle_days?: number | null
          daily_ration_kg?: number
          density_fish_per_m2?: number | null
          density_kg_per_m3?: number | null
          expected_cost?: number | null
          expected_margin?: number | null
          expected_revenue?: number | null
          fcr?: number | null
          feed_price_per_kg?: number | null
          feed_rate_pct?: number
          fish_count?: number
          id?: string
          infrastructure_id?: string | null
          infrastructure_name?: string | null
          infrastructure_type?: string | null
          meal_schedule?: Json | null
          meals_per_day?: number
          notes?: string | null
          projected_final_weight_g?: number | null
          projected_total_feed_kg?: number | null
          ration_per_meal_kg?: number
          sale_price_per_kg?: number | null
          species_id?: string | null
          species_name?: string | null
          stage?: string | null
          surface_m2?: number | null
          unit_id?: string | null
          user_id?: string
          volume_m3?: number | null
          water_temp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_calculations_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "fish_species"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_stocks: {
        Row: {
          bag_count: number | null
          cost: number | null
          created_at: string | null
          custom_name: string | null
          expiration_date: string | null
          fat_content: number | null
          feed_type: string
          id: string
          kg_per_bag: number | null
          min_threshold: number | null
          notes: string | null
          protein_content: number | null
          quantity: number
          supplier: string | null
          unit: string
          unit_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bag_count?: number | null
          cost?: number | null
          created_at?: string | null
          custom_name?: string | null
          expiration_date?: string | null
          fat_content?: number | null
          feed_type: string
          id?: string
          kg_per_bag?: number | null
          min_threshold?: number | null
          notes?: string | null
          protein_content?: number | null
          quantity?: number
          supplier?: string | null
          unit?: string
          unit_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bag_count?: number | null
          cost?: number | null
          created_at?: string | null
          custom_name?: string | null
          expiration_date?: string | null
          fat_content?: number | null
          feed_type?: string
          id?: string
          kg_per_bag?: number | null
          min_threshold?: number | null
          notes?: string | null
          protein_content?: number | null
          quantity?: number
          supplier?: string | null
          unit?: string
          unit_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feeding_plans: {
        Row: {
          created_at: string | null
          cycle_id: string | null
          days: string[]
          feed_type: string
          id: string
          infrastructure_id: string | null
          is_active: boolean
          notes: string | null
          quantity: number
          time: string
          unit: string
          unit_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cycle_id?: string | null
          days?: string[]
          feed_type: string
          id?: string
          infrastructure_id?: string | null
          is_active?: boolean
          notes?: string | null
          quantity: number
          time: string
          unit?: string
          unit_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          cycle_id?: string | null
          days?: string[]
          feed_type?: string
          id?: string
          infrastructure_id?: string | null
          is_active?: boolean
          notes?: string | null
          quantity?: number
          time?: string
          unit?: string
          unit_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_plans_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "production_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_plans_infrastructure_id_fkey"
            columns: ["infrastructure_id"]
            isOneToOne: false
            referencedRelation: "cycle_infrastructures"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_records: {
        Row: {
          actual_quantity: number | null
          behavior: string | null
          created_at: string | null
          cycle_id: string | null
          date: string
          fcr: number | null
          feed_type: string | null
          feeder_name: string | null
          id: string
          infrastructure_id: string | null
          mortality: number | null
          notes: string | null
          prescribed_quantity: number | null
          quantity: number
          remaining_quantity: number | null
          session_type: string | null
          temperature: number | null
          time: string | null
          unit_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_quantity?: number | null
          behavior?: string | null
          created_at?: string | null
          cycle_id?: string | null
          date: string
          fcr?: number | null
          feed_type?: string | null
          feeder_name?: string | null
          id?: string
          infrastructure_id?: string | null
          mortality?: number | null
          notes?: string | null
          prescribed_quantity?: number | null
          quantity: number
          remaining_quantity?: number | null
          session_type?: string | null
          temperature?: number | null
          time?: string | null
          unit_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_quantity?: number | null
          behavior?: string | null
          created_at?: string | null
          cycle_id?: string | null
          date?: string
          fcr?: number | null
          feed_type?: string | null
          feeder_name?: string | null
          id?: string
          infrastructure_id?: string | null
          mortality?: number | null
          notes?: string | null
          prescribed_quantity?: number | null
          quantity?: number
          remaining_quantity?: number | null
          session_type?: string | null
          temperature?: number | null
          time?: string | null
          unit_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_records_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "production_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_records_infrastructure_id_fkey"
            columns: ["infrastructure_id"]
            isOneToOne: false
            referencedRelation: "cycle_infrastructures"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_rules: {
        Row: {
          created_at: string
          feed_rate_pct: number
          id: string
          meals_per_day: number
          notes: string | null
          optimal_temp_max: number | null
          optimal_temp_min: number | null
          species_id: string
          stage: string
          updated_at: string
          weight_max_g: number
          weight_min_g: number
        }
        Insert: {
          created_at?: string
          feed_rate_pct: number
          id?: string
          meals_per_day?: number
          notes?: string | null
          optimal_temp_max?: number | null
          optimal_temp_min?: number | null
          species_id: string
          stage: string
          updated_at?: string
          weight_max_g: number
          weight_min_g: number
        }
        Update: {
          created_at?: string
          feed_rate_pct?: number
          id?: string
          meals_per_day?: number
          notes?: string | null
          optimal_temp_max?: number | null
          optimal_temp_min?: number | null
          species_id?: string
          stage?: string
          updated_at?: string
          weight_max_g?: number
          weight_min_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "feeding_rules_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "fish_species"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_sheets: {
        Row: {
          created_at: string
          cycle_id: string | null
          days: string[]
          end_date: string | null
          feed_type: string
          frequency: string
          id: string
          infrastructure_id: string | null
          is_active: boolean
          observations: string | null
          period: string
          quantity: number
          responsible_name: string | null
          start_date: string
          time: string
          title: string
          unit: string
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          days?: string[]
          end_date?: string | null
          feed_type: string
          frequency?: string
          id?: string
          infrastructure_id?: string | null
          is_active?: boolean
          observations?: string | null
          period?: string
          quantity?: number
          responsible_name?: string | null
          start_date?: string
          time: string
          title: string
          unit?: string
          unit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          days?: string[]
          end_date?: string | null
          feed_type?: string
          frequency?: string
          id?: string
          infrastructure_id?: string | null
          is_active?: boolean
          observations?: string | null
          period?: string
          quantity?: number
          responsible_name?: string | null
          start_date?: string
          time?: string
          title?: string
          unit?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fish_species: {
        Row: {
          created_at: string
          default_cycle_days: number | null
          default_fcr: number | null
          default_growth_rate: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          scientific_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_cycle_days?: number | null
          default_fcr?: number | null
          default_growth_rate?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          scientific_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_cycle_days?: number | null
          default_fcr?: number | null
          default_growth_rate?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          scientific_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      health_records: {
        Row: {
          average_weight: number | null
          basin_id: string | null
          created_at: string | null
          cycle_id: string | null
          date: string
          density: number | null
          feeding: number | null
          id: string
          mortality: number | null
          notes: string | null
          oxygen: number | null
          ph: number | null
          sample_count: number | null
          temperature: number | null
          unit_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          average_weight?: number | null
          basin_id?: string | null
          created_at?: string | null
          cycle_id?: string | null
          date: string
          density?: number | null
          feeding?: number | null
          id?: string
          mortality?: number | null
          notes?: string | null
          oxygen?: number | null
          ph?: number | null
          sample_count?: number | null
          temperature?: number | null
          unit_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          average_weight?: number | null
          basin_id?: string | null
          created_at?: string | null
          cycle_id?: string | null
          date?: string
          density?: number | null
          feeding?: number | null
          id?: string
          mortality?: number | null
          notes?: string | null
          oxygen?: number | null
          ph?: number | null
          sample_count?: number | null
          temperature?: number | null
          unit_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "production_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      livestock_batches: {
        Row: {
          acquisition_date: string | null
          average_weight: number | null
          created_at: string | null
          current_age: number | null
          expected_harvest_date: string | null
          expected_survival_rate: number | null
          feeding_plan: string | null
          female_count: number | null
          female_weight: number | null
          id: string
          last_health_check: string | null
          male_count: number | null
          male_weight: number | null
          notes: string | null
          quantity: number
          source: string | null
          species: string
          status: string
          total_weight: number | null
          type: string | null
          unit_id: string
          unit_name: string
          updated_at: string | null
          user_id: string
          variety: string | null
        }
        Insert: {
          acquisition_date?: string | null
          average_weight?: number | null
          created_at?: string | null
          current_age?: number | null
          expected_harvest_date?: string | null
          expected_survival_rate?: number | null
          feeding_plan?: string | null
          female_count?: number | null
          female_weight?: number | null
          id?: string
          last_health_check?: string | null
          male_count?: number | null
          male_weight?: number | null
          notes?: string | null
          quantity?: number
          source?: string | null
          species: string
          status?: string
          total_weight?: number | null
          type?: string | null
          unit_id: string
          unit_name: string
          updated_at?: string | null
          user_id: string
          variety?: string | null
        }
        Update: {
          acquisition_date?: string | null
          average_weight?: number | null
          created_at?: string | null
          current_age?: number | null
          expected_harvest_date?: string | null
          expected_survival_rate?: number | null
          feeding_plan?: string | null
          female_count?: number | null
          female_weight?: number | null
          id?: string
          last_health_check?: string | null
          male_count?: number | null
          male_weight?: number | null
          notes?: string | null
          quantity?: number
          source?: string | null
          species?: string
          status?: string
          total_weight?: number | null
          type?: string | null
          unit_id?: string
          unit_name?: string
          updated_at?: string | null
          user_id?: string
          variety?: string | null
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          is_used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_critical: boolean
          is_read: boolean
          message: string
          metadata: Json | null
          module: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_critical?: boolean
          is_read?: boolean
          message: string
          metadata?: Json | null
          module: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_critical?: boolean
          is_read?: boolean
          message?: string
          metadata?: Json | null
          module?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pay_slips: {
        Row: {
          base_salary: number
          bonuses: number
          created_at: string
          deductions: number
          employee_id: string
          employee_name: string
          generated_at: string
          id: string
          net_salary: number
          overtime: number
          period: string
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_salary?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          employee_id: string
          employee_name: string
          generated_at?: string
          id?: string
          net_salary?: number
          overtime?: number
          period: string
          unit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_salary?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          employee_name?: string
          generated_at?: string
          id?: string
          net_salary?: number
          overtime?: number
          period?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_slips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_alert_thresholds: {
        Row: {
          created_at: string | null
          email_notifications: boolean | null
          fcr_critical_threshold: number | null
          fcr_enabled: boolean | null
          fcr_warning_threshold: number | null
          id: string
          mortality_daily_critical: number | null
          mortality_daily_warning: number | null
          mortality_enabled: boolean | null
          oxygen_critical: number | null
          oxygen_enabled: boolean | null
          oxygen_warning: number | null
          ph_enabled: boolean | null
          ph_max_critical: number | null
          ph_max_warning: number | null
          ph_min_critical: number | null
          ph_min_warning: number | null
          production_behind_critical: number | null
          production_behind_warning: number | null
          production_enabled: boolean | null
          push_notifications: boolean | null
          stock_days_critical: number | null
          stock_days_warning: number | null
          stock_enabled: boolean | null
          temp_enabled: boolean | null
          temp_max_critical: number | null
          temp_max_warning: number | null
          temp_min_critical: number | null
          temp_min_warning: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_notifications?: boolean | null
          fcr_critical_threshold?: number | null
          fcr_enabled?: boolean | null
          fcr_warning_threshold?: number | null
          id?: string
          mortality_daily_critical?: number | null
          mortality_daily_warning?: number | null
          mortality_enabled?: boolean | null
          oxygen_critical?: number | null
          oxygen_enabled?: boolean | null
          oxygen_warning?: number | null
          ph_enabled?: boolean | null
          ph_max_critical?: number | null
          ph_max_warning?: number | null
          ph_min_critical?: number | null
          ph_min_warning?: number | null
          production_behind_critical?: number | null
          production_behind_warning?: number | null
          production_enabled?: boolean | null
          push_notifications?: boolean | null
          stock_days_critical?: number | null
          stock_days_warning?: number | null
          stock_enabled?: boolean | null
          temp_enabled?: boolean | null
          temp_max_critical?: number | null
          temp_max_warning?: number | null
          temp_min_critical?: number | null
          temp_min_warning?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_notifications?: boolean | null
          fcr_critical_threshold?: number | null
          fcr_enabled?: boolean | null
          fcr_warning_threshold?: number | null
          id?: string
          mortality_daily_critical?: number | null
          mortality_daily_warning?: number | null
          mortality_enabled?: boolean | null
          oxygen_critical?: number | null
          oxygen_enabled?: boolean | null
          oxygen_warning?: number | null
          ph_enabled?: boolean | null
          ph_max_critical?: number | null
          ph_max_warning?: number | null
          ph_min_critical?: number | null
          ph_min_warning?: number | null
          production_behind_critical?: number | null
          production_behind_warning?: number | null
          production_enabled?: boolean | null
          push_notifications?: boolean | null
          stock_days_critical?: number | null
          stock_days_warning?: number | null
          stock_enabled?: boolean | null
          temp_enabled?: boolean | null
          temp_max_critical?: number | null
          temp_max_warning?: number | null
          temp_min_critical?: number | null
          temp_min_warning?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      performance_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          cycle_id: string | null
          cycle_name: string | null
          id: string
          is_acknowledged: boolean | null
          message: string
          metadata: Json | null
          metric_name: string | null
          metric_value: number | null
          severity: string
          threshold_value: number | null
          title: string
          unit_id: string | null
          unit_name: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          cycle_id?: string | null
          cycle_name?: string | null
          id?: string
          is_acknowledged?: boolean | null
          message: string
          metadata?: Json | null
          metric_name?: string | null
          metric_value?: number | null
          severity?: string
          threshold_value?: number | null
          title: string
          unit_id?: string | null
          unit_name?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          cycle_id?: string | null
          cycle_name?: string | null
          id?: string
          is_acknowledged?: boolean | null
          message?: string
          metadata?: Json | null
          metric_name?: string | null
          metric_value?: number | null
          severity?: string
          threshold_value?: number | null
          title?: string
          unit_id?: string | null
          unit_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      planned_tasks: {
        Row: {
          alert_sent: boolean | null
          assigned_to: string | null
          created_at: string | null
          description: string | null
          due_date: string
          due_time: string
          id: string
          priority: string
          source: string | null
          source_id: string | null
          status: string
          title: string
          type: string
          unit_id: string | null
          unit_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_sent?: boolean | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          due_time: string
          id?: string
          priority?: string
          source?: string | null
          source_id?: string | null
          status?: string
          title: string
          type?: string
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_sent?: boolean | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          due_time?: string
          id?: string
          priority?: string
          source?: string | null
          source_id?: string | null
          status?: string
          title?: string
          type?: string
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      premium_library_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          external_url: string | null
          file_path: string | null
          id: string
          is_published: boolean
          item_type: string
          plan_min: string
          size_bytes: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          external_url?: string | null
          file_path?: string | null
          id?: string
          is_published?: boolean
          item_type: string
          plan_min?: string
          size_bytes?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          external_url?: string | null
          file_path?: string | null
          id?: string
          is_published?: boolean
          item_type?: string
          plan_min?: string
          size_bytes?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      premium_library_views: {
        Row: {
          id: string
          item_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          item_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_library_views_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "premium_library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      production_cycles: {
        Row: {
          created_at: string | null
          current_quantity: number
          duration_months: number | null
          end_date: string | null
          fingerlings_count: number | null
          id: string
          initial_quantity: number | null
          name: string
          notes: string | null
          species: string | null
          start_date: string
          status: string
          stocking_date: string | null
          target_quantity: number
          unit_id: string
          unit_name: string
          unit_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_quantity?: number
          duration_months?: number | null
          end_date?: string | null
          fingerlings_count?: number | null
          id?: string
          initial_quantity?: number | null
          name: string
          notes?: string | null
          species?: string | null
          start_date: string
          status?: string
          stocking_date?: string | null
          target_quantity: number
          unit_id: string
          unit_name: string
          unit_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_quantity?: number
          duration_months?: number | null
          end_date?: string | null
          fingerlings_count?: number | null
          id?: string
          initial_quantity?: number | null
          name?: string
          notes?: string | null
          species?: string | null
          start_date?: string
          status?: string
          stocking_date?: string | null
          target_quantity?: number
          unit_id?: string
          unit_name?: string
          unit_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      production_units: {
        Row: {
          capacity: number
          created_at: string
          current_stock: number
          description: string | null
          id: string
          is_active: boolean
          manager: string | null
          name: string
          photo_url: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean
          manager?: string | null
          name: string
          photo_url?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean
          manager?: string | null
          name?: string
          photo_url?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_address: string | null
          company_cif_nif: string | null
          company_email: string | null
          company_legal_representative: string | null
          company_logo_url: string | null
          company_name: string | null
          company_phone: string | null
          company_rccm: string | null
          company_registration_number: string | null
          company_signature_url: string | null
          company_stamp_url: string | null
          company_tax_id: string | null
          company_website: string | null
          country: string | null
          country_code: string | null
          created_at: string
          email: string
          exploitation_type: string | null
          full_name: string | null
          id: string
          is_activated: boolean
          is_suspended: boolean | null
          needs_sensors: boolean
          phone: string | null
          production_units: string[] | null
          sensors_banner_dismissed_at: string | null
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_address?: string | null
          company_cif_nif?: string | null
          company_email?: string | null
          company_legal_representative?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_rccm?: string | null
          company_registration_number?: string | null
          company_signature_url?: string | null
          company_stamp_url?: string | null
          company_tax_id?: string | null
          company_website?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          email: string
          exploitation_type?: string | null
          full_name?: string | null
          id: string
          is_activated?: boolean
          is_suspended?: boolean | null
          needs_sensors?: boolean
          phone?: string | null
          production_units?: string[] | null
          sensors_banner_dismissed_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_address?: string | null
          company_cif_nif?: string | null
          company_email?: string | null
          company_legal_representative?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_rccm?: string | null
          company_registration_number?: string | null
          company_signature_url?: string | null
          company_stamp_url?: string | null
          company_tax_id?: string | null
          company_website?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          email?: string
          exploitation_type?: string | null
          full_name?: string | null
          id?: string
          is_activated?: boolean
          is_suspended?: boolean | null
          needs_sensors?: boolean
          phone?: string | null
          production_units?: string[] | null
          sensors_banner_dismissed_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          currency: string | null
          date: string
          delivery_date: string | null
          description: string | null
          due_date: string | null
          id: string
          is_credit: boolean | null
          notes: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_terms: string | null
          quantity: number | null
          reference: string | null
          status: string | null
          subcategory: string | null
          supplier: string | null
          unit: string | null
          unit_id: string | null
          unit_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string | null
          currency?: string | null
          date: string
          delivery_date?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_credit?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_terms?: string | null
          quantity?: number | null
          reference?: string | null
          status?: string | null
          subcategory?: string | null
          supplier?: string | null
          unit?: string | null
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          currency?: string | null
          date?: string
          delivery_date?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_credit?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_terms?: string | null
          quantity?: number | null
          reference?: string | null
          status?: string | null
          subcategory?: string | null
          supplier?: string | null
          unit?: string | null
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pwa_installs: {
        Row: {
          country: string | null
          country_code: string | null
          created_at: string
          device_info: string | null
          device_type: string | null
          id: string
          session_id: string
          user_agent: string | null
        }
        Insert: {
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          session_id: string
          user_agent?: string | null
        }
        Update: {
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      reproduction_records: {
        Row: {
          broodstock_batch_id: string | null
          broodstock_female_count: number | null
          broodstock_male_count: number | null
          created_at: string | null
          egg_count: number | null
          fertilization_rate: number | null
          fry_count: number | null
          hatching_date: string | null
          hatching_rate: number | null
          hormone_dose: number | null
          hormone_used: string | null
          id: string
          incubation_start_date: string | null
          incubation_temperature: number | null
          larvae_count: number | null
          larvae_transfer_date: string | null
          notes: string | null
          reproduction_date: string
          reproduction_method: string
          spawning_date: string | null
          spawning_rate: number | null
          species: string
          status: string
          survival_rate: number | null
          unit_id: string
          unit_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          broodstock_batch_id?: string | null
          broodstock_female_count?: number | null
          broodstock_male_count?: number | null
          created_at?: string | null
          egg_count?: number | null
          fertilization_rate?: number | null
          fry_count?: number | null
          hatching_date?: string | null
          hatching_rate?: number | null
          hormone_dose?: number | null
          hormone_used?: string | null
          id?: string
          incubation_start_date?: string | null
          incubation_temperature?: number | null
          larvae_count?: number | null
          larvae_transfer_date?: string | null
          notes?: string | null
          reproduction_date: string
          reproduction_method?: string
          spawning_date?: string | null
          spawning_rate?: number | null
          species: string
          status?: string
          survival_rate?: number | null
          unit_id: string
          unit_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          broodstock_batch_id?: string | null
          broodstock_female_count?: number | null
          broodstock_male_count?: number | null
          created_at?: string | null
          egg_count?: number | null
          fertilization_rate?: number | null
          fry_count?: number | null
          hatching_date?: string | null
          hatching_rate?: number | null
          hormone_dose?: number | null
          hormone_used?: string | null
          id?: string
          incubation_start_date?: string | null
          incubation_temperature?: number | null
          larvae_count?: number | null
          larvae_transfer_date?: string | null
          notes?: string | null
          reproduction_date?: string
          reproduction_method?: string
          spawning_date?: string | null
          spawning_rate?: number | null
          species?: string
          status?: string
          survival_rate?: number | null
          unit_id?: string
          unit_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reproduction_records_broodstock_batch_id_fkey"
            columns: ["broodstock_batch_id"]
            isOneToOne: false
            referencedRelation: "livestock_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          name: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quantity?: number
          sale_id: string
          total?: number
          unit_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_contact: string | null
          client_name: string
          client_request_id: string | null
          created_at: string
          date: string
          document_number: string | null
          document_type: string
          due_date: string | null
          id: string
          is_credit: boolean | null
          notes: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_terms: string | null
          status: string
          tax_rate: number
          total_amount: number
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_contact?: string | null
          client_name: string
          client_request_id?: string | null
          created_at?: string
          date?: string
          document_number?: string | null
          document_type?: string
          due_date?: string | null
          id?: string
          is_credit?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_terms?: string | null
          status?: string
          tax_rate?: number
          total_amount?: number
          unit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_contact?: string | null
          client_name?: string
          client_request_id?: string | null
          created_at?: string
          date?: string
          document_number?: string | null
          document_type?: string
          due_date?: string | null
          id?: string
          is_credit?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_terms?: string | null
          status?: string
          tax_rate?: number
          total_amount?: number
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_findings: {
        Row: {
          created_at: string
          description: string | null
          detected_at: string
          id: string
          internal_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          scanner_name: string
          severity: string
          source: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          detected_at?: string
          id?: string
          internal_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scanner_name?: string
          severity?: string
          source?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          detected_at?: string
          id?: string
          internal_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scanner_name?: string
          severity?: string
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          end_date: string
          id: string
          notes: string | null
          plan: string
          price: number | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          end_date: string
          id?: string
          notes?: string | null
          plan?: string
          price?: number | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          plan?: string
          price?: number | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_orders: {
        Row: {
          amount: number
          created_at: string
          date: string
          delivery_date: string | null
          id: string
          products: string
          quantity: number
          status: string
          supplier_id: string
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          delivery_date?: string | null
          id?: string
          products?: string
          quantity?: number
          status?: string
          supplier_id: string
          unit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          delivery_date?: string | null
          id?: string
          products?: string
          quantity?: number
          status?: string
          supplier_id?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          category: string
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          products: string[]
          rating: number
          status: string
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          category?: string
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          products?: string[]
          rating?: number
          status?: string
          unit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          category?: string
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          products?: string[]
          rating?: number
          status?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          sender_id: string
          sender_name: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          sender_id: string
          sender_name: string
          sender_type?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          sender_id?: string
          sender_name?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          category: string
          created_at: string
          id: string
          message: string
          priority: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          admin_response?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          admin_response?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      team_member_units: {
        Row: {
          created_at: string
          id: string
          permissions: Json
          team_member_id: string
          unit_id: string
          unit_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          permissions?: Json
          team_member_id: string
          unit_id: string
          unit_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          permissions?: Json
          team_member_id?: string
          unit_id?: string
          unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_units_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          custom_role: string | null
          dashboard_roles: string[] | null
          department: string | null
          id: string
          invited_at: string
          member_email: string
          member_name: string
          owner_id: string
          permissions: Json
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          custom_role?: string | null
          dashboard_roles?: string[] | null
          department?: string | null
          id?: string
          invited_at?: string
          member_email: string
          member_name: string
          owner_id: string
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          custom_role?: string | null
          dashboard_roles?: string[] | null
          department?: string | null
          id?: string
          invited_at?: string
          member_email?: string
          member_name?: string
          owner_id?: string
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      unit_equipment: {
        Row: {
          created_at: string | null
          current_value: number | null
          depreciation_rate: number | null
          id: string
          name: string
          purchase_date: string | null
          purchase_price: number | null
          specifications: Json | null
          status: string | null
          type: string
          unit_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          depreciation_rate?: number | null
          id?: string
          name: string
          purchase_date?: string | null
          purchase_price?: number | null
          specifications?: Json | null
          status?: string | null
          type: string
          unit_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          depreciation_rate?: number | null
          id?: string
          name?: string
          purchase_date?: string | null
          purchase_price?: number | null
          specifications?: Json | null
          status?: string | null
          type?: string
          unit_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      unit_infrastructures: {
        Row: {
          capacity: number | null
          created_at: string | null
          custom_type_name: string | null
          id: string
          last_maintenance_date: string | null
          maintenance_frequency_days: number | null
          maintenance_notes: string | null
          name: string
          next_maintenance_date: string | null
          specifications: Json | null
          status: string | null
          type: string
          unit_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          custom_type_name?: string | null
          id?: string
          last_maintenance_date?: string | null
          maintenance_frequency_days?: number | null
          maintenance_notes?: string | null
          name: string
          next_maintenance_date?: string | null
          specifications?: Json | null
          status?: string | null
          type: string
          unit_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          custom_type_name?: string | null
          id?: string
          last_maintenance_date?: string | null
          maintenance_frequency_days?: number | null
          maintenance_notes?: string | null
          name?: string
          next_maintenance_date?: string | null
          specifications?: Json | null
          status?: string | null
          type?: string
          unit_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_files: {
        Row: {
          compressed_size: number | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          metadata: Json | null
          module: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          compressed_size?: number | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          metadata?: Json | null
          module: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          compressed_size?: number | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          metadata?: Json | null
          module?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          country: string | null
          country_code: string | null
          created_at: string
          device_info: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity_at: string
          login_at: string
          logout_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity_at?: string
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity_at?: string
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_sale_idempotent: {
        Args: {
          _client_contact: string
          _client_name: string
          _client_request_id: string
          _date: string
          _document_number: string
          _document_type: string
          _due_date: string
          _is_credit: boolean
          _items: Json
          _notes: string
          _paid_amount: number
          _payment_method: string
          _payment_terms: string
          _status: string
          _tax_rate: number
          _total_amount: number
          _unit_id: string
        }
        Returns: {
          client_contact: string
          client_name: string
          created_at: string
          date: string
          document_number: string
          document_type: string
          due_date: string
          id: string
          is_credit: boolean
          notes: string
          paid_amount: number
          payment_method: string
          payment_terms: string
          sale_items: Json
          status: string
          tax_rate: number
          total_amount: number
          unit_id: string
          updated_at: string
          user_id: string
        }[]
      }
      expire_outdated_subscriptions: {
        Args: never
        Returns: {
          expired_count: number
        }[]
      }
      extend_subscription: {
        Args: { _days: number; _subscription_id: string }
        Returns: undefined
      }
      get_current_subscription: {
        Args: { _user_id: string }
        Returns: {
          days_remaining: number
          end_date: string
          id: string
          plan: string
          start_date: string
          status: string
        }[]
      }
      get_team_member_owner_by_user_id: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_team_member_owner_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_team_member: { Args: { user_uuid: string }; Returns: boolean }
      is_team_member_of: { Args: { owner_user_id: string }; Returns: boolean }
      team_member_has_unit_access: {
        Args: { _owner_id: string; _unit_id: string }
        Returns: boolean
      }
      user_meets_plan: {
        Args: { _plan_min: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
