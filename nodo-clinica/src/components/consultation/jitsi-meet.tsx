"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, ImageIcon } from "lucide-react";
import {
  consultorioBackgroundUrl,
  imageUrlToDataUrl,
} from "@/lib/jitsi/virtual-background";

interface JitsiMeetProps {
  roomName: string;
  displayName: string;
  onMeetingEnd?: () => void;
  height?: number;
  endScreen?: ReactNode;
  /** Habilita fondo virtual tipo consultorio (recomendado para el médico). */
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

async function applyConsultorioBackground(api: JitsiExternalApi) {
  try {
    const dataUrl = await imageUrlToDataUrl(consultorioBackgroundUrl());
    api.executeCommand("setVirtualBackground", true, dataUrl);
  } catch {
    /* El médico puede elegir fondo desde la barra de Jitsi */
  }
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
  const [applyingBg, setApplyingBg] = useState(false);

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

    const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.jit.si";
    const bgUrl = consultorioBackgroundUrl();

    const handleEnd = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      cleanup();
      onMeetingEndRef.current?.();
    };

    const loadJitsi = () => {
      if (!window.JitsiMeetExternalAPI || !containerRef.current) return;

      cleanup();

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

      if (enableConsultorioBackground) {
        apiRef.current.addListener("videoConferenceJoined", () => {
          setJoined(true);
          void applyConsultorioBackground(apiRef.current!);
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
        {enableConsultorioBackground && !ended && (
          <p className="text-[11px] text-slate-500 mt-1">
            Se aplica un fondo de consultorio al entrar. También podés usar el
            ícono de fondo en la barra de la videollamada.
          </p>
        )}
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
