import type { CSSProperties } from "react";
import { accountantDisplayName } from "./displayName";

type AvatarPerson = {
  first_name?: string | null;
  last_name?: string | null;
  profile_photo_url?: string | null;
};

function initialsFor(person: AvatarPerson) {
  const first = (person.first_name || "").trim().charAt(0);
  const last = (person.last_name || "").trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

const defaultShell: CSSProperties = {
  borderRadius: "50%",
  background: "#e5e7eb",
  color: "#374151",
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  flexShrink: 0,
  overflow: "hidden",
};

type Props = {
  person: AvatarPerson;
  size?: number;
  /** Local object URL or remote media URL shown instead of saved photo. */
  previewSrc?: string | null;
  className?: string;
  style?: CSSProperties;
};

export default function AccountantAvatar({
  person,
  size = 64,
  previewSrc = null,
  className,
  style,
}: Props) {
  const src = (previewSrc || person.profile_photo_url || "").trim();
  const alt = `Profile photo of ${accountantDisplayName(person)}`;
  return (
    <div
      className={className}
      style={{
        ...defaultShell,
        width: size,
        height: size,
        fontSize: Math.max(12, Math.round(size * 0.32)),
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span aria-hidden="true">{initialsFor(person)}</span>
      )}
    </div>
  );
}
