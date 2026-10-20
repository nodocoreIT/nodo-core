import { useState } from "react";
import { Share2, Check, Copy, Link2, Mail } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import type { PropertyRow } from "@/features/properties/hooks/use-properties";
import {
  buildPropertyShareText,
  getPublicPropertyUrl,
  openWhatsAppShare,
} from "@/features/properties/lib/property-share";

interface SharePropertyButtonProps {
  property: PropertyRow;
}

export function SharePropertyButton({ property }: SharePropertyButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const shareToken = (property as PropertyRow & { share_token?: string | null }).share_token;
  const publicUrl = shareToken ? getPublicPropertyUrl(shareToken) : undefined;
  const shareText = buildPropertyShareText(property, { publicUrl });

  async function handleCopyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    setOpen(false);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function handleWhatsApp() {
    openWhatsAppShare(publicUrl ?? shareText);
    setOpen(false);
  }

  async function handleCopyInfo() {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleMail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(property.address)}&body=${encodeURIComponent(shareText)}`;
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Compartir propiedad"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        {copied || linkCopied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        <span className="sr-only">Compartir</span>
      </Button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card p-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          {publicUrl ? (
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <Link2 className="h-4 w-4" />
              Copiar link web
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => void handleCopyInfo()}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <Copy className="h-4 w-4" />
            Copiar info
          </button>
          <button
            type="button"
            onClick={handleMail}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <Mail className="h-4 w-4" />
            Mail
          </button>
        </div>
      ) : null}
    </div>
  );
}
