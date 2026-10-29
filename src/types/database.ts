export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          branch_code: string;
          database_actor: string;
          id: string;
          new_values: Json | null;
          occurred_at: string;
          old_values: Json | null;
          record_id: string;
          table_name: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          branch_code: string;
          database_actor: string;
          id?: string;
          new_values?: Json | null;
          occurred_at?: string;
          old_values?: Json | null;
          record_id: string;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          branch_code?: string;
          database_actor?: string;
          id?: string;
          new_values?: Json | null;
          occurred_at?: string;
          old_values?: Json | null;
          record_id?: string;
          table_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
        ];
      };
      branches: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          is_active: boolean;
          name: string;
          region: string | null;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          is_active?: boolean;
          name: string;
          region?: string | null;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          is_active?: boolean;
          name?: string;
          region?: string | null;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      calibrations: {
        Row: {
          branch_code: string;
          calculated_due_date: string | null;
          calculation_base: string | null;
          calibration_date: string | null;
          certificate_number: string | null;
          created_at: string;
          created_by: string | null;
          date_basis: string | null;
          date_source: string | null;
          due_date: string | null;
          equipment_id: string;
          id: string;
          interval_months: number | null;
          is_active: boolean;
          issue_date: string | null;
          laboratory: string | null;
          notes: string | null;
          reported_due_date: string | null;
          resolution_note: string | null;
          result: string | null;
          source_import_row_id: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          branch_code?: string;
          calculated_due_date?: string | null;
          calculation_base?: string | null;
          calibration_date?: string | null;
          certificate_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          date_basis?: string | null;
          date_source?: string | null;
          due_date?: string | null;
          equipment_id: string;
          id?: string;
          interval_months?: number | null;
          is_active?: boolean;
          issue_date?: string | null;
          laboratory?: string | null;
          notes?: string | null;
          reported_due_date?: string | null;
          resolution_note?: string | null;
          result?: string | null;
          source_import_row_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          branch_code?: string;
          calculated_due_date?: string | null;
          calculation_base?: string | null;
          calibration_date?: string | null;
          certificate_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          date_basis?: string | null;
          date_source?: string | null;
          due_date?: string | null;
          equipment_id?: string;
          id?: string;
          interval_months?: number | null;
          is_active?: boolean;
          issue_date?: string | null;
          laboratory?: string | null;
          notes?: string | null;
          reported_due_date?: string | null;
          resolution_note?: string | null;
          result?: string | null;
          source_import_row_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calibrations_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "calibrations_equipment_id_branch_code_fkey";
            columns: ["equipment_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "calibrations_equipment_id_branch_code_fkey";
            columns: ["equipment_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "equipment_records";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "calibrations_source_import_row_id_fkey";
            columns: ["source_import_row_id"];
            isOneToOne: true;
            referencedRelation: "import_rows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calibrations_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      certificate_types: {
        Row: {
          branch_code: string;
          category: string;
          code: string;
          created_at: string;
          created_by: string | null;
          default_validity_months: number | null;
          id: string;
          is_active: boolean;
          issuer: string | null;
          name: string;
          regulation_reference: string | null;
          reminder_days: number[];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_code?: string;
          category: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          default_validity_months?: number | null;
          id?: string;
          is_active?: boolean;
          issuer?: string | null;
          name: string;
          regulation_reference?: string | null;
          reminder_days?: number[];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_code?: string;
          category?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          default_validity_months?: number | null;
          id?: string;
          is_active?: boolean;
          issuer?: string | null;
          name?: string;
          regulation_reference?: string | null;
          reminder_days?: number[];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "certificate_types_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
        ];
      };
      client_assignment_history: {
        Row: {
          branch_code: string;
          changed_at: string;
          changed_by: string | null;
          client_id: string;
          id: string;
          new_account_manager_id: string | null;
          old_account_manager_id: string | null;
          reason: string;
        };
        Insert: {
          branch_code: string;
          changed_at?: string;
          changed_by?: string | null;
          client_id: string;
          id?: string;
          new_account_manager_id?: string | null;
          old_account_manager_id?: string | null;
          reason: string;
        };
        Update: {
          branch_code?: string;
          changed_at?: string;
          changed_by?: string | null;
          client_id?: string;
          id?: string;
          new_account_manager_id?: string | null;
          old_account_manager_id?: string | null;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_assignment_history_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "client_assignment_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_assignment_history_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_assignment_history_new_account_manager_id_fkey";
            columns: ["new_account_manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_assignment_history_old_account_manager_id_fkey";
            columns: ["old_account_manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_certificates: {
        Row: {
          branch_code: string;
          capacity: string | null;
          certificate_number: string | null;
          certificate_type_id: string;
          client_id: string;
          contract_reference: string | null;
          created_at: string;
          created_by: string | null;
          expiry_date: string | null;
          id: string;
          inspection_date: string | null;
          inspector_employee_id: string | null;
          installation_location: string | null;
          interval_months: number | null;
          is_active: boolean;
          is_example: boolean;
          issue_date: string | null;
          notes: string | null;
          object_serial: string | null;
          object_type: string | null;
          order_reference: string | null;
          portfolio_id: string | null;
          previous_certificate_id: string | null;
          previous_order_value: number | null;
          renewal_status: string;
          source_import_row_id: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          branch_code?: string;
          capacity?: string | null;
          certificate_number?: string | null;
          certificate_type_id: string;
          client_id: string;
          contract_reference?: string | null;
          created_at?: string;
          created_by?: string | null;
          expiry_date?: string | null;
          id?: string;
          inspection_date?: string | null;
          inspector_employee_id?: string | null;
          installation_location?: string | null;
          interval_months?: number | null;
          is_active?: boolean;
          is_example?: boolean;
          issue_date?: string | null;
          notes?: string | null;
          object_serial?: string | null;
          object_type?: string | null;
          order_reference?: string | null;
          portfolio_id?: string | null;
          previous_certificate_id?: string | null;
          previous_order_value?: number | null;
          renewal_status?: string;
          source_import_row_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          branch_code?: string;
          capacity?: string | null;
          certificate_number?: string | null;
          certificate_type_id?: string;
          client_id?: string;
          contract_reference?: string | null;
          created_at?: string;
          created_by?: string | null;
          expiry_date?: string | null;
          id?: string;
          inspection_date?: string | null;
          inspector_employee_id?: string | null;
          installation_location?: string | null;
          interval_months?: number | null;
          is_active?: boolean;
          is_example?: boolean;
          issue_date?: string | null;
          notes?: string | null;
          object_serial?: string | null;
          object_type?: string | null;
          order_reference?: string | null;
          portfolio_id?: string | null;
          previous_certificate_id?: string | null;
          previous_order_value?: number | null;
          renewal_status?: string;
          source_import_row_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_certificates_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "client_certificates_certificate_type_id_branch_code_fkey";
            columns: ["certificate_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "certificate_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_inspector_employee_id_branch_code_fkey";
            columns: ["inspector_employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificate_display_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificate_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "renewal_board_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_source_import_row_id_fkey";
            columns: ["source_import_row_id"];
            isOneToOne: true;
            referencedRelation: "import_rows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_contacts: {
        Row: {
          branch_code: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          department: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          is_primary: boolean;
          name: string;
          phone: string | null;
          position: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
          whatsapp: string | null;
        };
        Insert: {
          branch_code?: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          department?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          name: string;
          phone?: string | null;
          position?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          branch_code?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          department?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          name?: string;
          phone?: string | null;
          position?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_contacts_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "client_contacts_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_contacts_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          account_manager_id: string | null;
          address: string | null;
          assignment_reason: string | null;
          branch_code: string;
          created_at: string;
          created_by: string | null;
          example_am_label: string | null;
          id: string;
          industry_sector: string | null;
          is_active: boolean;
          is_example: boolean;
          name: string;
          portfolio_id: string | null;
          site_location: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
          work_area_id: string | null;
        };
        Insert: {
          account_manager_id?: string | null;
          address?: string | null;
          assignment_reason?: string | null;
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          example_am_label?: string | null;
          id?: string;
          industry_sector?: string | null;
          is_active?: boolean;
          is_example?: boolean;
          name: string;
          portfolio_id?: string | null;
          site_location?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
          work_area_id?: string | null;
        };
        Update: {
          account_manager_id?: string | null;
          address?: string | null;
          assignment_reason?: string | null;
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          example_am_label?: string | null;
          id?: string;
          industry_sector?: string | null;
          is_active?: boolean;
          is_example?: boolean;
          name?: string;
          portfolio_id?: string | null;
          site_location?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
          work_area_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_account_manager_id_fkey";
            columns: ["account_manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "clients_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "clients_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_work_area_id_branch_code_fkey";
            columns: ["work_area_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "work_areas";
            referencedColumns: ["id", "branch_code"];
          },
        ];
      };
      employee_directory: {
        Row: {
          branch_code: string;
          created_at: string;
          created_by: string | null;
          employment_category: string | null;
          employment_status: string;
          full_name: string;
          id: string;
          is_active: boolean;
          npp: string | null;
          organization_unit: string | null;
          position: string | null;
          source_nrk_label: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          employment_category?: string | null;
          employment_status?: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          npp?: string | null;
          organization_unit?: string | null;
          position?: string | null;
          source_nrk_label?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          employment_category?: string | null;
          employment_status?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          npp?: string | null;
          organization_unit?: string | null;
          position?: string | null;
          source_nrk_label?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "employee_directory_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "employee_directory_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      employee_portfolio_assignments: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          assignment_type: string;
          branch_code: string;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          effective_until: string | null;
          employee_id: string;
          id: string;
          is_active: boolean;
          portfolio_id: string;
          updated_at: string;
          updated_by: string | null;
          verification_note: string | null;
          verification_status: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          assignment_type: string;
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_until?: string | null;
          employee_id: string;
          id?: string;
          is_active?: boolean;
          portfolio_id: string;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          assignment_type?: string;
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_until?: string | null;
          employee_id?: string;
          id?: string;
          is_active?: boolean;
          portfolio_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_portfolio_assignments_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employee_portfolio_assignments_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "employee_portfolio_assignments_employee_id_branch_code_fkey";
            columns: ["employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "employee_portfolio_assignments_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
        ];
      };
      equipment: {
        Row: {
          asset_id: string | null;
          branch_code: string;
          brand: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          location: string | null;
          measurement_range: string | null;
          model: string | null;
          name: string;
          notes: string | null;
          ownership: string;
          portfolio_id: string | null;
          responsible_employee_id: string | null;
          serial: string | null;
          tag: string | null;
          unit: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          asset_id?: string | null;
          branch_code?: string;
          brand?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          measurement_range?: string | null;
          model?: string | null;
          name: string;
          notes?: string | null;
          ownership: string;
          portfolio_id?: string | null;
          responsible_employee_id?: string | null;
          serial?: string | null;
          tag?: string | null;
          unit?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          asset_id?: string | null;
          branch_code?: string;
          brand?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          measurement_range?: string | null;
          model?: string | null;
          name?: string;
          notes?: string | null;
          ownership?: string;
          portfolio_id?: string | null;
          responsible_employee_id?: string | null;
          serial?: string | null;
          tag?: string | null;
          unit?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "equipment_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "equipment_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "equipment_responsible_employee_id_branch_code_fkey";
            columns: ["responsible_employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "equipment_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      import_batches: {
        Row: {
          branch_code: string;
          created_at: string;
          created_by: string | null;
          domain: string;
          file_bytes: number;
          file_hash: string;
          filename: string;
          id: string;
          is_example: boolean;
          source_count: number;
          source_note: string | null;
        };
        Insert: {
          branch_code: string;
          created_at?: string;
          created_by?: string | null;
          domain: string;
          file_bytes: number;
          file_hash: string;
          filename: string;
          id?: string;
          is_example?: boolean;
          source_count: number;
          source_note?: string | null;
        };
        Update: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          domain?: string;
          file_bytes?: number;
          file_hash?: string;
          filename?: string;
          id?: string;
          is_example?: boolean;
          source_count?: number;
          source_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "import_batches_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
        ];
      };
      import_rows: {
        Row: {
          batch_id: string;
          branch_code: string;
          committed_record_id: string | null;
          created_at: string;
          decision: string;
          id: string;
          issues: Json;
          normalized_values: Json;
          raw_values: Json;
          review_note: string | null;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          source_row: number;
          source_sheet: string;
        };
        Insert: {
          batch_id: string;
          branch_code: string;
          committed_record_id?: string | null;
          created_at?: string;
          decision?: string;
          id?: string;
          issues?: Json;
          normalized_values: Json;
          raw_values: Json;
          review_note?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_row: number;
          source_sheet: string;
        };
        Update: {
          batch_id?: string;
          branch_code?: string;
          committed_record_id?: string | null;
          created_at?: string;
          decision?: string;
          id?: string;
          issues?: Json;
          normalized_values?: Json;
          raw_values?: Json;
          review_note?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_row?: number;
          source_sheet?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_branch_code_fkey";
            columns: ["batch_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "import_rows_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
        ];
      };
      operational_documents: {
        Row: {
          branch_code: string;
          created_at: string;
          created_by: string;
          domain: string;
          file_bytes: number;
          id: string;
          kind: string;
          object_path: string;
          original_name: string;
          record_id: string;
        };
        Insert: {
          branch_code: string;
          created_at?: string;
          created_by?: string;
          domain: string;
          file_bytes: number;
          id?: string;
          kind: string;
          object_path: string;
          original_name: string;
          record_id: string;
        };
        Update: {
          branch_code?: string;
          created_at?: string;
          created_by?: string;
          domain?: string;
          file_bytes?: number;
          id?: string;
          kind?: string;
          object_path?: string;
          original_name?: string;
          record_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operational_documents_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
        ];
      };
      personnel_certificate_services: {
        Row: {
          branch_code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          personnel_certificate_id: string;
          service_type_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          personnel_certificate_id: string;
          service_type_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          personnel_certificate_id?: string;
          service_type_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "personnel_certificate_service_personnel_certificate_id_bra_fkey";
            columns: ["personnel_certificate_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "personnel_certificate_portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificate_service_personnel_certificate_id_bra_fkey";
            columns: ["personnel_certificate_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "personnel_certificate_records";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificate_service_personnel_certificate_id_bra_fkey";
            columns: ["personnel_certificate_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "personnel_certificates";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificate_services_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "personnel_certificate_services_service_type_id_branch_code_fkey";
            columns: ["service_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "service_types";
            referencedColumns: ["id", "branch_code"];
          },
        ];
      };
      personnel_certificates: {
        Row: {
          branch_code: string;
          certificate_number: string | null;
          certificate_type_id: string;
          created_at: string;
          created_by: string | null;
          employee_id: string;
          expiry_date: string | null;
          id: string;
          interval_months: number | null;
          is_active: boolean;
          issue_date: string | null;
          issuer: string | null;
          notes: string | null;
          original_holder_name: string | null;
          original_title: string | null;
          source_folder_url: string | null;
          source_import_row_id: string | null;
          source_provider: string | null;
          updated_at: string;
          updated_by: string | null;
          validity_kind: string;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          branch_code?: string;
          certificate_number?: string | null;
          certificate_type_id: string;
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          expiry_date?: string | null;
          id?: string;
          interval_months?: number | null;
          is_active?: boolean;
          issue_date?: string | null;
          issuer?: string | null;
          notes?: string | null;
          original_holder_name?: string | null;
          original_title?: string | null;
          source_folder_url?: string | null;
          source_import_row_id?: string | null;
          source_provider?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          validity_kind?: string;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          branch_code?: string;
          certificate_number?: string | null;
          certificate_type_id?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          expiry_date?: string | null;
          id?: string;
          interval_months?: number | null;
          is_active?: boolean;
          issue_date?: string | null;
          issuer?: string | null;
          notes?: string | null;
          original_holder_name?: string | null;
          original_title?: string | null;
          source_folder_url?: string | null;
          source_import_row_id?: string | null;
          source_provider?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          validity_kind?: string;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "personnel_certificates_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "personnel_certificates_certificate_type_id_branch_code_fkey";
            columns: ["certificate_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "certificate_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificates_employee_id_branch_code_fkey";
            columns: ["employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificates_source_import_row_id_fkey";
            columns: ["source_import_row_id"];
            isOneToOne: true;
            referencedRelation: "import_rows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personnel_certificates_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      personnel_correction_requests: {
        Row: {
          branch_code: string;
          certificate_id: string;
          created_at: string;
          created_by: string;
          id: string;
          message: string;
        };
        Insert: {
          branch_code: string;
          certificate_id: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          message: string;
        };
        Update: {
          branch_code?: string;
          certificate_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "personnel_correction_requests_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "personnel_correction_requests_certificate_id_fkey";
            columns: ["certificate_id"];
            isOneToOne: false;
            referencedRelation: "personnel_certificate_portfolios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personnel_correction_requests_certificate_id_fkey";
            columns: ["certificate_id"];
            isOneToOne: false;
            referencedRelation: "personnel_certificate_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personnel_correction_requests_certificate_id_fkey";
            columns: ["certificate_id"];
            isOneToOne: false;
            referencedRelation: "personnel_certificates";
            referencedColumns: ["id"];
          },
        ];
      };
      portfolio_aliases: {
        Row: {
          alias: string;
          branch_code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          portfolio_id: string;
          updated_at: string;
          updated_by: string | null;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          alias: string;
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          portfolio_id: string;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          alias?: string;
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          portfolio_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "portfolio_aliases_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "portfolio_aliases_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "portfolio_aliases_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      portfolios: {
        Row: {
          branch_code: string;
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_code?: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_code?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "portfolios_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
        ];
      };
      profiles: {
        Row: {
          activated_at: string | null;
          activated_by: string | null;
          branch_code: string;
          created_at: string;
          created_by: string | null;
          display_name: string | null;
          email: string | null;
          employee_id: string | null;
          full_name: string | null;
          id: string;
          is_active: boolean;
          role_code: string;
          updated_at: string;
          updated_by: string | null;
          whatsapp: string | null;
        };
        Insert: {
          activated_at?: string | null;
          activated_by?: string | null;
          branch_code: string;
          created_at?: string;
          created_by?: string | null;
          display_name?: string | null;
          email?: string | null;
          employee_id?: string | null;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          role_code?: string;
          updated_at?: string;
          updated_by?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          activated_at?: string | null;
          activated_by?: string | null;
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          display_name?: string | null;
          email?: string | null;
          employee_id?: string | null;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          role_code?: string;
          updated_at?: string;
          updated_by?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "profiles_employee_branch_fk";
            columns: ["employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "profiles_role_code_fkey";
            columns: ["role_code"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["code"];
          },
        ];
      };
      renewal_events: {
        Row: {
          branch_code: string;
          created_at: string;
          created_by: string;
          document_id: string | null;
          from_stage: string | null;
          id: string;
          note: string;
          opportunity_id: string;
          to_stage: string;
        };
        Insert: {
          branch_code: string;
          created_at?: string;
          created_by: string;
          document_id?: string | null;
          from_stage?: string | null;
          id?: string;
          note: string;
          opportunity_id: string;
          to_stage: string;
        };
        Update: {
          branch_code?: string;
          created_at?: string;
          created_by?: string;
          document_id?: string | null;
          from_stage?: string | null;
          id?: string;
          note?: string;
          opportunity_id?: string;
          to_stage?: string;
        };
        Relationships: [
          {
            foreignKeyName: "renewal_events_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "renewal_events_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "operational_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "renewal_events_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "renewal_board_records";
            referencedColumns: ["opportunity_id"];
          },
          {
            foreignKeyName: "renewal_events_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "renewal_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      renewal_opportunities: {
        Row: {
          branch_code: string;
          certificate_id: string;
          client_id: string;
          id: string;
          stage: string;
          updated_at: string;
        };
        Insert: {
          branch_code: string;
          certificate_id: string;
          client_id: string;
          id?: string;
          stage?: string;
          updated_at?: string;
        };
        Update: {
          branch_code?: string;
          certificate_id?: string;
          client_id?: string;
          id?: string;
          stage?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "renewal_opportunities_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "renewal_opportunities_certificate_id_fkey";
            columns: ["certificate_id"];
            isOneToOne: true;
            referencedRelation: "client_certificate_display_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "renewal_opportunities_certificate_id_fkey";
            columns: ["certificate_id"];
            isOneToOne: true;
            referencedRelation: "client_certificate_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "renewal_opportunities_certificate_id_fkey";
            columns: ["certificate_id"];
            isOneToOne: true;
            referencedRelation: "client_certificates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "renewal_opportunities_certificate_id_fkey";
            columns: ["certificate_id"];
            isOneToOne: true;
            referencedRelation: "renewal_board_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "renewal_opportunities_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
        ];
      };
      roles: {
        Row: {
          code: string;
          description: string | null;
          is_active: boolean;
          name: string;
        };
        Insert: {
          code: string;
          description?: string | null;
          is_active?: boolean;
          name: string;
        };
        Update: {
          code?: string;
          description?: string | null;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      service_competency_requirements: {
        Row: {
          branch_code: string;
          certificate_type_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          requirement_note: string;
          service_type_id: string;
          updated_at: string;
          updated_by: string | null;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          branch_code?: string;
          certificate_type_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          requirement_note: string;
          service_type_id: string;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          branch_code?: string;
          certificate_type_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          requirement_note?: string;
          service_type_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_competency_requiremen_certificate_type_id_branch_c_fkey";
            columns: ["certificate_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "certificate_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "service_competency_requirement_service_type_id_branch_code_fkey";
            columns: ["service_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "service_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "service_competency_requirements_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "service_competency_requirements_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      service_types: {
        Row: {
          branch_code: string;
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_code?: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_code?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_types_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
        ];
      };
      user_role_assignments: {
        Row: {
          branch_code: string;
          created_at: string;
          created_by: string | null;
          grant_reason: string;
          granted_at: string;
          granted_by: string | null;
          id: string;
          is_active: boolean;
          profile_id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role_code: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          grant_reason: string;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          is_active?: boolean;
          profile_id: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role_code: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          grant_reason?: string;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          is_active?: boolean;
          profile_id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role_code?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "user_role_assignments_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_role_assignments_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_role_assignments_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_role_assignments_role_code_fkey";
            columns: ["role_code"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["code"];
          },
        ];
      };
      work_areas: {
        Row: {
          branch_code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "work_areas_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
        ];
      };
    };
    Views: {
      calibration_records: {
        Row: {
          branch_code: string | null;
          calculated_due_date: string | null;
          calculation_base: string | null;
          calibration_date: string | null;
          certificate_number: string | null;
          created_at: string | null;
          created_by: string | null;
          date_basis: string | null;
          date_source: string | null;
          days_remaining: number | null;
          due_date: string | null;
          equipment_id: string | null;
          equipment_name: string | null;
          id: string | null;
          interval_months: number | null;
          is_active: boolean | null;
          issue_date: string | null;
          laboratory: string | null;
          notes: string | null;
          reported_due_date: string | null;
          resolution_note: string | null;
          result: string | null;
          updated_at: string | null;
          updated_by: string | null;
          validity_status: string | null;
          verification_note: string | null;
          verification_status: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calibrations_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "calibrations_equipment_id_branch_code_fkey";
            columns: ["equipment_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "calibrations_equipment_id_branch_code_fkey";
            columns: ["equipment_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "equipment_records";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "calibrations_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_certificate_display_records: {
        Row: {
          account_manager_id: string | null;
          account_manager_name: string | null;
          branch_code: string | null;
          capacity: string | null;
          certificate_number: string | null;
          certificate_type_id: string | null;
          certificate_type_name: string | null;
          client_id: string | null;
          client_name: string | null;
          contract_reference: string | null;
          created_at: string | null;
          created_by: string | null;
          days_remaining: number | null;
          example_am_label: string | null;
          expiry_date: string | null;
          id: string | null;
          inspection_date: string | null;
          inspector_employee_id: string | null;
          installation_location: string | null;
          interval_months: number | null;
          is_active: boolean | null;
          is_example: boolean | null;
          issue_date: string | null;
          notes: string | null;
          object_serial: string | null;
          object_type: string | null;
          order_reference: string | null;
          portfolio_id: string | null;
          previous_certificate_id: string | null;
          previous_order_value: number | null;
          previous_order_value_text: string | null;
          renewal_status: string | null;
          scope_portfolio_id: string | null;
          updated_at: string | null;
          updated_by: string | null;
          validity_status: string | null;
          verification_note: string | null;
          verification_status: string | null;
          verified_at: string | null;
          verified_by: string | null;
          work_area_id: string | null;
          work_area_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_certificates_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "client_certificates_certificate_type_id_branch_code_fkey";
            columns: ["certificate_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "certificate_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_inspector_employee_id_branch_code_fkey";
            columns: ["inspector_employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificate_display_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificate_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "renewal_board_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_account_manager_id_fkey";
            columns: ["account_manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_certificate_records: {
        Row: {
          account_manager_id: string | null;
          branch_code: string | null;
          capacity: string | null;
          certificate_number: string | null;
          certificate_type_id: string | null;
          certificate_type_name: string | null;
          client_id: string | null;
          client_name: string | null;
          contract_reference: string | null;
          created_at: string | null;
          created_by: string | null;
          days_remaining: number | null;
          example_am_label: string | null;
          expiry_date: string | null;
          id: string | null;
          inspection_date: string | null;
          inspector_employee_id: string | null;
          installation_location: string | null;
          interval_months: number | null;
          is_active: boolean | null;
          is_example: boolean | null;
          issue_date: string | null;
          notes: string | null;
          object_serial: string | null;
          object_type: string | null;
          order_reference: string | null;
          portfolio_id: string | null;
          previous_certificate_id: string | null;
          previous_order_value: number | null;
          renewal_status: string | null;
          scope_portfolio_id: string | null;
          updated_at: string | null;
          updated_by: string | null;
          validity_status: string | null;
          verification_note: string | null;
          verification_status: string | null;
          verified_at: string | null;
          verified_by: string | null;
          work_area_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_certificates_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "client_certificates_certificate_type_id_branch_code_fkey";
            columns: ["certificate_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "certificate_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_inspector_employee_id_branch_code_fkey";
            columns: ["inspector_employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificate_display_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificate_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "renewal_board_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_account_manager_id_fkey";
            columns: ["account_manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      equipment_records: {
        Row: {
          asset_id: string | null;
          branch_code: string | null;
          brand: string | null;
          client_id: string | null;
          created_at: string | null;
          created_by: string | null;
          eligibility_status: string | null;
          id: string | null;
          is_active: boolean | null;
          latest_calibration_id: string | null;
          latest_due_date: string | null;
          location: string | null;
          measurement_range: string | null;
          model: string | null;
          name: string | null;
          notes: string | null;
          ownership: string | null;
          portfolio_id: string | null;
          responsible_employee_id: string | null;
          serial: string | null;
          tag: string | null;
          unit: string | null;
          updated_at: string | null;
          updated_by: string | null;
          validity_status: string | null;
          verification_status: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "equipment_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "equipment_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "equipment_responsible_employee_id_branch_code_fkey";
            columns: ["responsible_employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "equipment_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      operational_scope_records: {
        Row: {
          account_manager_id: string | null;
          branch_code: string | null;
          certificate_type_id: string | null;
          client_id: string | null;
          domain: string | null;
          entity_name: string | null;
          expiry_date: string | null;
          id: string | null;
          is_example: boolean | null;
          portfolio_ids: string[] | null;
          previous_order_value: number | null;
          title: string | null;
          validity_status: string | null;
          verification_status: string | null;
          work_area_id: string | null;
        };
        Relationships: [];
      };
      personnel_certificate_portfolios: {
        Row: {
          branch_code: string | null;
          certificate_number: string | null;
          certificate_type_id: string | null;
          certificate_type_name: string | null;
          created_at: string | null;
          created_by: string | null;
          days_remaining: number | null;
          employee_id: string | null;
          employee_name: string | null;
          expiry_date: string | null;
          id: string | null;
          interval_months: number | null;
          is_active: boolean | null;
          issue_date: string | null;
          issuer: string | null;
          notes: string | null;
          npp: string | null;
          original_holder_name: string | null;
          original_title: string | null;
          portfolio_ids: string[] | null;
          source_folder_url: string | null;
          source_provider: string | null;
          updated_at: string | null;
          updated_by: string | null;
          validity_kind: string | null;
          validity_status: string | null;
          verification_note: string | null;
          verification_status: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "personnel_certificates_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "personnel_certificates_certificate_type_id_branch_code_fkey";
            columns: ["certificate_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "certificate_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificates_employee_id_branch_code_fkey";
            columns: ["employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificates_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      personnel_certificate_records: {
        Row: {
          branch_code: string | null;
          certificate_number: string | null;
          certificate_type_id: string | null;
          certificate_type_name: string | null;
          created_at: string | null;
          created_by: string | null;
          days_remaining: number | null;
          employee_id: string | null;
          employee_name: string | null;
          expiry_date: string | null;
          id: string | null;
          interval_months: number | null;
          is_active: boolean | null;
          issue_date: string | null;
          issuer: string | null;
          notes: string | null;
          npp: string | null;
          original_holder_name: string | null;
          original_title: string | null;
          source_folder_url: string | null;
          source_provider: string | null;
          updated_at: string | null;
          updated_by: string | null;
          validity_kind: string | null;
          validity_status: string | null;
          verification_note: string | null;
          verification_status: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "personnel_certificates_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "personnel_certificates_certificate_type_id_branch_code_fkey";
            columns: ["certificate_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "certificate_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificates_employee_id_branch_code_fkey";
            columns: ["employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "personnel_certificates_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      renewal_board_records: {
        Row: {
          account_manager_id: string | null;
          branch_code: string | null;
          capacity: string | null;
          certificate_number: string | null;
          certificate_type_id: string | null;
          certificate_type_name: string | null;
          client_id: string | null;
          client_name: string | null;
          contract_reference: string | null;
          created_at: string | null;
          created_by: string | null;
          days_remaining: number | null;
          example_am_label: string | null;
          expiry_date: string | null;
          id: string | null;
          inspection_date: string | null;
          inspector_employee_id: string | null;
          installation_location: string | null;
          interval_months: number | null;
          is_active: boolean | null;
          is_example: boolean | null;
          issue_date: string | null;
          notes: string | null;
          object_serial: string | null;
          object_type: string | null;
          opportunity_id: string | null;
          order_reference: string | null;
          portfolio_id: string | null;
          previous_certificate_id: string | null;
          previous_order_value: number | null;
          previous_order_value_text: string | null;
          renewal_status: string | null;
          scope_portfolio_id: string | null;
          stage: string | null;
          updated_at: string | null;
          updated_by: string | null;
          validity_status: string | null;
          verification_note: string | null;
          verification_status: string | null;
          verified_at: string | null;
          verified_by: string | null;
          work_area_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_certificates_branch_code_fkey";
            columns: ["branch_code"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "client_certificates_certificate_type_id_branch_code_fkey";
            columns: ["certificate_type_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "certificate_types";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_client_id_branch_code_fkey";
            columns: ["client_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_inspector_employee_id_branch_code_fkey";
            columns: ["inspector_employee_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "employee_directory";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_portfolio_id_branch_code_fkey";
            columns: ["portfolio_id", "branch_code"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id", "branch_code"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificate_display_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificate_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "client_certificates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_previous_certificate_id_fkey";
            columns: ["previous_certificate_id"];
            isOneToOne: false;
            referencedRelation: "renewal_board_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_certificates_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_account_manager_id_fkey";
            columns: ["account_manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      commit_import: { Args: { batch: string }; Returns: number };
      operational_summary: {
        Args: { b: string; filters?: Json };
        Returns: Json;
      };
      pipeline_totals: {
        Args: { b: string; include_examples?: boolean };
        Returns: Json;
      };
      review_import: {
        Args: { approve: boolean; n: Json; r: string; reason: string };
        Returns: undefined;
      };
      stage_import: {
        Args: {
          b: string;
          d: string;
          f: string;
          h: string;
          items: Json;
          note: string;
          sz: number;
        };
        Returns: string;
      };
      transition_renewal: {
        Args: { cert: string; doc?: string; note: string; target: string };
        Returns: string;
      };
      validity_status: {
        Args: { d: string; kind?: string; v: string };
        Returns: string;
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

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
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
