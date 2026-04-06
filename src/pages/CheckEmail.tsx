import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CheckEmail() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-10 w-10 text-primary animate-bounce" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground text-lg">
            We've sent a verification link to your inbox. Please click it to activate your account.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => window.open("https://mail.google.com", "_blank")}
          >
            Open Gmail
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full gap-2"
            onClick={() => navigate("/auth")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Didn't receive the email? Check your spam folder or wait a few minutes.
        </p>
      </div>
    </div>
  );
}