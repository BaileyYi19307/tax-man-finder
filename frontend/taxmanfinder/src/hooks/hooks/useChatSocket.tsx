import { useEffect, useRef } from "react";

type IncomingMessage = {
  id: number;
  content: string;
  sender_id: number;
  created_at: string;
  attachments?: Array<{
    id: number;
    message_id: number | null;
    uploaded_by_id: number;
    uploaded_by_email: string;
    original_filename: string;
    uploaded_at: string;
  }>;
};

export function useChatSocket(
  inquiryId: number | undefined,
  token: string | null,
  onMessage: (msg: IncomingMessage) => void,
  onClose?: (code: number) => void
) {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!inquiryId || !token) {
      return;
    }

    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/inquiries/${inquiryId}/?token=${token}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WS connected");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data && data.error) return;
      onMessageRef.current(data);
    };

    socket.onerror = (e) => {
      console.error("WS error", e);
    };

    socket.onclose = (event) => {
      onCloseRef.current?.(event.code);
    };

    return () => {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };
  }, [inquiryId, token]);

  function sendMessage(text: string) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify({ message: text }));
    return true;
  }

  return { sendMessage };
}
