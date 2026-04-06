import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import ChatInput from "./ChatInput";
import { MessageCircle } from "lucide-react";

const AUTO_REPLIES = [
  "That's interesting! Tell me more 🤔",
  "I totally agree with you!",
  "Haha, nice one 😄",
  "Can you elaborate on that?",
  "Wow, I hadn't thought of it that way.",
  "That's a great point!",
  "Let me think about that for a sec...",
  "Absolutely! 💯",
  "Hmm, interesting perspective.",
  "I see what you mean!",
];

const ChatWindow = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hey! Welcome to the chat 👋",
      sender: "other",
      timestamp: new Date(Date.now() - 60000),
      senderName: "Alex",
    },
    {
      id: "2",
      text: "Feel free to send a message and I'll reply!",
      sender: "other",
      timestamp: new Date(Date.now() - 30000),
      senderName: "Alex",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = (text: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Simulate reply
    setTimeout(() => {
      const reply: Message = {
        id: crypto.randomUUID(),
        text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
        sender: "other",
        timestamp: new Date(),
        senderName: "Alex",
      };
      setMessages((prev) => [...prev, reply]);
    }, 800 + Math.random() * 1200);
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">Chat Room</h1>
          <p className="text-xs text-muted-foreground">Alex is online</p>
        </div>
        <div className="ml-auto h-2.5 w-2.5 rounded-full bg-online animate-pulse" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} />
    </div>
  );
};

export default ChatWindow;
