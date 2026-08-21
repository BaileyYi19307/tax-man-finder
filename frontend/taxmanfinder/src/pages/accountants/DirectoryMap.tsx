import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  useMap,
  Popup,
  Tooltip,
} from "react-leaflet";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import type { AccountantProfilePayload } from "../../api/client";
import { accountantDisplayName } from "./displayName";
import "leaflet/dist/leaflet.css";

export type SearchMapFocus = {
  latitude: number;
  longitude: number;
  zoom: number;
  token: number;
};

type SearchCenter = { latitude: number; longitude: number };

type DirectoryMapProps = {
  pinAccountants: AccountantProfilePayload[];
  accountants: AccountantProfilePayload[];
  searchCenter: SearchCenter | null;
  radiusMiles: number;
  selectedUserId: number | null;
  accountantZoom: number;
  searchFocus: SearchMapFocus | null;
  onSelectUserId: (userId: number | null) => void;
};

const MILES_TO_METERS = 1609.344;
const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];
const HOVER_CLOSE_MS = 280;

function SearchFocusController({ focus }: { focus: SearchMapFocus | null }) {
  const map = useMap();

  useEffect(() => {
    if (!focus) return;
    map.stop();
    map.flyTo([focus.latitude, focus.longitude], focus.zoom, {
      duration: 0.45,
    });
  }, [map, focus?.token, focus?.latitude, focus?.longitude, focus?.zoom]);

  return null;
}

function SelectionFocusController({
  selectedUserId,
  accountants,
  zoom,
}: {
  selectedUserId: number | null;
  accountants: AccountantProfilePayload[];
  zoom: number;
}) {
  const map = useMap();
  const selected = useMemo(
    () => accountants.find((a) => a.user_id === selectedUserId) ?? null,
    [accountants, selectedUserId]
  );

  useEffect(() => {
    if (selectedUserId == null || !selected) return;
    if (selected.latitude == null || selected.longitude == null) return;
    const lat = Number(selected.latitude);
    const lng = Number(selected.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    map.stop();
    map.flyTo([lat, lng], zoom, { duration: 0.45 });
  }, [map, selectedUserId, selected?.latitude, selected?.longitude, zoom]);

  return null;
}

function formatServicePrice(service?: {
  pricing_type?: string;
  indicative_price?: string | null;
}): string | null {
  if (!service) return null;
  const price = service.indicative_price;
  if (service.pricing_type === "consultation_required") {
    return "Consultation required";
  }
  if (!price) return null;
  if (service.pricing_type === "hourly") return `From $${price}/hr`;
  return `From $${price}`;
}

function AccountantPreviewCard({
  accountant,
  showClose,
  onClose,
  onViewProfile,
}: {
  accountant: AccountantProfilePayload;
  showClose?: boolean;
  onClose?: () => void;
  onViewProfile?: () => void;
}) {
  const name = accountantDisplayName(accountant);
  const firm = (accountant.firm_name || "").trim();
  const location = (accountant.location || "").trim();
  const credentials = (accountant.credentials || "").trim();
  const scope =
    accountant.service_scope === "remote"
      ? "Remote"
      : accountant.service_scope === "nationwide"
        ? "Nationwide"
        : null;
  const service = accountant.services?.[0];
  const priceLabel = formatServicePrice(service);
  const initials = `${(accountant.first_name || "").slice(0, 1)}${(
    accountant.last_name || ""
  ).slice(0, 1)}`.toUpperCase() || "TP";

  return (
    <div style={{ width: 240, fontFamily: "inherit", color: "#111827" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: "#dbeafe",
            color: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{name}</div>
          {credentials ? (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{credentials}</div>
          ) : null}
          {firm ? (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{firm}</div>
          ) : null}
        </div>
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6b7280",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      {location ? (
        <div style={{ fontSize: 12, color: "#374151", marginTop: 10 }}>{location}</div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {scope ? (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
            }}
          >
            {scope}
          </span>
        ) : null}
        {service?.name ? (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#eff6ff",
              color: "#1e40af",
              border: "1px solid #bfdbfe",
            }}
          >
            {service.name}
          </span>
        ) : null}
      </div>

      {priceLabel ? (
        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, color: "#111827" }}>
          {priceLabel}
        </div>
      ) : null}

      {onViewProfile ? (
        <button
          type="button"
          onClick={onViewProfile}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          View profile
        </button>
      ) : null}
    </div>
  );
}

function AccountantMarker({
  accountant,
  isSelected,
  isPreviewOpen,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  onCloseSelected,
}: {
  accountant: AccountantProfilePayload;
  isSelected: boolean;
  isPreviewOpen: boolean;
  onSelect: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onCloseSelected: () => void;
}) {
  const markerRef = useRef<LeafletCircleMarker | null>(null);
  const lat = Number(accountant.latitude);
  const lng = Number(accountant.longitude);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (isPreviewOpen) {
      marker.openPopup();
    } else {
      marker.closePopup();
    }
  }, [isPreviewOpen]);

  return (
    <CircleMarker
      ref={markerRef as never}
      center={[lat, lng]}
      radius={isSelected ? 12 : 9}
      pathOptions={{
        color: isSelected ? "#1e40af" : "#1e3a8a",
        fillColor: isSelected ? "#3b82f6" : "#2563eb",
        fillOpacity: 1,
        weight: isSelected ? 3 : 2,
      }}
      eventHandlers={{
        click: (e) => {
          e.originalEvent.stopPropagation();
          onSelect();
        },
        mouseover: () => onHoverEnter(),
        mouseout: () => onHoverLeave(),
      }}
    >
      <Popup
        autoClose={false}
        closeOnClick={false}
        closeButton={false}
        offset={[0, -6]}
        eventHandlers={{
          mouseover: () => onHoverEnter(),
          mouseout: () => onHoverLeave(),
        }}
      >
        <AccountantPreviewCard
          accountant={accountant}
          showClose={isSelected}
          onClose={isSelected ? onCloseSelected : undefined}
          onViewProfile={() => {
            window.location.assign(`/accountants/${accountant.user_id}`);
          }}
        />
      </Popup>
    </CircleMarker>
  );
}

export default function DirectoryMap({
  pinAccountants,
  accountants,
  searchCenter,
  radiusMiles,
  selectedUserId,
  accountantZoom,
  searchFocus,
  onSelectUserId,
}: DirectoryMapProps) {
  const [hoveredUserId, setHoveredUserId] = useState<number | null>(null);
  const hoverCloseTimer = useRef<number | null>(null);

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimer.current != null) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };

  const enterHover = (userId: number) => {
    clearHoverCloseTimer();
    setHoveredUserId(userId);
  };

  const leaveHover = () => {
    clearHoverCloseTimer();
    hoverCloseTimer.current = window.setTimeout(() => {
      setHoveredUserId(null);
      hoverCloseTimer.current = null;
    }, HOVER_CLOSE_MS);
  };

  useEffect(() => () => clearHoverCloseTimer(), []);

  const initialCenter: [number, number] = searchCenter
    ? [searchCenter.latitude, searchCenter.longitude]
    : pinAccountants[0]?.latitude != null && pinAccountants[0]?.longitude != null
      ? [Number(pinAccountants[0].latitude), Number(pinAccountants[0].longitude)]
      : DEFAULT_CENTER;

  const pins = useMemo(
    () =>
      pinAccountants.filter(
        (a) =>
          a.latitude != null &&
          a.longitude != null &&
          !Number.isNaN(Number(a.latitude)) &&
          !Number.isNaN(Number(a.longitude))
      ),
    [pinAccountants]
  );

  const previewUserId = selectedUserId ?? hoveredUserId;

  return (
    <div
      style={{
        height: "min(70vh, 560px)",
        minHeight: 360,
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        background: "#e2e8f0",
        position: "sticky",
        top: 16,
      }}
    >
      <MapContainer
        center={initialCenter}
        zoom={searchCenter ? 10 : pins.length ? 6 : 4}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SearchFocusController focus={searchFocus} />
        <SelectionFocusController
          selectedUserId={selectedUserId}
          accountants={accountants}
          zoom={accountantZoom}
        />
        {searchCenter && (
          <>
            <CircleMarker
              center={[searchCenter.latitude, searchCenter.longitude]}
              radius={7}
              pathOptions={{
                color: "#0f766e",
                fillColor: "#2dd4bf",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                Search location
              </Tooltip>
            </CircleMarker>
            <Circle
              center={[searchCenter.latitude, searchCenter.longitude]}
              radius={radiusMiles * MILES_TO_METERS}
              pathOptions={{
                color: "#0f766e",
                fillColor: "#99f6e4",
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
          </>
        )}
        {pins.map((accountant) => {
          const isSelected = accountant.user_id === selectedUserId;
          const isPreviewOpen = accountant.user_id === previewUserId;
          return (
            <AccountantMarker
              key={accountant.user_id}
              accountant={accountant}
              isSelected={isSelected}
              isPreviewOpen={isPreviewOpen}
              onSelect={() => onSelectUserId(accountant.user_id)}
              onHoverEnter={() => enterHover(accountant.user_id)}
              onHoverLeave={leaveHover}
              onCloseSelected={() => onSelectUserId(null)}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

export type MapFocus = SearchMapFocus;
