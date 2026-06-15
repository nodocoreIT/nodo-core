"use client";

import { create } from "zustand";
import type {
  Appointment,
  ClinicalRecord,
  PatientLifecycleStatus,
  QueuePatient,
  TranscriptionSegment,
} from "@/types";
import { mapAppointmentStatusToLifecycle } from "@/types";

interface ConsultationState {
  doctorId: string | null;
  activeAppointment: Appointment | null;
  queue: QueuePatient[];
  clinicalHistory: ClinicalRecord[];
  transcriptionText: string;
  transcriptionSegments: TranscriptionSegment[];
  clinicalNotes: string;
  isTranscribing: boolean;
  isSavingNotes: boolean;
  lastSavedAt: Date | null;
  notesEditorFocusRequest: number;
  notifications: AppNotification[];

  setDoctorId: (id: string) => void;
  setActiveAppointment: (appointment: Appointment | null) => void;
  setQueue: (queue: QueuePatient[]) => void;
  updatePatientStatus: (
    appointmentId: string,
    status: PatientLifecycleStatus
  ) => void;
  setClinicalHistory: (records: ClinicalRecord[]) => void;
  appendTranscription: (segment: TranscriptionSegment) => void;
  setTranscriptionText: (text: string) => void;
  setClinicalNotes: (notes: string) => void;
  setIsTranscribing: (value: boolean) => void;
  setIsSavingNotes: (value: boolean) => void;
  setLastSavedAt: (date: Date | null) => void;
  requestNotesEditorFocus: () => void;
  addNotification: (notification: Omit<AppNotification, "id" | "read" | "createdAt">) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  getActiveLifecycleStatus: () => PatientLifecycleStatus | null;
  isInConsultation: () => boolean;
  hasActiveSession: () => boolean;
  dismissConsultation: () => void;
}

export interface AppNotification {
  id: string;
  type: "document_upload" | "patient_waiting" | "consultation_end";
  title: string;
  message: string;
  appointmentId?: string;
  read: boolean;
  createdAt: Date;
}

export const useConsultationStore = create<ConsultationState>((set, get) => ({
  doctorId: null,
  activeAppointment: null,
  queue: [],
  clinicalHistory: [],
  transcriptionText: "",
  transcriptionSegments: [],
  clinicalNotes: "",
  isTranscribing: false,
  isSavingNotes: false,
  lastSavedAt: null,
  notesEditorFocusRequest: 0,
  notifications: [],

  setDoctorId: (id) => set({ doctorId: id }),

  setActiveAppointment: (appointment) =>
    set({
      activeAppointment: appointment,
      transcriptionText: "",
      transcriptionSegments: [],
      clinicalNotes: "",
      lastSavedAt: null,
    }),

  setQueue: (queue) => set({ queue }),

  updatePatientStatus: (appointmentId, status) =>
    set((state) => {
      const updatedQueue = state.queue.map((p) =>
        p.appointmentId === appointmentId ? { ...p, status } : p
      );

      let activeAppointment = state.activeAppointment;
      if (status === "en_consulta") {
        const patient = updatedQueue.find((p) => p.appointmentId === appointmentId);
        if (patient && activeAppointment?.id !== appointmentId) {
          activeAppointment = {
            ...state.activeAppointment,
            id: appointmentId,
            patient_id: patient.patientId,
            status: "in_consultation",
          } as Appointment;
        }
      } else if (
        status === "finalizada" &&
        activeAppointment?.id === appointmentId
      ) {
        activeAppointment = {
          ...activeAppointment,
          status: "completed",
        };
      }

      return { queue: updatedQueue, activeAppointment };
    }),

  setClinicalHistory: (records) => set({ clinicalHistory: records }),

  appendTranscription: (segment) =>
    set((state) => ({
      transcriptionSegments: [...state.transcriptionSegments, segment],
      transcriptionText: state.transcriptionText
        ? `${state.transcriptionText}\n${segment.text}`
        : segment.text,
    })),

  setTranscriptionText: (text) => set({ transcriptionText: text }),

  setClinicalNotes: (notes) => set({ clinicalNotes: notes }),

  setIsTranscribing: (value) => set({ isTranscribing: value }),

  setIsSavingNotes: (value) => set({ isSavingNotes: value }),

  setLastSavedAt: (date) => set({ lastSavedAt: date }),

  requestNotesEditorFocus: () =>
    set((state) => ({
      notesEditorFocusRequest: state.notesEditorFocusRequest + 1,
    })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: crypto.randomUUID(),
          read: false,
          createdAt: new Date(),
        },
        ...state.notifications,
      ],
    })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  clearNotifications: () => set({ notifications: [] }),

  getActiveLifecycleStatus: () => {
    const { activeAppointment } = get();
    if (!activeAppointment) return null;
    return mapAppointmentStatusToLifecycle(activeAppointment.status);
  },

  isInConsultation: () => {
    const status = get().getActiveLifecycleStatus();
    return status === "en_consulta";
  },

  hasActiveSession: () => !!get().activeAppointment,

  dismissConsultation: () =>
    set({
      activeAppointment: null,
      transcriptionText: "",
      transcriptionSegments: [],
      clinicalNotes: "",
      lastSavedAt: null,
    }),
}));
