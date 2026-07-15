import { Suspense } from "react";
import { LoginPortal } from "@/components/auth/login-portal";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPortal />
    </Suspense>
  );
}
