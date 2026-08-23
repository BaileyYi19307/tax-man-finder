import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  geocodePlace,
  listPublicAccountants,
  type AccountantProfilePayload,
} from "../../api/client";
import { accountantDisplayName, accountantFirmLocationLine } from "./displayName";
import DirectoryMap, { type SearchMapFocus } from "./DirectoryMap";
import { pinEligibleAccountants } from "./mapPins";

const DEFAULT_RADIUS_MILES = 25;
const RADIUS_OPTIONS = [10, 25, 50, 100];
const SEARCH_ZOOM = 10;
const ACCOUNTANT_ZOOM = 12;

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 1100,
  margin: "0 auto" as const,
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

const muted = { color: "#6b7280" };

function serviceScopeLabel(scope?: string) {
  if (scope === "remote") return "Remote";
  if (scope === "nationwide") return "Nationwide";
  return null;
}

export default function AccountantsDirectory() {
  const [accountants, setAccountants] = useState<AccountantProfilePayload[]>([]);
  const [mapMatches, setMapMatches] = useState<AccountantProfilePayload[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [searchCenter, setSearchCenter] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchFocus, setSearchFocus] = useState<SearchMapFocus | null>(null);
  const searchFocusTokenRef = useRef(0);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const listPaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPublicAccountants()
      .then((rows) => {
        if (!cancelled) {
          setAccountants(rows);
          setError(null);
        }
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setAccountants([]);
          setError("Could not load accountants.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pinAccountants = useMemo(() => {
    if (mapMatches != null) return pinEligibleAccountants(mapMatches);
    return pinEligibleAccountants(accountants);
  }, [accountants, mapMatches]);

  function requestSearchFocus(latitude: number, longitude: number, zoom: number) {
    searchFocusTokenRef.current += 1;
    setSearchFocus({
      latitude,
      longitude,
      zoom,
      token: searchFocusTokenRef.current,
    });
  }

  function selectAccountant(userId: number | null) {
    setSelectedUserId(userId);
  }

  useEffect(() => {
    if (selectedUserId == null) return;
    const el = cardRefs.current[selectedUserId];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedUserId]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const place = await geocodePlace(q);
      const matches = await listPublicAccountants({
        latitude: place.latitude,
        longitude: place.longitude,
        radius_miles: radiusMiles,
      });
      setSearchCenter({
        latitude: place.latitude,
        longitude: place.longitude,
        label: place.display_name,
      });
      setMapMatches(matches);
      setSelectedUserId(null);
      requestSearchFocus(place.latitude, place.longitude, SEARCH_ZOOM);
    } catch (err) {
      console.error(err);
      setSearchError(
        err instanceof Error ? err.message : "Could not search that location."
      );
      setSearchCenter(null);
      setMapMatches(null);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchCenter(null);
    setMapMatches(null);
    setSearchError(null);
    setSelectedUserId(null);
  }

  return (
    <div style={page}>
      <div style={container}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
            ← Home
          </Link>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 12 }}>
            Tax professionals
          </div>
          <div style={{ ...muted, fontSize: 13, marginTop: 4 }}>
            Browse public profiles or search by location.
          </div>
        </div>

        <form
          onSubmit={onSearch}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by location"
            aria-label="Search by location"
            style={{
              flex: "1 1 220px",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
          <label
            style={{
              fontSize: 13,
              color: "#374151",
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            Within
            <select
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              aria-label="Search radius in miles"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            >
              {RADIUS_OPTIONS.map((miles) => (
                <option key={miles} value={miles}>
                  {miles} miles
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={searching}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: searching ? "default" : "pointer",
              fontSize: 13,
            }}
          >
            {searching ? "Searching…" : "Search"}
          </button>
          {searchCenter && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Clear
            </button>
          )}
        </form>
        {searchError && (
          <div style={{ color: "#b91c1c", marginBottom: 12, fontSize: 13 }}>
            {searchError}
          </div>
        )}

        <style>{`
          .directory-split {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          @media (min-width: 900px) {
            .directory-split {
              display: grid;
              grid-template-columns: minmax(280px, 1fr) minmax(340px, 1.1fr);
              gap: 16px;
              align-items: start;
            }
            .directory-list-pane {
              max-height: min(70vh, 560px);
              overflow-y: auto;
            }
          }
        `}</style>

        <div className="directory-split">
          <div className="directory-list-pane" ref={listPaneRef}>
            {error && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</div>}
            {loading && (
              <div style={{ ...muted, fontSize: 14 }}>Loading tax professionals…</div>
            )}
            {!loading && !error && accountants.length === 0 && (
              <div style={{ ...muted, fontSize: 14 }}>
                No tax professionals are listed yet.
              </div>
            )}

            {!loading && accountants.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                {accountants.map((accountant) => {
                  const subtitle = accountantFirmLocationLine(accountant);
                  const scope = serviceScopeLabel(accountant.service_scope);
                  const selected = accountant.user_id === selectedUserId;
                  return (
                    <div
                      key={accountant.user_id}
                      className="interactive-surface"
                      ref={(el) => {
                        cardRefs.current[accountant.user_id] = el;
                      }}
                      onClick={() => selectAccountant(accountant.user_id)}
                      style={{
                        ...card,
                        cursor: "pointer",
                        borderColor: selected ? "#2563eb" : "#e5e7eb",
                        boxShadow: selected
                          ? "0 0 0 2px rgba(37, 99, 235, 0.35)"
                          : card.boxShadow,
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        {accountantDisplayName(accountant)}
                      </div>
                      {subtitle && (
                        <div style={{ ...muted, fontSize: 13, marginTop: 6 }}>
                          {subtitle}
                        </div>
                      )}
                      {scope && (
                        <div style={{ marginTop: 8 }}>
                          <span
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "#ecfdf5",
                              color: "#065f46",
                              border: "1px solid #a7f3d0",
                            }}
                          >
                            {scope}
                          </span>
                        </div>
                      )}
                      <div style={{ ...muted, fontSize: 13, marginTop: 6 }}>
                        {accountant.credentials || "Credentials not listed"}
                      </div>
                      <div
                        style={{
                          color: "#4b5563",
                          fontSize: 13,
                          marginTop: 10,
                          lineHeight: 1.4,
                        }}
                      >
                        {accountant.bio || "No bio yet."}
                      </div>
                      <div style={{ marginTop: 14 }}>
                        <Link
                          to={`/accountants/${accountant.user_id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: "inline-block",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            color: "#111827",
                            textDecoration: "none",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          View profile
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DirectoryMap
            pinAccountants={pinAccountants}
            accountants={accountants}
            searchCenter={
              searchCenter
                ? {
                    latitude: searchCenter.latitude,
                    longitude: searchCenter.longitude,
                  }
                : null
            }
            radiusMiles={radiusMiles}
            selectedUserId={selectedUserId}
            accountantZoom={ACCOUNTANT_ZOOM}
            searchFocus={searchFocus}
            onSelectUserId={selectAccountant}
          />
        </div>
      </div>
    </div>
  );
}
