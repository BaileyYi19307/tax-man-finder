import { useNavigate, Link } from "react-router-dom";

export default function ClientDashboard() {
    const navigate = useNavigate();

    const user_id = localStorage.getItem("user_id");

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "#f7f7f7",
                padding: "48px 24px",
                fontFamily: "Inter, sans-serif",
            }}
        >
            <div
                style={{
                    maxWidth: "900px",
                    margin: "0 auto",
                }}
            >
                <div
                    style={{
                        marginBottom: "32px",
                    }}
                >
                    <h1
                        style={{
                            fontSize: "32px",
                            fontWeight: 700,
                            marginBottom: "8px",
                        }}
                    >
                        Welcome Back
                    </h1>

                    <p
                        style={{
                            color: "#666",
                            fontSize: "16px",
                        }}
                    >
                        Manage bookings, browse tax professionals, and track consultations.
                    </p>
                </div>

                {/* Main CTA */}
                <div
                    style={{
                        backgroundColor: "white",
                        border: "1px solid #e5e5e5",
                        borderRadius: "16px",
                        padding: "32px",
                        marginBottom: "24px",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "22px",
                            marginBottom: "12px",
                        }}
                    >
                        Find a Tax Professional
                    </h2>

                    <p
                        style={{
                            color: "#666",
                            marginBottom: "24px",
                            lineHeight: 1.5,
                        }}
                    >
                        Browse available accountants and request consultations.
                    </p>

                    <button
                        onClick={() => navigate("/services")}
                        style={{
                            padding: "12px 18px",
                            borderRadius: "10px",
                            border: "none",
                            backgroundColor: "black",
                            color: "white",
                            cursor: "pointer",
                            fontSize: "15px",
                            fontWeight: 600,
                        }}
                    >
                        Browse Services
                    </button>
                </div>

                {/* Dashboard Cards */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: "20px",
                    }}
                >
                    {/* Bookings */}
                    <Link
                        to="/bookings"
                        style={{
                            textDecoration: "none",
                            color: "inherit",
                        }}
                    >
                        <div
                            style={{
                                backgroundColor: "white",
                                border: "1px solid #e5e5e5",
                                borderRadius: "16px",
                                padding: "24px",
                                height: "100%",
                                transition: "0.15s ease",
                                cursor: "pointer",
                            }}
                        >
                            <h3
                                style={{
                                    marginBottom: "10px",
                                    fontSize: "18px",
                                }}
                            >
                                Your Bookings
                            </h3>

                            <p
                                style={{
                                    color: "#666",
                                    lineHeight: 1.5,
                                    fontSize: "14px",
                                }}
                            >
                                View upcoming consultations, booking status, and past appointments.
                            </p>
                        </div>
                    </Link>

                    {/* Messages */}
                    <Link
                        to="/chat"
                        style={{
                            textDecoration: "none",
                            color: "inherit",
                        }}
                    >
                        <div
                            style={{
                                backgroundColor: "white",
                                border: "1px solid #e5e5e5",
                                borderRadius: "16px",
                                padding: "24px",
                                height: "100%",
                                cursor: "pointer",
                            }}
                        >
                            <h3
                                style={{
                                    marginBottom: "10px",
                                    fontSize: "18px",
                                }}
                            >
                                Messages
                            </h3>

                            <p
                                style={{
                                    color: "#666",
                                    lineHeight: 1.5,
                                    fontSize: "14px",
                                }}
                            >
                                Continue conversations with accountants and manage inquiries.
                            </p>
                        </div>
                    </Link>

                    {/* Account */}
                    <div
                        style={{
                            backgroundColor: "white",
                            border: "1px solid #e5e5e5",
                            borderRadius: "16px",
                            padding: "24px",
                        }}
                    >
                        <h3
                            style={{
                                marginBottom: "10px",
                                fontSize: "18px",
                            }}
                        >
                            Account
                        </h3>

                        <p
                            style={{
                                color: "#666",
                                lineHeight: 1.5,
                                fontSize: "14px",
                                marginBottom: "16px",
                            }}
                        >
                            Logged in as user:
                        </p>

                        <div
                            style={{
                                backgroundColor: "#f3f3f3",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                fontSize: "13px",
                                wordBreak: "break-all",
                            }}
                        >
                            {user_id || "No user found"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}