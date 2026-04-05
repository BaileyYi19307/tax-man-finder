//get token from localstorage
//fetch bookings
//store in state
//render list 
import axios from "axios";
import { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";


type Booking ={
    id:number;
    name:string;
    date:string;
    accountant:number;
    accountant_email:string;
    user:number;
    status:number; 
    status_label:string; 
}

export default function BookingsPage(){
    const token = localStorage.getItem("access_token");
    const [bookings,setBookings]=useState<Booking[]>([]);
    const [loading, setLoading]=useState(true);
    const [error, setError]=useState<string|null>(null);
    const navigate=useNavigate();
    
    //fetch bookings on mount
    useEffect(()=>{
        async function fetchBookings(){
            try{
                setLoading(true);
                setError(null);
                if (!token){
                    console.log("no token found");
                    navigate("/login");
                    return; 
                }
                let res = await axios.get("http://127.0.0.1:8000/bookings/mine/",{
                    headers: {Authorization: `Bearer ${token}`}
                })

                setBookings(res.data);
            }
            catch(error){                
                setError("Could not load bookings");
                console.log("error fetching bookings",error)
            }
            finally{
                setLoading(false);
            }
        }

        fetchBookings();

    },[])

    if (loading){
        return <p> Loading your bookings ...</p>
    }

    if (error){
        return <p> {error} </p>
    }
    function formatDate(date:string){
        return new Date(date).toLocaleString();
    }

    return(
        <div>
            {bookings.length===0 ? (
                <p> You do not have any bookings yet. Browse services to request one.</p>
            ): bookings.map((booking)=>(
                <div key ={booking.id} style={{border:"1px solid black",    padding: "10px",
    marginBottom: "10px",
    borderRadius: "6px"}}> {booking.name} 
                <div> Booking Status: {booking.status_label}</div>
                <div> Booking Date: {formatDate(booking.date)}</div> 
                <div> Accountant: <span style={{ color: "#555" }}>{booking.accountant_email}</span></div> 
                </div>
            ))}
           
        </div>
    );

}