import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/userAuth";
import Auth from "./pages/Auth";
import UsersList from "./pages/UsersList";
import ChatRoom from "./pages/ChatRoom";
import NotFound from "./pages/NotFound";
import Verify from "./pages/Verify";
import CheckEmail from "./pages/CheckEmail";
import { Models } from 'appwrite';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background">Loading...</div>;
  
  // 1. If not logged in at all, go to /auth
  if (!user) return <Navigate to="/auth" replace />;

  // 2. Cast to access emailVerification
  const appwriteUser = user as unknown as Models.User<Models.Preferences>;

  // 3. If logged in but NOT verified, go to /check-email
  if (!appwriteUser.emailVerification) {
    return <Navigate to="/check-email" replace />;
  }
  
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  const appwriteUser = user as unknown as Models.User<Models.Preferences>;

  // Only redirect to home if they are logged in AND already verified
  if (user && appwriteUser.emailVerification) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth flow */}
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/check-email" element={<CheckEmail />} />
            <Route path="/verify" element={<Verify />} />

            {/* Protected Chat flow */}
            <Route path="/" element={<ProtectedRoute><UsersList /></ProtectedRoute>} />
            <Route path="/chat/:conversationId" element={<ProtectedRoute><ChatRoom /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;