import { ImageResponse } from "next/og";

// The home-screen icon for iPhone and iPad: the star mark in cobalt on linen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f3ea" }}>
        <svg width="112" height="112" viewBox="0 0 32 32">
          <rect x="9" y="9" width="14" height="14" fill="#2a44c9" />
          <rect x="9" y="9" width="14" height="14" fill="#2a44c9" transform="rotate(45 16 16)" />
        </svg>
      </div>
    ),
    size,
  );
}
