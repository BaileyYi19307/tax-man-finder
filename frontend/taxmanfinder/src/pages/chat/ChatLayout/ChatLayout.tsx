// /chat should show Inbox + empty state on right 
// /chat/:conversationId should show inbox + conversation view on right 

import { Outlet } from "react-router-dom";
import InboxView from "./InboxView";

export default function ChatLayout() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
    <aside
        style={{
          width: 300,
          borderRight: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        <InboxView />
      </aside>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Outlet />
        {/*  render the child route here */}
      </main>

    </div>
  );
}
