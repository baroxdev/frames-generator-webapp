import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "../pages/auth/LoginPage";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});
