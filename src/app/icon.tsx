import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 96,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#D6FF4B",
            fontSize: 220,
            fontWeight: 700,
            letterSpacing: -8,
          }}
        >
          A
        </div>
      </div>
    ),
    { ...size },
  );
}
