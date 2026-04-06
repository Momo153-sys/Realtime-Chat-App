import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { client, databases, ID, Query } from "@/lib/appwrite";
import { useAuth } from "@/hooks/userAuth";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Models, RealtimeResponseEvent } from "appwrite";

const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const MSGS_COL_ID = import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID;
const PROFILES_COL_ID = import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID;

interface MessageDocument extends Models.Document {
  content: string;
  sender_id: string;
  conversation_id: string;
  sent_at: string;
  status?: "sent" | "delivered" | "seen";
}

interface ProfileDocument extends Models.Document {
  username: string;
  is_online: boolean;
}

const ChatRoom = () => {
  const { id: conversationId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<MessageDocument[]>([]);
  const [otherUser, setOtherUser] = useState<ProfileDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ✅ Reconnect on network restore
  useEffect(() => {
    const handleOnline = () => {
      console.log("Reconnecting...");
      window.location.reload(); // simple and reliable
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // ✅ Fetch initial data
  useEffect(() => {
    if (authLoading || !conversationId || !user?.$id) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const userIds = conversationId.split("_");
        const otherUserId = userIds.find((id) => id !== user.$id);

        if (otherUserId) {
          const profile = await databases.getDocument(
            DB_ID,
            PROFILES_COL_ID,
            otherUserId
          );
          setOtherUser(profile as ProfileDocument);
        }

        const res = await databases.listDocuments(DB_ID, MSGS_COL_ID, [
          Query.equal("conversation_id", conversationId),
          Query.orderAsc("sent_at"),
        ]);

        setMessages(res.documents as MessageDocument[]);
        setTimeout(scrollToBottom, 100);
      } catch (err: any) {
        console.error("Fetch error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [conversationId, user?.$id, authLoading]);

  // ✅ Realtime subscription (SAFE)
  useEffect(() => {
    if (authLoading || !conversationId || !user?.$id) return;

    // prevent duplicate subscriptions
    if (subscriptionRef.current) return;

    const unsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.${MSGS_COL_ID}.documents`,
      async (response: RealtimeResponseEvent<MessageDocument>) => {
        const payload = response.payload;
        const isCreate = response.events.some((e) =>
          e.includes("create")
        );
        const isUpdate = response.events.some((e) =>
          e.includes("update")
        );

        if (payload.conversation_id !== conversationId) return;

        // 🟢 New message
        if (isCreate) {
          setMessages((prev) => {
            if (prev.find((m) => m.$id === payload.$id)) return prev;

            const updated = [...prev, payload];
            setTimeout(scrollToBottom, 50);
            return updated;
          });

          // mark delivered
          if (payload.sender_id !== user.$id) {
            try {
              await databases.updateDocument(
                DB_ID,
                MSGS_COL_ID,
                payload.$id,
                { status: "delivered" }
              );
            } catch {}
          }
        }

        // 🔵 Update message (status changes)
        if (isUpdate) {
          setMessages((prev) =>
            prev.map((m) => (m.$id === payload.$id ? payload : m))
          );
        }
      }
    );

    subscriptionRef.current = unsubscribe;

    return () => {
      try {
        subscriptionRef.current?.();
        subscriptionRef.current = null;
      } catch {
        console.warn("Socket already closed");
      }
    };
  }, [conversationId, user?.$id, authLoading]);

  // ✅ Mark messages as seen
  useEffect(() => {
    if (!user?.$id) return;

    messages.forEach(async (msg) => {
      if (msg.sender_id !== user.$id && msg.status !== "seen") {
        try {
          await databases.updateDocument(DB_ID, MSGS_COL_ID, msg.$id, {
            status: "seen",
          });
        } catch {}
      }
    });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!user?.$id || !conversationId) return;

    try {
      await databases.createDocument(DB_ID, MSGS_COL_ID, ID.unique(), {
        content: text,
        sender_id: user.$id,
        conversation_id: conversationId,
        sent_at: new Date().toISOString(),
        status: "sent",
      });
    } catch (err: any) {
      console.error("Send error:", err.message);
    }
  };

  if (authLoading) {
    return <div className="p-8 text-center">Authenticating...</div>;
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto border-x">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b sticky top-0 bg-white">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft />
        </Button>

        {otherUser && (
          <div>
            <h1 className="font-bold">{otherUser.username}</h1>
            <p className="text-xs text-gray-500">
              {otherUser.is_online ? "Active" : "Offline"}
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div>Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
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
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} />
    </div>
  );
};

export default ChatRoom;

