import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  publicDoctorSummary,
  publicPatient,
} from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  requireDoctorSession,
  requirePatientSession,
  unauthorized,
} from "@/lib/clinic/access-control";
import {
  DEFAULT_AVAILABILITY,
  localDateKeyFromDate,
  localDateKeyFromIso,
  appointmentMatchesScheduleGrid,
  slotKeyFromIso,
  addDaysToDateKey,
} from "@/lib/clinic/schedule";
import {
  isPaymentConfirmed,
  appointmentNeedsDoctorPaymentReview,
} from "@/lib/clinic/payment";
import { isStrictPaymentValidation } from "@/lib/clinic/payment-validation";
import {
  receiptDateOlderThanBooking,
  resolveCobroReceiptFields,
} from "@/lib/clinic/cobros-receipt";

const APPOINTMENT_STATUS_PRIORITY: Record<string, number> = {
  in_consultation: 0,
  waiting: 1,
  scheduled: 2,
  completed: 3,
};

function dedupeDoctorAppointments<
  T extends { patientId: string; scheduledAt: string; status: string },
>(appointments: T[]): T[] {
  const bySlot = new Map<string, T>();
  for (const apt of appointments) {
    const key = `${apt.patientId}-${slotKeyFromIso(apt.scheduledAt)}`;
    const existing = bySlot.get(key);
    if (!existing) {
      bySlot.set(key, apt);
      continue;
    }
    const aptPriority = APPOINTMENT_STATUS_PRIORITY[apt.status] ?? 9;
    const existingPriority = APPOINTMENT_STATUS_PRIORITY[existing.status] ?? 9;
    if (aptPriority < existingPriority) {
      bySlot.set(key, apt);
    }
  }
  return Array.from(bySlot.values());
}

/** GET /api/clinic/appointments en CLINIC_MODE=local (JSON). */
export async function handleAppointmentsGetLocal(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const patientId = searchParams.get("patientId");
  const token = searchParams.get("token");
  const db = await readDb();

  if (token) {
    const apt = db.appointments.find((a) => a.accessToken === token);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    const patient = db.patients.find((p) => p.id === apt.patientId);
    const doctor = db.doctors.find((d) => d.id === apt.doctorId);
    const waiting = db.appointments.filter(
      (a) =>
        a.doctorId === apt.doctorId &&
        ["waiting", "in_consultation"].includes(a.status),
    ).length;
    const ahead = db.appointments.filter(
      (a) =>
        a.doctorId === apt.doctorId &&
        ["waiting", "in_consultation"].includes(a.status) &&
        a.queuePosition < apt.queuePosition,
    ).length;

    return NextResponse.json({
      appointment: apt,
      patient: patient ? publicPatient(patient) : undefined,
      doctor: doctor ? publicDoctorSummary(doctor) : undefined,
      queuePosition: ahead + 1,
      totalWaiting: waiting,
      strictPaymentValidation: isStrictPaymentValidation(),
      documents: db.documents
        .filter((d) => d.appointmentId === apt.id)
        .map((d) => ({
          id: d.id,
          fileName: d.fileName,
          uploadedAt: d.uploadedAt,
          mimeType: d.mimeType,
          downloadUrl: `/api/clinic/documents?id=${d.id}&download=1&token=${encodeURIComponent(apt.accessToken)}`,
        })),
    });
  }

  const session = await getSessionFromRequest(request);

  if (patientId) {
    if (!requirePatientSession(session, patientId)) {
      return unauthorized();
    }
    const appointments = db.appointments
      .filter((a) => a.patientId === patientId)
      .sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
      )
      .map((apt) => ({
        ...apt,
        doctor: db.doctors.find((d) => d.id === apt.doctorId),
      }));
    return NextResponse.json(appointments);
  }

  if (doctorId) {
    if (!requireDoctorSession(session, doctorId)) {
      return unauthorized();
    }
    const scope = searchParams.get("scope") ?? "upcoming";

    if (scope === "cobros_received") {
      const doctor = db.doctors.find((d) => d.id === doctorId);
      const defaultAmount = doctor?.payment?.consultationFee ?? 0;

      const entries = db.appointments
        .filter(
          (a) =>
            a.doctorId === doctorId &&
            a.paymentStatus === "confirmed" &&
            a.paymentConfirmedAt,
        )
        .sort(
          (a, b) =>
            new Date(b.paymentConfirmedAt!).getTime() -
            new Date(a.paymentConfirmedAt!).getTime(),
        )
        .slice(0, 100)
        .map((apt) => {
          const patient = db.patients.find((p) => p.id === apt.patientId);
          const docs = db.documents.filter((d) => d.appointmentId === apt.id);
          const audit = apt.paymentReceiptAudit;
          const receipt = resolveCobroReceiptFields(apt);
          return {
            id: apt.id,
            patientName: patient?.fullName ?? "Paciente",
            paidAt: apt.paymentConfirmedAt!,
            bookedAt: apt.createdAt,
            scheduledAt: apt.scheduledAt,
            paymentProvider:
              apt.paymentProvider ??
              (apt.mercadopagoPaymentId ? "mercadopago" : "transfer"),
            amount: audit?.amount ?? defaultAmount,
            currency: "ARS" as const,
            receiptTransferDate: receipt.receiptTransferDate,
            receiptTransferTime: receipt.receiptTransferTime,
            operationId: receipt.operationId,
            mercadopagoPaymentId: apt.mercadopagoPaymentId,
            receiptOlderThanBooking: receiptDateOlderThanBooking(
              receipt.receiptTransferDate,
              apt.createdAt,
            ),
            documents: docs.map((d) => ({
              id: d.id,
              fileName: d.fileName,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
          };
        });

      return NextResponse.json({ entries });
    }

    if (scope === "payment_ledger") {
      const entries = db.appointments
        .filter(
          (a) =>
            a.doctorId === doctorId &&
            a.status !== "cancelled" &&
            (a.paymentReceiptAudit ||
              a.paymentStatus === "confirmed" ||
              appointmentNeedsDoctorPaymentReview(a, {
                receiptDocumentCount: db.documents.filter(
                  (d) => d.appointmentId === a.id,
                ).length,
              })),
        )
        .sort((a, b) => {
          const aReview = appointmentNeedsDoctorPaymentReview(a) ? 1 : 0;
          const bReview = appointmentNeedsDoctorPaymentReview(b) ? 1 : 0;
          if (aReview !== bReview) return bReview - aReview;
          return (
            new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
          );
        })
        .slice(0, 50)
        .map((apt) => {
          const patient = db.patients.find((p) => p.id === apt.patientId);
          const docs = db.documents.filter((d) => d.appointmentId === apt.id);
          return {
            id: apt.id,
            scheduledAt: apt.scheduledAt,
            patientName: patient?.fullName ?? "Paciente",
            paymentStatus: apt.paymentStatus,
            paymentProvider: apt.paymentProvider,
            audit: apt.paymentReceiptAudit,
            needsReview: appointmentNeedsDoctorPaymentReview(apt, {
              receiptDocumentCount: docs.length,
            }),
            documents: docs.map((d) => ({
              id: d.id,
              fileName: d.fileName,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
          };
        });
      return NextResponse.json({ entries });
    }

    if (scope === "pending_payment") {
      const pending = db.appointments
        .filter((a) => {
          const docCount = db.documents.filter(
            (d) => d.appointmentId === a.id,
          ).length;
          return (
            a.doctorId === doctorId &&
            appointmentNeedsDoctorPaymentReview(a, {
              receiptDocumentCount: docCount,
            })
          );
        })
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
        )
        .map((apt) => {
          const patient = db.patients.find((p) => p.id === apt.patientId);
          const docs = db.documents.filter((d) => d.appointmentId === apt.id);
          return {
            id: apt.id,
            scheduledAt: apt.scheduledAt,
            status: apt.status,
            paymentStatus: apt.paymentStatus,
            paymentProvider: apt.paymentProvider,
            paymentReceiptAudit: apt.paymentReceiptAudit,
            intakeReason: apt.intakeReason,
            patient: patient ? publicPatient(patient) : undefined,
            documentCount: docs.length,
            documents: docs.map((d) => ({
              id: d.id,
              fileName: d.fileName,
              uploadedAt: d.uploadedAt,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
          };
        });
      return NextResponse.json(pending);
    }

    const doctor = db.doctors.find((d) => d.id === doctorId);
    const availability = doctor?.availability ?? DEFAULT_AVAILABILITY;
    const todayKey = localDateKeyFromDate(new Date());
    const horizonKey = addDaysToDateKey(todayKey, 60);

    let allowedDates: Set<string> | null = null;
    if (scope === "today" || scope === "active") {
      allowedDates = new Set([todayKey]);
    }

    const filtered = db.appointments.filter((a) => {
      if (a.doctorId !== doctorId) return false;
      if (a.status === "cancelled") return false;
      const dateKey = localDateKeyFromIso(a.scheduledAt);
      if (allowedDates) {
        if (!allowedDates.has(dateKey)) return false;
      } else if (scope === "upcoming") {
        if (dateKey < todayKey || dateKey > horizonKey) return false;
      }
      const avail = doctor?.availability ?? DEFAULT_AVAILABILITY;
      if (!appointmentMatchesScheduleGrid(a.scheduledAt, avail)) {
        return false;
      }
      if (scope === "active") {
        return (
          ["scheduled", "waiting", "in_consultation"].includes(a.status) &&
          isPaymentConfirmed(a)
        );
      }
      if (scope === "upcoming") {
        return isPaymentConfirmed(a);
      }
      return true;
    });

    const appointments = dedupeDoctorAppointments(filtered)
      .sort((a, b) => {
        const timeDiff =
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        const statusOrder = (s: string) => {
          if (s === "in_consultation") return 0;
          if (s === "waiting") return 1;
          if (s === "scheduled") return 2;
          if (s === "completed") return 3;
          return 4;
        };
        return statusOrder(a.status) - statusOrder(b.status);
      })
      .map((apt) => {
        const patient = db.patients.find((p) => p.id === apt.patientId);
        const aptDocs = db.documents.filter((d) => d.appointmentId === apt.id);
        const recordCount = db.clinicalRecords.filter(
          (r) => r.patientId === apt.patientId,
        ).length;
        return {
          ...apt,
          patient: patient
            ? {
                id: patient.id,
                fullName: patient.fullName,
                email: patient.email,
                phone: patient.phone,
                profilePhotoData: patient.profilePhotoData,
              }
            : undefined,
          documentCount: aptDocs.length,
          clinicalRecordCount: recordCount,
          hasNewDocuments: aptDocs.length > 0,
        };
      });

    return NextResponse.json(appointments);
  }

  return NextResponse.json({ error: "Parámetro requerido" }, { status: 400 });
}
