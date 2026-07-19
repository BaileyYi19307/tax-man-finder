import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

type Service = {
  id: number;
  name: string;
  description: string;
  pricing_type: "fixed" | "hourly" | "consultation_required";
  indicative_price: string | null;
  accountant: number;
};

function formatServicePrice(service: Pick<Service, "pricing_type" | "indicative_price">) {
  if (service.pricing_type === "consultation_required") {
    return "Consultation required";
  }
  if (service.indicative_price == null || service.indicative_price === "") {
    return "Price on request";
  }
  if (service.pricing_type === "hourly") {
    return `$${service.indicative_price}/hr`;
  }
  return `$${service.indicative_price}`;
}

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 820,
  margin: "0 auto",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

const muted = { color: "#6b7280" };

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //booking form
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingName, setBookingName]= useState("");
  const [bookingDate, setBookingDate]= useState("");

  const token = localStorage.getItem("access_token");
  console.log("the token currently is", token);

  useEffect(() => {
    async function getService(){
      try{
        let response = await axios.get(`http://127.0.0.1:8000/services/${serviceId}/`);
        setService(response.data);
      }
      catch(error){
        console.log("erorr is",error);
      }
    }
    getService(); 
  }
  , [serviceId])


  async function contactAccountant() {
    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/inquiries/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ service: Number(serviceId) }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      // API returns inquiry_id (conversation_id was a frontend mismatch)
      navigate(`/chat/${data.inquiry_id}`);
    } catch (e: any) {
      setError("Could not start chat. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }


  async function createBookingRequest(){
    //issue a post request to the backend
    //which user is viewing the service right now
    //which accountant are they referring to?
    //which service is being viewed right now 
    //have service 
    //get the accountant from the service 
    //get the current user 

    // if (token){
    //   const decoded = jwtDecode(token);
    //   console.log("the user id is", userId);

    // }


    if (!token){
      navigate("/login");
      return; 
    }

    //make data payload for backend 
    const data = {
      name:bookingName, date:bookingDate, service: serviceId,
    }
  
    try{
        const res = await fetch("http://127.0.0.1:8000/bookings/create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
     });

     if (!res.ok) throw new Error(await res.text())

      const text = await res.text();
      console.log(res.status, text);
      console.log("booking created", data);
      setShowBookingForm(false);
    }
    catch(error){
      console.log("erorr is", error);
    }
  }


  if (!service) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={page}>
      <div style={container}>
        <div style={{ marginBottom: 12 }}>
          <Link
            to="/services"
            style={{
              fontSize: 13,
              textDecoration: "none",
              color: "#2563eb",
              fontWeight: 600,
            }}
          >
            ← Back to services
          </Link>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>
              {service.name}
            </div>

            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#111827",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                padding: "6px 10px",
                borderRadius: 999,
                height: "fit-content",
                whiteSpace: "nowrap",
              }}
            >
              {formatServicePrice(service)}
            </div>
          </div>

          <div style={{ ...muted, marginTop: 10, lineHeight: 1.6, fontSize: 14 }}>
            {service.description}
          </div>

          {error && (
            <div
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: 10,
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button
              onClick={contactAccountant}
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: loading ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Starting chat..." : "Message accountant"}
            </button>

            <button
              onClick = {()=>setShowBookingForm(true)}
              >
                Request Consultation
              </button>

            <Link
              to="/chat"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#111827",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Go to inbox
            </Link>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, ...muted }}>
            Clicking “Contact accountant” creates an inquiry and opens a chat.
          </div>

          {showBookingForm && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}
  >
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        width: "100%",
        maxWidth: 420,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Request Consultation</h3>

      <label>
        Name
        <input
          value={bookingName}
          onChange={(e) => setBookingName(e.target.value)}
          placeholder={service.name}
          style={{ width: "100%", marginTop: 6, marginBottom: 12 }}
        />
      </label>

      <label>
        Date and time
        <input
          type="datetime-local"
          value={bookingDate}
          onChange={(e) => setBookingDate(e.target.value)}
          style={{ width: "100%", marginTop: 6, marginBottom: 16 }}
        />
      </label>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={() => setShowBookingForm(false)}>
          Cancel
        </button>

        <button onClick={createBookingRequest} disabled={!bookingDate}>
         Submit Request
        </button>
      </div>
    </div>
  </div>
)}
        </div>
      </div>
    </div>
  );
}
