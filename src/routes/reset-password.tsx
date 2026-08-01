import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "../pages/auth/ResetPasswordPage";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});
