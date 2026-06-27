import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initNotifications } from "@/lib/notifications";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    void initNotifications();
    GoogleAuth.initialize({
      clientId: "398912678802-dsfkg3tfkjbkg3d9jpspg1hmv97a5rhu.apps.googleusercontent.com",
      scopes: ["profile", "email", "https://www.googleapis.com/auth/drive.appdata"],
      grantOfflineAccess: true,
    });
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );

};

export default App;
