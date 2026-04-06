import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { account } from "@/lib/appwrite";
import { toast } from "sonner";

export default function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    // Prevent double-firing in development
    if (started.current) return;
    
    const userId = searchParams.get("userId");
    const secret = searchParams.get("secret");

    if (!userId || !secret) {
      toast.error("Invalid verification link");
      navigate("/auth");
      return;
    }

    started.current = true;

    const performVerification = async () => {
      try {
        await account.updateVerification(userId, secret);
        toast.success("Email verified! Welcome to the app.");
        // Small delay to let the user see the success message
        setTimeout(() => navigate("/"), 1000);
      } catch (err: any) {
        toast.error(`Verification failed: ${err.message}`);
        navigate("/auth");
      }
    };

    performVerification();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-sm"></div>
        <div className="text-center space-y-1">
          <p className="text-foreground font-semibold">Confirming your identity</p>
          <p className="text-muted-foreground text-sm">This will only take a moment...</p>
        </div>
      </div>
    </div>
  );
}