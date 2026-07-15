//get token from localstorage
//fetch bookings
//store in state
//render list

import "../../styles/BookingsPage.css";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Booking = {
  id: number;
  name: string;
  date: string;
  accountant: number;
  accountant_email: string;
  user: number;
  status: number;
  status_label: string;
};

export default function BookingsPage() {
  const token = localStorage.getItem("access_token");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<number | null>(null);
const [bookingToView, setBookingToView] = useState<Booking|null>(null);
const [bookingToEdit,setBookingToEdit] = useState<Booking|null>(null);



  const navigate = useNavigate();

  function handleViewBooking(booking:Booking){
    //store selected booking 
    setBookingToView(booking);
  }
function handleEditBooking(booking:Booking){
    //store selected booking 
    setBookingToEdit(booking);
  }


  async function confirmModifyBooking(bookingId:number){
    if (!token){
        console.log("no token found");
        navigate("/login")
        return; 
    }
    try{
        const res = await axios.patch(
            `http://127.0.0.1:8000/bookings/${bookingId}/`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                },
            }
    );

        //update frontend with booking from backend 
        setBookings((currentBookings)=>(
            currentBookings.map((booking)=>(booking.id===bookingId? res.data:booking))
        ))
        setBookingToEdit(null);
    
    }catch(error){
        console.log("erorr modifying booking",error)

    }
  }


  async function deleteBooking(bookingId:number) {
          if (!token) {
        console.log("no token found");
        navigate("/login");
        return;
      }
    try {

      let res = await axios.delete(
        `http://127.0.0.1:8000/bookings/${bookingId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      //if backend deletion worked, update frontend too
      //keep every booking except for the one that was just deleted
      setBookings((currentBookings) =>
        currentBookings.filter((booking) => booking.id != bookingId),
      );

      setBookingToDelete(null);
    } catch (error) {
      console.log("error deleting booking", error);
      setError("Could not delete booking");
    }
  }

  //fetch bookings on mount
  useEffect(() => {
    async function fetchBookings() {
      try {
        setLoading(true);
        setError(null);
        if (!token) {
          console.log("no token found");
          navigate("/login");
          return;
        }
        let res = await axios.get("http://127.0.0.1:8000/bookings/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("bookings response data:", res.data);
        setBookings(res.data);
      } catch (error) {
        setError("Could not load bookings");
        console.log("error fetching bookings", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBookings();
  }, []);

  if (loading) {
    return <p> Loading your bookings ...</p>;
  }

  if (error) {
    return <p> {error} </p>;
  }
  function formatDate(date: string) {
    return new Date(date).toLocaleString();
  }

  return (
    <div>
      {bookings.length === 0 ? (
        <p>
          {" "}
          You do not have any bookings yet. Browse services to request one.
        </p>
      ) : (
        bookings.map((booking) => (
          <div
            key={booking.id}
            style={{
              border: "1px solid black",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "6px",
            }}
          >
            {" "}
            {booking.name}
            <div> Booking Status: {booking.status_label}</div>
            <div> Booking Date: {formatDate(booking.date)}</div>
            <div>
              {" "}
              Accountant: <span>{booking.accountant_email}</span>
            </div>
            <div style={{ marginTop: "10px" }}>
              <button className="edit-buttons modify"> Modify </button>
              <button className="edit-buttons view"> View </button>
              <button
                className="edit-buttons delete"
                onClick={() => setBookingToDelete(booking.id)}
              >
                {" "}
                Delete{" "}
              </button>
              <button className="edit-buttons message"> Message </button>
              {bookingToDelete === booking.id && (
                <div>
                  <p>Are you sure you want to delete this booking?</p>

                  <button
                    className="edit-buttons"
                    onClick={() => deleteBooking(booking.id)}
                  >
                    {" "}
                    Yes, delete
                  </button>

                  <button
                    className="edit-buttons"
                    onClick={() => setBookingToDelete(null)}
                  >
                    {" "}
                    Cancel{" "}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
