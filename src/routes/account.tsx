import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "../pages/auth/AccountPage";

export const Route = createFileRoute("/account")({
  ssr: false,
  component: AccountPage,
});
