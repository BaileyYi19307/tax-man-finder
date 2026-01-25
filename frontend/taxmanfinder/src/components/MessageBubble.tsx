//given a message, display it 
type MessageBubbleProps = {
    text:string;
    isMine:boolean;
}

export default function MessageBubble({text,isMine}:MessageBubbleProps){

    //checks the message sender and chooses either the left or right layout 
    return(
        <div style={{display:"flex", justifyContent: isMine? "flex-end":"flex-start",}}
        >
            <div>
                {text}
            </div>
        </div>
    );

}