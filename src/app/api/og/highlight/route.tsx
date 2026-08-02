import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get("text") || "").slice(0, 320);
  const author = searchParams.get("author") || "Anonymous";
  const postTitle = (searchParams.get("postTitle") || "").slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#E2E0DE",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
          border: "16px solid #201E1D",
        }}
      >
        {/* Brand header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#201E1D",
              letterSpacing: "0.02em",
            }}
          >
            SaaS Blog
          </span>
          <span style={{ fontSize: "20px", fontWeight: 800, color: "#EC3013" }}>.</span>
        </div>

        {/* Quote */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <span style={{ fontSize: "72px", fontWeight: 800, color: "#EC3013", lineHeight: 1 }}>
            &ldquo;
          </span>
          <h1
            style={{
              fontSize: "46px",
              fontWeight: 800,
              color: "#201E1D",
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {text}
          </h1>
        </div>

        {/* Footer: author + source post */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "24px", fontWeight: 700, color: "#201E1D" }}>{author}</span>
          {postTitle && (
            <span style={{ fontSize: "18px", fontWeight: 500, color: "#726F6C" }}>
              from &ldquo;{postTitle}&rdquo;
            </span>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
