// Hand-authored type — run `supabase gen types typescript` to regenerate from live schema.
// Must satisfy @supabase/supabase-js GenericTable / GenericSchema contracts.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Locale = 'es' | 'de' | 'en'
export type Country = 'ES' | 'CH' | 'DE'
export type Currency = 'EUR' | 'CHF'
export type InvoiceStatus =
  | 'pending'
  | 'processing'
  | 'review_needed'
  | 'approved'
  | 'rejected'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company_name: string | null
          tax_id: string | null
          country: Country
          locale: Locale
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          company_name?: string | null
          tax_id?: string | null
          country?: Country
          locale?: Locale
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company_name?: string | null
          tax_id?: string | null
          country?: Country
          locale?: Locale
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          receipt_path: string | null
          vendor_name: string | null
          vendor_tax_id: string | null
          invoice_number: string | null
          invoice_date: string | null      // ISO date string (YYYY-MM-DD)
          subtotal_cents: number | null
          tax_cents: number | null
          total_cents: number | null
          tax_rate: number | null
          currency: Currency
          status: InvoiceStatus
          ai_confidence: number | null
          ai_raw_response: Json | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          receipt_path?: string | null
          vendor_name?: string | null
          vendor_tax_id?: string | null
          invoice_number?: string | null
          invoice_date?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          total_cents?: number | null
          tax_rate?: number | null
          currency?: Currency
          status?: InvoiceStatus
          ai_confidence?: number | null
          ai_raw_response?: Json | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          receipt_path?: string | null
          vendor_name?: string | null
          vendor_tax_id?: string | null
          invoice_number?: string | null
          invoice_date?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          total_cents?: number | null
          tax_rate?: number | null
          currency?: Currency
          status?: InvoiceStatus
          ai_confidence?: number | null
          ai_raw_response?: Json | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']
