import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle } from "lucide-react";
import { account, databases, ID, Query } from "../lib/appwrite";
import { toast } from "sonner";
import { useAuth } from "@/hooks/userAuth";

const DB_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "69c46802000207e473ff";
const PROFILES_COL_ID =
  import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID || "profiles";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { refreshUser } = useAuth(); // ✅ IMPORTANT FIX

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;
    setLoading(true);

    try {
      if (isLogin) {
        // ======================
        // ✅ LOGIN FLOW
        // ======================

        await account.createEmailPasswordSession(email, password);

        await refreshUser(); // 🔥 CRITICAL FIX (sync state immediately)

        toast.success("Welcome back!");
        navigate("/");

      } else {
        // ======================
        // ✅ SIGNUP FLOW
        // ======================

        const normalizedUsername = username.trim().toLowerCase();

        if (normalizedUsername.length < 3) {
          toast.error("Username must be at least 3 characters");
          return;
        }

        // 1. Check if username exists
        const existing = await databases.listDocuments(
          DB_ID,
          PROFILES_COL_ID,
          [Query.equal("username", normalizedUsername)]
        );

        if (existing.total > 0) {
          toast.error("Username already taken");
          return;
        }

        // 2. Create auth account
        const newAccount = await account.create(
          ID.unique(),
          email,
          password
        );

        // 3. Create profile
        try {
          await databases.createDocument(
            DB_ID,
            PROFILES_COL_ID,
            newAccount.$id,
            {
              username: normalizedUsername,
              is_online: true,
              joined_date: new Date().toISOString(),
              last_seen: new Date().toISOString(),
            }
          );
        } catch (profileError) {
          console.error("Profile creation failed:", profileError);
          toast.error("Failed to create profile. Try again.");
          return;
        }

        // 4. Create session
        await account.createEmailPasswordSession(email, password);

        // 5. Sync auth state
        await refreshUser(); // 🔥 CRITICAL FIX

      // 6. Notify User 

        toast.success("Request sent! Mohamed (App Owner) has been notified and will confirm your account shortly.", {
  duration: 6000, // Give them more time to read the specific instructions
});
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Header */}
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

        {/* Form */}
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
            {loading
              ? "Loading..."
              : isLogin
              ? "Sign In"
              : "Sign Up"}
          </Button>
        </form>

        {/* Toggle */}
        <p className="text-center text-sm text-muted-foreground">
          {isLogin
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
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
