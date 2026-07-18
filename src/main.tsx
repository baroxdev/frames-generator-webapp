import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App.tsx";
import { AuthSessionSync } from "./components/auth/AuthSessionSync.tsx";
import { AccountPage } from "./pages/auth/AccountPage.tsx";
import { AuthConfirmPage } from "./pages/auth/AuthConfirmPage.tsx";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage.tsx";
import { LoginPage } from "./pages/auth/LoginPage.tsx";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage.tsx";
import { SignUpPage } from "./pages/auth/SignUpPage.tsx";
import { CampaignSubmissionsPage } from "./pages/campaigns/CampaignSubmissionsPage.tsx";
import { CampaignsPage } from "./pages/campaigns/CampaignsPage.tsx";
import { EditCampaignLayoutPage } from "./pages/campaigns/EditCampaignLayoutPage.tsx";
import { NewCampaignPage } from "./pages/campaigns/NewCampaignPage.tsx";
import { CampaignPublicPage } from "./pages/public/CampaignPublicPage.tsx";
import { NotFoundPage } from "./pages/public/NotFoundPage.tsx";
import "./index.css";

// Single QueryClient for the whole app. Every later ticket's queries/
// mutations reuse this instance via QueryClientProvider rather than
// creating their own.
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthSessionSync />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/confirm" element={<AuthConfirmPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/new" element={<NewCampaignPage />} />
          <Route path="/campaigns/:id/edit" element={<EditCampaignLayoutPage />} />
          <Route path="/campaigns/:id/submissions" element={<CampaignSubmissionsPage />} />
          <Route path="/:slug" element={<CampaignPublicPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
