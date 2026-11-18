import { Suspense } from "react";
import { ValidateEmailScreen } from "@/components/auth/validate-email-screen";

export default function ValidateEmailPage() {
  return (
    <Suspense>
      <ValidateEmailScreen />
    </Suspense>
  );
}
