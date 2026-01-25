//input field - should do a post after the submission button? 
import { useState } from "react";

export default function MessageInput(){
    const [text,setText] = useState("");

    function handleSubmit(e:React.FormEvent){
        e.preventDefault();

        if (!text.trim()) return;

        console.log("send message:", text);
        setText("");
    }

    return(
        <form onSubmit={handleSubmit}>
            <input type = "text" value ={text} onChange={(e)=> setText(e.target.value)}
            placeholder="Type your message"/>
            <button type="submit"> Send</button>
        </form>
    )
}