import { PatientHistoryDetail } from "@/components/medical/patient-history-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MedicoPacienteDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PatientHistoryDetail patientId={id} />;
}
