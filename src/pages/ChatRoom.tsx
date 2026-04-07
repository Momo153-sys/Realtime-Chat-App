import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ID, Query, Models, RealtimeResponseEvent } from "appwrite";
import { databases, client } from "../lib/appwrite"; // <-- Using the shared client!
import { useAuth } from "@/hooks/userAuth";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const MSGS_COL_ID = import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID;
const PROFILES_COL_ID = import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID;

interface MessageDocument extends Models.Document {
  content: string;
  sender_id: string;
  conversation_id: string;
  sent_at: string;
  is_read?: boolean;
  status?: "sent" | "delivered" | "seen";
}

const ChatRoom = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<MessageDocument[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (authLoading || !conversationId || !user?.$id){
      console.log("❌ Missing User ID or Conversation ID", { userId: user?.$id, conversationId });
      return;
    } 

    let isMounted = true;
    let unsubscribe: () => void;

    const initChat = async () => {
      console.log("🚀 initChat started for:", conversationId);
      setLoading(true);
      try {
        // 1. Get other user info
        const userIds = conversationId.split("_");
        const otherUserId = userIds.find((id) => id !== user.$id);
        if (otherUserId && isMounted) {
          const profile = await databases.getDocument(DB_ID, PROFILES_COL_ID, otherUserId);
          setOtherUser(profile);
        }

        // 2. Load existing messages
        const res = await databases.listDocuments(DB_ID, MSGS_COL_ID, [
          Query.equal("conversation_id", conversationId),
          Query.orderAsc("sent_at"),
          Query.limit(100)
        ]);
        
        if (isMounted) {
          setMessages(res.documents as MessageDocument[]);
          console.log("✅ Messages received:", res.documents.length);
          setLoading(false);
          setTimeout(scrollToBottom, 100);
        }

        // 3. Start Realtime Subscription ONLY after data is fetched safely
        unsubscribe = client.subscribe(
          `databases.${DB_ID}.collections.${MSGS_COL_ID}.documents`,
          (response: RealtimeResponseEvent<MessageDocument>) => {
            if (!isMounted) return;
            const payload = response.payload;
            
            if (payload.conversation_id !== conversationId) return;

            if (response.events.some(e => e.includes("create"))) {
              setMessages((prev) => {
                if (prev.find(m => m.$id === payload.$id)) return prev;
                return [...prev, payload];
              });
              setTimeout(scrollToBottom, 50);
            }

            if (response.events.some(e => e.includes("update"))) {
              setMessages((prev) => prev.map(m => m.$id === payload.$id ? payload : m));
            }
          }
        );
      } catch (err) {
        console.error("Chat Init Error:", err);
        if (isMounted) setLoading(false);
      }
    };

    initChat();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [conversationId, user?.$id, authLoading]);

  // Handle message sending
  const handleSend = async (text: string) => {
    if (!user?.$id || !conversationId) return;
    try {
      await databases.createDocument(DB_ID, MSGS_COL_ID, ID.unique(), {
        content: text,
        sender_id: user.$id,
        conversation_id: conversationId,
        sent_at: new Date().toISOString(),
        status: "sent",
        is_read: false,
      });
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  if (authLoading) return <div className="p-8 text-center font-medium">Authenticating...</div>;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-background border-x">
      <div className="flex items-center gap-3 px-4 py-4 border-b bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {otherUser && (
          <div>
            <h1 className="text-sm font-bold">{otherUser.username}</h1>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">
              {otherUser.is_online ? "Active Now" : "Offline"}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="text-center text-xs text-muted-foreground">Loading history...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-10">No messages yet. Say hi! 👋</div>
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
                  status: msg.status,
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

