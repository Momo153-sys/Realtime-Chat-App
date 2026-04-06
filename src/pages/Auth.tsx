import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle } from "lucide-react";
import { account, databases, ID, Query } from '../lib/appwrite'; // Added databases
import { toast } from "sonner";

// Ensure these match your Appwrite Console exactly
const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || "69c46802000207e473ff";
const PROFILES_COL_ID = import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID || "profiles";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      if (isLogin) {
        // 1. Create the session
        const session = await account.createEmailPasswordSession(email, password);
        
        // 2. Show success immediately
        toast.success("Welcome back!");
        // 3. Redirect
        setTimeout(() => navigate("/"), 100);
        
        // 4. Try to update presence, but don't let it "break" the login if it fails
        databases.updateDocument(DB_ID, PROFILES_COL_ID, session.userId, {
          is_online: true,
          last_seen: new Date().toISOString()
        }).catch(err => console.warn("Background presence update failed:", err));
        
      }else {
        // --- SIGNUP FLOW ---
        setLoading(true);
        try {
          // 1. CHECK IF USERNAME EXISTS FIRST
          // This prevents creating an Auth account if the username is already taken
          const existingUsername = await databases.listDocuments(
            DB_ID,
            PROFILES_COL_ID,
            [Query.equal("username", username)]
          );
      
          if (existingUsername.total > 0) {
            toast.error("Username is already taken. Please choose another one.");
            setLoading(false);
            return; // Stop the signup process here
          }
      
          // 2. Create the Auth Account
          const newAccount = await account.create(ID.unique(), email, password, username);
          
          // 3. Create the Profile Document
          // Using newAccount.$id as the Document ID ensures 1:1 mapping
          await databases.createDocument(
            DB_ID,
            PROFILES_COL_ID,
            newAccount.$id, 
            {
              username: username,
              is_online: true,
              joined_date: new Date().toISOString(),
              last_seen: new Date().toISOString()
            }
          );
      
          // 4. Create Session and Send Verification
          await account.createEmailPasswordSession(email, password);
          await account.createVerification(`${window.location.origin}/verify`);
          
          toast.success("Account created! Check your email.");
          navigate("/check-email");
      
        } catch (error: any) {
          toast.error(error.message || "An error occurred");
        } finally {
          setLoading(false);
        }
      }
    } catch (error: any) {
      // If anything fails (e.g., email already exists), it stops here
      toast.error(error.message || "An error occurred");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Join the conversation today
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;