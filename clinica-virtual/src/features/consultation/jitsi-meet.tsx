import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { Button } from "@nodocore/shared-components";
import { Video, VideoOff } from "lucide-react";

interface JitsiMeetProps {
  roomName: string;
  displayName: string;
  onMeetingEnd?: () => void;
  height?: number;
  endScreen?: ReactNode;
  /** Enables virtual consultorio background (recommended for the doctor). */
  enableConsultorioBackground?: boolean;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: Record<string, unknown>,
    ) => JitsiExternalApi;
  }
}

interface JitsiExternalApi {
  dispose: () => void;
  addListener: (event: string, callback: (...args: unknown[]) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
}

export function JitsiMeet({
  roomName,
  displayName,
  onMeetingEnd,
  height = 480,
  endScreen,
  enableConsultorioBackground = false,
}: JitsiMeetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiExternalApi | null>(null);
  const onMeetingEndRef = useRef(onMeetingEnd);
  const endedRef = useRef(false);
  const [ended, setEnded] = useState(false);
  const [joined, setJoined] = useState(false);

  onMeetingEndRef.current = onMeetingEnd;

  const cleanup = useCallback(() => {
    if (apiRef.current) {
      try {
        apiRef.current.dispose();
      } catch {
        /* already disposed */
      }
      apiRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
    setJoined(false);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !roomName || ended) return;

    const domain =
      (import.meta.env.VITE_JITSI_DOMAIN as string | undefined) ?? "meet.jit.si";

    const handleEnd = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      cleanup();
      onMeetingEndRef.current?.();
    };

    const toolbarButtons = [
      "microphone",
      "camera",
      "desktop",
      "fullscreen",
      "hangup",
    ];

    const loadJitsi = () => {
      if (!window.JitsiMeetExternalAPI || !containerRef.current) return;

      cleanup();

      apiRef.current = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: true,
          disableDeepLinking: true,
          enableWelcomePage: false,
          disableInviteFunctions: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          TOOLBAR_BUTTONS: toolbarButtons,
          MOBILE_APP_PROMO: false,
        },
      });

      apiRef.current.addListener("readyToClose", handleEnd);
      apiRef.current.addListener("videoConferenceLeft", handleEnd);

      if (enableConsultorioBackground) {
        apiRef.current.addListener("videoConferenceJoined", () => {
          setJoined(true);
        });
      }
    };

    if (window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      const script = document.createElement("script");
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = loadJitsi;
      document.body.appendChild(script);
    }

    return () => {
      cleanup();
    };
  }, [roomName, displayName, ended, cleanup, enableConsultorioBackground]);

  // Suppress unused variable warning for `joined` — it's available for future use
  void joined;

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Video className="h-4 w-4 text-brand" />
          Videoconsulta
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {ended ? (
          endScreen ?? (
            <div
              className="flex flex-col items-center justify-center bg-slate-100 text-slate-500"
              style={{ height }}
            >
              <VideoOff className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Videollamada finalizada</p>
            </div>
          )
        ) : (
          <div
            ref={containerRef}
            className="w-full bg-slate-900"
            style={{ height }}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ConsultationEndScreen({
  role,
  doctorName,
  autoRedirectSeconds = 0,
  onReturn,
}: {
  role: "doctor" | "patient";
  doctorName?: string;
  autoRedirectSeconds?: number;
  onReturn?: () => void;
}) {
  useEffect(() => {
    if (autoRedirectSeconds > 0) {
      const timer = setTimeout(() => {
        window.location.href = role === "patient" ? "/clinica/paciente" : "/clinica/medico";
      }, autoRedirectSeconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [autoRedirectSeconds, role]);

  return (
    <div className="flex flex-col items-center justify-center bg-slate-100 py-12 gap-4">
      <VideoOff className="h-12 w-12 text-slate-400" />
      <p className="font-semibold text-slate-700">
        {role === "patient"
          ? `Consulta finalizada${doctorName ? ` con Dr/a. ${doctorName}` : ""}`
          : "Videoconsulta finalizada"}
      </p>
      {onReturn && (
        <Button variant="outline" size="sm" onClick={onReturn}>
          Volver al panel
        </Button>
      )}
    </div>
  );
}
