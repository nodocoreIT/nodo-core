import { redirect } from "next/navigation";

export default async function LoginPacientePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams({ role: "paciente" });
  if (params.next) qs.set("next", params.next);
  redirect(`/login?${qs.toString()}`);
}
