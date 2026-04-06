import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { client, databases, ID, Query } from "@/lib/appwrite";
import { useAuth } from "@/hooks/userAuth";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Models, RealtimeResponseEvent } from "appwrite";

const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || "69c46802000207e473ff";
const MSGS_COL_ID = import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID || "messages";
const PROFILES_COL_ID = import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID || "profiles";
const SETTINGS_COL_ID = import.meta.env.VITE_APPWRITE_SETTINGS_COLLECTION_ID || "member_settings";

interface MessageDocument extends Models.Document {
  content: string;
  sender_id: string;
  conversation_id: string;
  sent_at: string;
}

interface ProfileDocument extends Models.Document {
  username: string;
  is_online: boolean;
  last_seen: string;
}

const ChatRoom = () => {
  const { id: conversationId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth(); 
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<MessageDocument[]>([]);
  const [otherUser, setOtherUser] = useState<ProfileDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const lastSyncedId = useRef<string | null>(null);

  // --- Mark as Read Logic ---
  useEffect(() => {
    let isMounted = true;
    const markAsRead = async () => {
      if (authLoading || !conversationId || !user?.$id || lastSyncedId.current === conversationId) return;

      try {
        lastSyncedId.current = conversationId;
        const existing = await databases.listDocuments(DB_ID, SETTINGS_COL_ID, [
          Query.equal("user_id", user.$id),
          Query.equal("conversation_id", conversationId)
        ]);

        if (!isMounted) return;

        const now = new Date().toISOString();
        if (existing.total > 0) {
          await databases.updateDocument(DB_ID, SETTINGS_COL_ID, existing.documents[0].$id, {
            last_read_at: now
          });
        } else {
          await databases.createDocument(DB_ID, SETTINGS_COL_ID, ID.unique(), {
            user_id: user.$id,
            conversation_id: conversationId,
            last_read_at: now
          });
        }
      } catch (error) {
        console.error("Failed to mark chat as read:", error);
      }
    };

    markAsRead();
    return () => { isMounted = false; };
  }, [conversationId, user?.$id, authLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // --- Realtime & Data Fetching ---
  useEffect(() => {
    if (authLoading || !conversationId || !user?.$id) return;

    let unsubscribe: (() => void) | undefined;
    let isMounted = true;

    const fetchDataAndSubscribe = async () => {
      try {
        const userIds = conversationId.split("_");
        if (userIds.length < 2) return;
        const otherUserId = userIds.find((id) => id !== user.$id);

        if (otherUserId) {
          const profile = await databases.getDocument(DB_ID, PROFILES_COL_ID, otherUserId);
          if (isMounted) setOtherUser(profile as unknown as ProfileDocument);
        }

        const msgRes = await databases.listDocuments(DB_ID, MSGS_COL_ID, [
          Query.equal("conversation_id", conversationId),
          Query.orderAsc("sent_at"),
          Query.limit(100),
        ]);
        
        if (isMounted) {
          setMessages(msgRes.documents as unknown as MessageDocument[]);
          setLoading(false);

          // Only subscribe after initial data is loaded and component is still mounted
          unsubscribe = client.subscribe(
            `databases.${DB_ID}.collections.${MSGS_COL_ID}.documents`,
            (response: RealtimeResponseEvent<MessageDocument>) => {
              const payload = response.payload;
              const isNewMessage = response.events.some((e) => e.includes("create"));

              if (isNewMessage && payload.conversation_id === conversationId) {
                setMessages((prev) => {
                  if (prev.find((m) => m.$id === payload.$id)) return prev;
                  return [...prev, payload];
                });
              }
            }
          );
        }
      } catch (error) {
        console.error("ChatRoom Init Error:", error);
        if (isMounted) setLoading(false);
      }
    };

    fetchDataAndSubscribe();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [conversationId, user?.$id, authLoading]);

  const handleSend = async (text: string) => {
    if (!user?.$id || !conversationId) return;

    try {
      await databases.createDocument(DB_ID, MSGS_COL_ID, ID.unique(), {
        content: text,
        sender_id: user.$id,
        conversation_id: conversationId,
        sent_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Send Error:", error.message);
    }
  };

  if (authLoading) return <div className="p-8 text-center text-muted-foreground font-medium">Authenticating...</div>;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-background border-x border-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {otherUser && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/20 uppercase">
                {otherUser.username?.slice(0, 2) || "??"}
              </div>
              <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${otherUser.is_online ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-muted-foreground/40"}`} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">{otherUser.username}</h1>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                {otherUser.is_online ? "Active Now" : "Offline"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Loading history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm text-center px-12 gap-3">
             <div className="p-3 bg-muted rounded-full">👋</div>
             <p>No messages here yet.<br/>Break the ice and send a message!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.$id}
                message={{
                  id: msg.$id,
                  text: msg.content,
                  sender: msg.sender_id === user?.$id ? "user" : "other",
                  timestamp: new Date(msg.sent_at),
                  senderName: msg.sender_id !== user?.$id ? otherUser?.username : undefined,
                }}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} />
    </div>
  );
};

export default ChatRoom;
