import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { client, databases, Query } from "@/lib/appwrite";
import { useAuth } from "@/hooks/userAuth";
import { MessageCircle, LogOut, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Models, RealtimeResponseEvent } from "appwrite";

const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || "69c46802000207e473ff";
const PROFILES_COL_ID = import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID || "profiles";
const MESSAGES_COL_ID = import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID || "messages";
const SETTINGS_COL_ID = import.meta.env.VITE_APPWRITE_SETTINGS_COLLECTION_ID || "member_settings";

interface ProfileDocument extends Models.Document {
  username: string;
  is_online: boolean;
  last_seen: string;
}

const UsersList = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { id: activeChatId } = useParams();
  
  const [profiles, setProfiles] = useState<ProfileDocument[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadConversations, setUnreadConversations] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading || !user?.$id) return;

    let unsubProfiles: () => void;
    let unsubMessages: () => void;

    const initData = async () => {
      try {
        // 1. Fetch Profiles
        const profileRes = await databases.listDocuments(DB_ID, PROFILES_COL_ID, [
          Query.notEqual("$id", user.$id),
          Query.orderDesc("is_online"),
          Query.limit(100),
        ]);
        setProfiles(profileRes.documents as unknown as ProfileDocument[]);

        // 2. Initial Load: Check database for unread messages
        // This looks at our 'member_settings' to see what we missed
        const settingsRes = await databases.listDocuments(DB_ID, SETTINGS_COL_ID, [
          Query.equal("user_id", user.$id)
        ]);

        const unreads: string[] = [];
        
        // Check each conversation setting against the latest message in that chat
        for (const setting of settingsRes.documents) {
          const lastMsg = await databases.listDocuments(DB_ID, MESSAGES_COL_ID, [
            Query.equal("conversation_id", setting.conversation_id),
            Query.orderDesc("$createdAt"),
            Query.limit(1)
          ]);

          if (lastMsg.total > 0) {
            const msgTime = new Date(lastMsg.documents[0].$createdAt).getTime();
            const readTime = new Date(setting.last_read_at).getTime();
            
            // If the latest message is newer than our last visit, highlight it
            if (msgTime > readTime && setting.conversation_id !== activeChatId) {
              unreads.push(setting.conversation_id);
            }
          }
        }
        setUnreadConversations(unreads);
      } catch (error) {
        console.error("Init data error:", error);
      } finally {
        setLoading(false);
      }
    };

    initData();

    // Subscription for Status Updates
    unsubProfiles = client.subscribe(
      `databases.${DB_ID}.collections.${PROFILES_COL_ID}.documents`,
      (response: RealtimeResponseEvent<ProfileDocument>) => {
        const payload = response.payload;
        if (payload.$id !== user.$id) {
          setProfiles((prev) => {
            const exists = prev.find((p) => p.$id === payload.$id);
            return exists ? prev.map((p) => (p.$id === payload.$id ? payload : p)) : [payload, ...prev];
          });
        }
      }
    );

    // Subscription for New Messages (Live Highlights)
    unsubMessages = client.subscribe(
      `databases.${DB_ID}.collections.${MESSAGES_COL_ID}.documents`,
      (response) => {
        const newMessage = response.payload as any;
        const isParticipant = newMessage.conversation_id.includes(user.$id);
        const isNotFromMe = newMessage.sender_id !== user.$id;
        const isNotActive = newMessage.conversation_id !== activeChatId;

        if (isParticipant && isNotFromMe && isNotActive) {
          setUnreadConversations((prev) => 
            prev.includes(newMessage.conversation_id) ? prev : [...prev, newMessage.conversation_id]
          );
        }
      }
    );

    return () => {
      if (unsubProfiles) unsubProfiles();
      if (unsubMessages) unsubMessages();
    };
  }, [user?.$id, authLoading, activeChatId]);

  // Clear unread dot LOCALLY when navigation happens
  // The ChatRoom component will handle the database sync separately
  useEffect(() => {
    if (activeChatId) {
      setUnreadConversations((prev) => prev.filter((id) => id !== activeChatId));
    }
  }, [activeChatId]);

  const filtered = useMemo(() => {
    return profiles.filter((p) => (p.username ?? "").toLowerCase().includes(search.toLowerCase()));
  }, [profiles, search]);

  const startConversation = (otherUserId: string) => {
    const conversationId = [user?.$id, otherUserId].sort().join("_");
    navigate(`/chat/${conversationId}`);
  };

  if (authLoading) return <div className="p-8 text-center text-muted-foreground">Verifying...</div>;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-background">
      <div className="flex items-center gap-3 px-5 py-4 border-b">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">Messages</h1>
          <p className="text-xs text-muted-foreground">{profiles.length} contacts</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4 text-destructive" /></Button>
      </div>

      <div className="px-4 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/30" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-muted-foreground">Syncing chats...</p>
          </div>
        ) : filtered.map((profile) => {
          const convId = [user?.$id, profile.$id].sort().join("_");
          const isUnread = unreadConversations.includes(convId);

          return (
            <button
              key={profile.$id}
              onClick={() => startConversation(profile.$id)}
              className={`w-full flex items-center gap-4 px-5 py-4 transition-all border-b border-border/40 group relative ${
                isUnread ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-secondary/20"
              }`}
            >
              <div className="relative">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold border transition-transform group-hover:scale-105 ${
                    isUnread ? "bg-blue-600 text-white border-blue-400" : "bg-primary/5 text-primary border-primary/10"
                }`}>
                  {isUnread ? <Bell className="h-5 w-5 animate-bounce" /> : (profile.username ?? "??").slice(0, 2)}
                </div>
                <div className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background ${
                    profile.is_online ? "bg-green-500" : "bg-muted-foreground/30"
                }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="flex justify-between items-center mb-1">
                  <p className={`text-sm leading-none ${isUnread ? "font-bold text-blue-600" : "font-semibold"}`}>
                    {profile.username}
                  </p>
                  {isUnread && (
                    <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isUnread ? "New message received" : (profile.is_online ? "Active now" : "Offline")}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default UsersList;