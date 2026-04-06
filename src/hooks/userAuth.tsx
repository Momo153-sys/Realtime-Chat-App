import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account, databases } from "@/lib/appwrite";
import { Models } from "appwrite";

// Ensure these match your Appwrite Console exactly
const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || "69c46802000207e473ff";
const PROFILES_COL_ID = import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID || "profiles";

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>; // Added to manually trigger a sync
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  const updatePresence = async (userId: string, online: boolean) => {
    try {
      // We only update if a userId is provided to prevent 400 errors
      if (!userId) return;
      await databases.updateDocument(DB_ID, PROFILES_COL_ID, userId, {
        is_online: online,
        last_seen: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Presence update failed (User might be logged out):", error);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
      
      // Update presence to online when we successfully get the user
      if (currentUser.$id) {
        updatePresence(currentUser.$id, true);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  // Presence Heartbeat: Sets offline if they close the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && user?.$id) {
        // Optional: You could set them to "Away" here
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    return () => window.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user?.$id]);

  const signOut = async () => {
    try {
      if (user?.$id) {
        // 1. Set to offline FIRST while the session is still valid
        await updatePresence(user.$id, false);
      }
      // 2. Kill the session
      await account.deleteSession("current");
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};