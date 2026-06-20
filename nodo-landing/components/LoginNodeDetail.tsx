interface LoginNodeDetailProps {
  description: string;
}

export function LoginNodeDetail({ description }: LoginNodeDetailProps) {
  return (
    <p
      className="max-w-[34em] text-[14.5px] leading-relaxed"
      style={{ color: "rgba(234,240,247,.72)" }}
    >
      {description}
    </p>
  );
}
