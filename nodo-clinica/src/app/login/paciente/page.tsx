import { redirect } from "next/navigation";

export default function LoginPacientePage() {
  redirect("/login?role=paciente");
}
