import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E0D0B",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#D6FF4B",
            fontSize: 88,
            fontWeight: 700,
          }}
        >
          A
        </div>
      </div>
    ),
    { ...size },
  );
}
