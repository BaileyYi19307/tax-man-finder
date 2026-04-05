import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

export default function ClientDashboard(){
    const navigate = useNavigate();

    const user_id = localStorage.getItem("user_id");

    //what parts are needed?
    //welcome user, 

    //call to action button 
    return(
        <div> 
            <button style = {{border:"1px solid black"}} onClick = {() => navigate('/services')}> Browse Services </button>
            <p>Client dashboard MVP </p>
            <ul> 
                <Link to={`/bookings`}>
                <li> Your Bookings </li>
                </Link>
            </ul>
        </div>
    );


}