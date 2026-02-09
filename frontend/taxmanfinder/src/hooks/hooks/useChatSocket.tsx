import { useEffect, useRef } from "react";

type IncomingMessage = {
  id: number;
  body: string;
  sender_id: number;
  created_at: string;
};

export function useChatSocket(
  conversationId: number | undefined,
  token: string | null,
  onMessage: (msg: IncomingMessage) => void
) {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!conversationId || !token) return;

    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/conversations/${conversationId}/?token=${token}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WS connected");
    };

    socket.onmessage = (event) => {
      console.log("WS RAW:", event.data);
      const data = JSON.parse(event.data);
      onMessageRef.current(data);
    };

    socket.onerror = (e) => {
      console.error("WS error", e);
    };

    socket.onclose = () => {
      console.log("WS closed");
    };

    return () => {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };
  }, [conversationId, token]);

  function sendMessage(text: string) {
    if (!socketRef.current) return;
    if (socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({ message: text }));
  }

  return { sendMessage };
}
