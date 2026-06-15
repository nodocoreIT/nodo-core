import { redirect } from "next/navigation";
import { isLocalMode } from "@/lib/clinic/config";

export default function AuthLoginRedirect() {
  if (isLocalMode()) {
    redirect("/login");
  }
  redirect("/login");
}
