import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "other";
  timestamp: Date;
  senderName?: string;
  status?: "sent" | "delivered" | "seen"; // NEW
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.sender === "user";

  // Message status icon
  const renderStatus = () => {
    if (!isUser) return null; // Only show for user's messages
    switch (message.status) {
      case "sent":
        return <span className="text-gray-400 ml-1">✓</span>;
      case "delivered":
        return <span className="text-gray-400 ml-1">✓✓</span>;
      case "seen":
        return <span className="text-blue-500 ml-1">✓✓</span>;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("flex w-full mb-3", isUser ? "justify-end" : "justify-start")}
    >
      <div className={cn("max-w-[75%] flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {!isUser && message.senderName && (
          <span className="text-xs text-muted-foreground px-3">{message.senderName}</span>
        )}
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed flex items-end",
            isUser
              ? "bg-chat-sent text-chat-sent-foreground rounded-br-md"
              : "bg-chat-received text-chat-received-foreground rounded-bl-md"
          )}
        >
          {message.text}
          {renderStatus()}
        </div>
        <span className="text-[10px] text-muted-foreground px-3">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
};

export default ChatMessage;
