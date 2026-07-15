import { useEffect, useRef } from "react";

type IncomingMessage = {
  id: number;
  content: string;
  sender_id: number;
  created_at: string;
};

export function useChatSocket(
  inquiryId: number | undefined,
  token: string | null,
  onMessage: (msg: IncomingMessage) => void
) {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!inquiryId || !token) {
      console.log("no inquiry id or token");
      console.log(token);
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
      console.log("WS received:", event.data);
      const data = JSON.parse(event.data);
      onMessageRef.current(data);
    };

    socket.onerror = (e) => {
      console.error("WS error", e);
    };

 socket.onclose = (event) => {
  console.log("WS closed", {
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean,
  });
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

    console.log("sendMessage called with:", text);

    if (!socketRef.current){
      console.log("No socketRef.current");
      return;
    }

    console.log("Socket readyState:", socketRef.current.readyState);
    if (socketRef.current.readyState !== WebSocket.OPEN){
      console.log("Socket is not open");
     return;
    }

      console.log("Actually sending message:", text);

    socketRef.current.send(JSON.stringify({ message: text }));
  }

  return { sendMessage };
}
