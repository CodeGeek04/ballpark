import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Ballpark — guess the weirdest number of the day";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#fef7e8",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* header: logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <svg width="64" height="64" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="#ff5b3a" stroke="#1a1a1a" strokeWidth="3" />
            <path d="M9 27 L20 9 L31 27 Z" fill="#fef7e8" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="20" cy="22" r="2.5" fill="#1a1a1a" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
            ballpark
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: "#1a1a1a",
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              maxWidth: "1000px",
            }}
          >
            Guess the weirdest number of the day.
          </div>

          {/* example question card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              backgroundColor: "#ff5b3a",
              border: "3px solid #1a1a1a",
              borderRadius: "20px",
              padding: "22px 28px",
              boxShadow: "8px 8px 0 #1a1a1a",
              alignSelf: "flex-start",
              maxWidth: "1020px",
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 700, color: "#fef7e8" }}>
              How many cups of chai does India drink every hour?
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#1a1a1a" }}>letsballpark.com</div>
          <div style={{ fontSize: 26, fontWeight: 600, color: "#1a1a1a", opacity: 0.7 }}>
            solo · up to 8 friends · no signup
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
