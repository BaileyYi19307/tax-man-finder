//should display all the conversations associated with the user id 

import {NavLink} from "react-router-dom";


export default function InboxView(){
    //list all the conversations that the user is part of 
    //how to get the user id then?
    const conversations = [
        {id:"1", name: "Alex"},
        {id: "2", name: "Jamie"},
        {id:"3", name: "Chris"},
    ]

    return(
        <div>
            <h3>Messages</h3>

            <ul>
                {conversations.map((convo)=>(
                    <li key = {convo.id}>
                        <NavLink to= {`/chat/${convo.id}`}>{convo.name}
                        </NavLink>
                    </li>
                ))}
            </ul>

        </div>
    );
}