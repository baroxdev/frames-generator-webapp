import { createFileRoute } from "@tanstack/react-router";
import { SignUpPage } from "../pages/auth/SignUpPage";

export const Route = createFileRoute("/signup")({
  ssr: false,
  component: SignUpPage,
});
