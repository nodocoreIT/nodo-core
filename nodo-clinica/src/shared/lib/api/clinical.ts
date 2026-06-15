import { supabase } from "@/shared/lib/supabase";
import type { ClinicalRecord, ClinicalNote, Prescription, StudyOrder, SoapSummary, Medication } from "@/types";

export async function fetchClinicalRecords(patientId: string): Promise<ClinicalRecord[]> {
  const { data, error } = await supabase
    .from("clinical_records")
    .select("*, doctor:profiles(full_name)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as unknown as ClinicalRecord[];
}

export async function fetchClinicalNote(appointmentId: string): Promise<ClinicalNote | null> {
  const { data, error } = await supabase
    .from("clinical_notes")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (error) throw error;
  return data as ClinicalNote | null;
}

export async function upsertClinicalNote(
  appointmentId: string,
  doctorId: string,
  content: string,
): Promise<void> {
  const { error } = await supabase
    .from("clinical_notes")
    .upsert(
      { appointment_id: appointmentId, doctor_id: doctorId, content },
      { onConflict: "appointment_id" },
    );

  if (error) throw error;
}

export async function savePrescription(data: {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  medications: Medication[];
}): Promise<Prescription> {
  const { data: created, error } = await supabase
    .from("prescriptions")
    .insert({
      appointment_id: data.appointmentId,
      doctor_id: data.doctorId,
      patient_id: data.patientId,
      medications: data.medications,
    })
    .select()
    .single();

  if (error) throw error;
  return created as unknown as Prescription;
}

export async function saveStudyOrder(data: {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  studies: string[];
  notes?: string;
}): Promise<StudyOrder> {
  const { data: created, error } = await supabase
    .from("study_orders")
    .insert({
      appointment_id: data.appointmentId,
      doctor_id: data.doctorId,
      patient_id: data.patientId,
      studies: data.studies,
      notes: data.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return created as unknown as StudyOrder;
}

export async function upsertSoapSummary(
  appointmentId: string,
  soap: Pick<SoapSummary, "subjective" | "objective" | "analysis" | "plan">,
): Promise<SoapSummary> {
  const { data, error } = await supabase
    .from("soap_summaries")
    .upsert(
      { appointment_id: appointmentId, ...soap },
      { onConflict: "appointment_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as SoapSummary;
}
