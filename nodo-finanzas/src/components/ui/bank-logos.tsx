export function MercadoPagoLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Mercado Pago"
    >
      {/* Oval background */}
      <ellipse cx="40" cy="40" rx="38" ry="38" fill="#009EE3" />
      {/* Handshake simplified */}
      <g fill="white" transform="translate(14, 18)">
        {/* Left hand */}
        <path d="M4 20 C4 14 8 10 13 10 L18 10 L22 14 L16 14 C14 14 12 16 12 18 L12 26 C12 28 10 30 8 30 L4 30 Z" />
        {/* Right hand */}
        <path d="M48 20 C48 14 44 10 39 10 L34 10 L30 14 L36 14 C38 14 40 16 40 18 L40 26 C40 28 42 30 44 30 L48 30 Z" />
        {/* Clasped center */}
        <rect x="18" y="12" width="16" height="6" rx="3" />
        <rect x="18" y="22" width="16" height="6" rx="3" />
      </g>
      {/* mercado */}
      <text x="88" y="34" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="18" fill="#009EE3">mercado</text>
      {/* pago */}
      <text x="88" y="56" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="18" fill="#003087">pago</text>
    </svg>
  );
}

export function SantanderLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Santander"
    >
      {/* Flame symbol */}
      <g transform="translate(4, 4)">
        {/* Base oval */}
        <ellipse cx="30" cy="56" rx="26" ry="12" fill="#EC0000" />
        {/* Flame left */}
        <path
          d="M16 52 C10 40 14 26 20 18 C18 28 22 34 26 38 C24 30 26 20 32 12 C30 24 34 32 38 38 C42 32 40 22 36 14 C44 24 44 40 38 52 Z"
          fill="#EC0000"
        />
      </g>
      {/* Santander text */}
      <text x="70" y="50" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="26" fill="#EC0000">Santander</text>
    </svg>
  );
}
