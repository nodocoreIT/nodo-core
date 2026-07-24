"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Video, VideoOff, ImageIcon, RotateCcw } from "lucide-react";
import {
  consultorioBackgroundUrl,
  imageUrlToDataUrl,
} from "@/lib/jitsi/virtual-background";
import { clinicApi } from "@/lib/clinic/client-api";

interface JitsiMeetProps {
  roomName: string;
  displayName: string;
  /** Médico = moderador en JaaS */
  isModerator?: boolean;
  /** Token de sala del paciente (sala de espera) */
  accessToken?: string;
  onMeetingEnd?: () => void;
  height?: number;
  endScreen?: ReactNode;
  enableConsultorioBackground?: boolean;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: Record<string, unknown>
    ) => JitsiExternalApi;
  }
}

interface JitsiExternalApi {
  dispose: () => void;
  addListener: (event: string, callback: (...args: unknown[]) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
}

const JAAS_APP_ID = process.env.NEXT_PUBLIC_JAAS_APP_ID?.trim();
const PUBLIC_JITSI_DOMAIN =
  process.env.NEXT_PUBLIC_JITSI_DOMAIN?.trim() || "meet.jit.si";

/** meet.jit.si embebido corta a los 5 min si no usás JaaS (política 8x8). */
const PUBLIC_FALLBACK_DOMAIN = "meet.jit.si";

function loadExternalApiScript(scriptUrl: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.JitsiMeetExternalAPI) return Promise.resolve();

  const existing = document.querySelector(
    `script[data-jitsi-api="${scriptUrl}"]`,
  ) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar Jitsi")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.jitsiApi = scriptUrl;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Jitsi"));
    document.body.appendChild(script);
  });
}

async function applyConsultorioBackground(api: JitsiExternalApi) {
  try {
    const dataUrl = await imageUrlToDataUrl(consultorioBackgroundUrl());
    api.executeCommand("setVirtualBackground", true, dataUrl);
  } catch {
    /* ignore */
  }
}

export function JitsiMeet({
  roomName,
  displayName,
  isModerator = false,
  accessToken,
  onMeetingEnd,
  height = 480,
  endScreen,
  enableConsultorioBackground = false,
}: JitsiMeetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiExternalApi | null>(null);
  const onMeetingEndRef = useRef(onMeetingEnd);
  const endedRef = useRef(false);
  const disposingRef = useRef(false);
  const displayNameRef = useRef(displayName);
  const [ended, setEnded] = useState(false);
  const [joined, setJoined] = useState(false);
  const [applyingBg, setApplyingBg] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingJaas, setUsingJaas] = useState(false);
  const [usingPublicFallback, setUsingPublicFallback] = useState(false);

  onMeetingEndRef.current = onMeetingEnd;
  displayNameRef.current = displayName;

  const cleanup = useCallback((silent = false) => {
    if (!silent) disposingRef.current = true;
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
    // Avoid setState during effect setup/teardown (React 19: "hasn't mounted yet").
    if (!silent) {
      setJoined(false);
    }
    disposingRef.current = false;
  }, []);

  const handleRejoin = useCallback(() => {
    endedRef.current = false;
    setEnded(false);
    setLoadError(null);
    setSessionKey((k) => k + 1);
  }, []);

  const handleApplyBackground = useCallback(async () => {
    if (!apiRef.current) return;
    setApplyingBg(true);
    try {
      await applyConsultorioBackground(apiRef.current);
    } finally {
      setApplyingBg(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !roomName || ended) return;

    let cancelled = false;

    const handleEnd = () => {
      if (disposingRef.current || endedRef.current || cancelled) return;
      endedRef.current = true;
      setEnded(true);
      cleanup(true);
      onMeetingEndRef.current?.();
    };

    const startMeeting = async () => {
      cleanup(true);

      let domain =
        PUBLIC_JITSI_DOMAIN.replace(/^https?:\/\//, "") || PUBLIC_FALLBACK_DOMAIN;
      let fullRoomName = roomName;
      let jwt: string | undefined;
      let scriptSrc = `https://${domain}/external_api.js`;
      let nextUsingJaas = false;
      let nextUsingPublicFallback = false;

      if (JAAS_APP_ID) {
        try {
          const tokenData = await clinicApi.getJitsiToken({
            room: roomName,
            displayName: displayNameRef.current,
            moderator: isModerator,
            accessToken,
          });
          if (cancelled) return;
          domain = tokenData.domain;
          fullRoomName = tokenData.roomName;
          jwt = tokenData.jwt;
          scriptSrc = `https://${domain}/${JAAS_APP_ID}/external_api.js`;
          nextUsingJaas = true;
        } catch {
          // APP_ID en .env pero falta jaasauth.key / JWT → igual dejamos consultar en local.
          domain = PUBLIC_FALLBACK_DOMAIN;
          fullRoomName = roomName;
          jwt = undefined;
          scriptSrc = `https://${PUBLIC_FALLBACK_DOMAIN}/external_api.js`;
          nextUsingPublicFallback = true;
        }
      } else if (domain === "8x8.vc") {
        domain = PUBLIC_FALLBACK_DOMAIN;
        scriptSrc = `https://${PUBLIC_FALLBACK_DOMAIN}/external_api.js`;
        nextUsingPublicFallback = true;
      }

      try {
        await loadExternalApiScript(scriptSrc);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "No se pudo cargar Jitsi",
          );
        }
        return;
      }

      if (!window.JitsiMeetExternalAPI || !containerRef.current || cancelled) return;

      setLoadError(null);
      setUsingJaas(nextUsingJaas);
      setUsingPublicFallback(nextUsingPublicFallback);
      setJoined(false);

      const toolbarButtons = [
        "microphone",
        "camera",
        "desktop",
        "fullscreen",
        "hangup",
        "chat",
      ];
      if (enableConsultorioBackground) {
        toolbarButtons.splice(3, 0, "select-background");
      }

      const bgUrl = consultorioBackgroundUrl();

      apiRef.current = new window.JitsiMeetExternalAPI(domain, {
        roomName: fullRoomName,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName: displayNameRef.current },
        ...(jwt ? { jwt } : {}),
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          // Skip prejoin + lobby so patient/doctor land in the same room without waiting to be admitted.
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          enableLobbyChat: false,
          lobby: { autoKnock: false, enableChat: false },
          requireDisplayName: false,
          disableDeepLinking: true,
          enableWelcomePage: false,
          disableInviteFunctions: true,
          disableVirtualBackground: false,
          ...(enableConsultorioBackground
            ? {
                virtualBackgroundImages: [
                  {
                    src: bgUrl,
                    tooltip: "Consultorio médico",
                  },
                ],
              }
            : {}),
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
      apiRef.current.addListener("videoConferenceJoined", () => {
        if (!cancelled) setJoined(true);
        if (enableConsultorioBackground && apiRef.current) {
          void applyConsultorioBackground(apiRef.current);
        }
      });
    };

    void startMeeting();

    return () => {
      cancelled = true;
      cleanup(true);
    };
  }, [
    roomName,
    ended,
    cleanup,
    enableConsultorioBackground,
    sessionKey,
    isModerator,
    accessToken,
  ]);

  const domainLabel = usingJaas
    ? "JaaS (8x8)"
    : usingPublicFallback
      ? PUBLIC_FALLBACK_DOMAIN
      : PUBLIC_JITSI_DOMAIN;
  const showMeetLimitWarning =
    usingPublicFallback ||
    (!usingJaas &&
      domainLabel.replace(/^https?:\/\//, "") === PUBLIC_FALLBACK_DOMAIN);

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Video className="h-4 w-4 text-blue-600" />
            Videoconsulta
          </CardTitle>
          {enableConsultorioBackground && !ended && joined && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              disabled={applyingBg}
              onClick={() => void handleApplyBackground()}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1" />
              Fondo consultorio
            </Button>
          )}
        </div>
        {showMeetLimitWarning && !ended && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2 flex gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Con <strong>meet.jit.si</strong> embebido, Jitsi corta la llamada
              a los <strong>5 minutos</strong> (política gratuita). Para
              consultas sin límite configurá <strong>JaaS</strong> (falta{" "}
              <code>jaasauth.key</code> o variables JAAS_* — ver JAAS-SETUP.md).
            </span>
          </p>
        )}
        {!usingJaas && !showMeetLimitWarning && !ended && (
          <p className="text-[11px] text-slate-500 mt-1">
            Servidor: {domainLabel}. El médico cierra el turno con
            &quot;Finalizar consulta&quot;.
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loadError ? (
          <div
            className="flex flex-col items-center justify-center bg-red-50 text-red-800 gap-2 p-6 text-center"
            style={{ height }}
          >
            <p className="text-sm font-medium">Error al iniciar videollamada</p>
            <p className="text-xs">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={handleRejoin}>
              Reintentar
            </Button>
          </div>
        ) : ended ? (
          endScreen ?? (
            <div
              className="flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-3"
              style={{ height }}
            >
              <VideoOff className="h-10 w-10 opacity-40" />
              <p className="text-sm">Saliste de la videollamada</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRejoin}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reingresar a la llamada
              </Button>
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
