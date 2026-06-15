export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        {
          id: string;
          role: "doctor" | "patient" | "admin";
          full_name: string;
          email: string;
          specialty: string | null;
          license_number: string | null;
          signature_url: string | null;
          logo_url: string | null;
          created_at: string;
        },
        {
          id: string;
          role: "doctor" | "patient" | "admin";
          full_name: string;
          email: string;
          specialty?: string | null;
          license_number?: string | null;
          signature_url?: string | null;
          logo_url?: string | null;
          created_at?: string;
        },
        {
          role?: "doctor" | "patient" | "admin";
          full_name?: string;
          email?: string;
          specialty?: string | null;
          license_number?: string | null;
          signature_url?: string | null;
          logo_url?: string | null;
        }
      >;
      patients: TableDef<
        {
          id: string;
          profile_id: string;
          date_of_birth: string | null;
          medical_record_number: string | null;
          created_at: string;
        },
        {
          id?: string;
          profile_id: string;
          date_of_birth?: string | null;
          medical_record_number?: string | null;
          created_at?: string;
        },
        {
          profile_id?: string;
          date_of_birth?: string | null;
          medical_record_number?: string | null;
        }
      >;
      appointments: TableDef<
        {
          id: string;
          patient_id: string;
          doctor_id: string;
          scheduled_at: string;
          status: "scheduled" | "waiting" | "in_consultation" | "completed" | "cancelled";
          queue_position: number;
          jitsi_room_id: string;
          access_token: string;
          token_expires_at: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          patient_id: string;
          doctor_id: string;
          scheduled_at: string;
          status?: "scheduled" | "waiting" | "in_consultation" | "completed" | "cancelled";
          queue_position?: number;
          jitsi_room_id: string;
          access_token?: string;
          token_expires_at: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: "scheduled" | "waiting" | "in_consultation" | "completed" | "cancelled";
          queue_position?: number;
          updated_at?: string;
        }
      >;
      clinical_records: TableDef<
        {
          id: string;
          patient_id: string;
          doctor_id: string;
          appointment_id: string | null;
          record_type: string;
          title: string;
          content: string;
          created_at: string;
        },
        {
          id?: string;
          patient_id: string;
          doctor_id: string;
          appointment_id?: string | null;
          record_type?: string;
          title: string;
          content: string;
          created_at?: string;
        },
        {
          title?: string;
          content?: string;
          record_type?: string;
        }
      >;
      clinical_notes: TableDef<
        {
          id: string;
          appointment_id: string;
          doctor_id: string;
          content: string;
          updated_at: string;
        },
        {
          id?: string;
          appointment_id: string;
          doctor_id: string;
          content?: string;
          updated_at?: string;
        },
        {
          content?: string;
          updated_at?: string;
        }
      >;
      transcriptions: TableDef<
        {
          id: string;
          appointment_id: string;
          content: string;
          segments: Json;
          updated_at: string;
        },
        {
          id?: string;
          appointment_id: string;
          content?: string;
          segments?: Json;
          updated_at?: string;
        },
        {
          content?: string;
          segments?: Json;
          updated_at?: string;
        }
      >;
      prescriptions: TableDef<
        {
          id: string;
          appointment_id: string;
          doctor_id: string;
          patient_id: string;
          medications: Json;
          pdf_url: string | null;
          sent_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          appointment_id: string;
          doctor_id: string;
          patient_id: string;
          medications: Json;
          pdf_url?: string | null;
          sent_at?: string | null;
          created_at?: string;
        },
        {
          medications?: Json;
          pdf_url?: string | null;
          sent_at?: string | null;
        }
      >;
      study_orders: TableDef<
        {
          id: string;
          appointment_id: string;
          doctor_id: string;
          patient_id: string;
          studies: Json;
          notes: string | null;
          pdf_url: string | null;
          created_at: string;
        },
        {
          id?: string;
          appointment_id: string;
          doctor_id: string;
          patient_id: string;
          studies: Json;
          notes?: string | null;
          pdf_url?: string | null;
          created_at?: string;
        },
        {
          studies?: Json;
          notes?: string | null;
          pdf_url?: string | null;
        }
      >;
      soap_summaries: TableDef<
        {
          id: string;
          appointment_id: string;
          subjective: string;
          objective: string;
          analysis: string;
          plan: string;
          created_at: string;
        },
        {
          id?: string;
          appointment_id: string;
          subjective?: string;
          objective?: string;
          analysis?: string;
          plan?: string;
          created_at?: string;
        },
        {
          subjective?: string;
          objective?: string;
          analysis?: string;
          plan?: string;
        }
      >;
      patient_documents: TableDef<
        {
          id: string;
          patient_id: string;
          appointment_id: string;
          file_name: string;
          file_path: string;
          mime_type: string;
          uploaded_at: string;
          notified_doctor: boolean;
        },
        {
          id?: string;
          patient_id: string;
          appointment_id: string;
          file_name: string;
          file_path: string;
          mime_type: string;
          uploaded_at?: string;
          notified_doctor?: boolean;
        },
        {
          notified_doctor?: boolean;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
