import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Untitled Article";
  const author = searchParams.get("author") || "Anonymous";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#FFFFFF",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
          border: "20px solid #FAFAFA",
        }}
      >
        {/* Top brand header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: "#0A84FF",
            }}
          />
          <span
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#6B6B70",
              letterSpacing: "-0.02em",
            }}
          >
            SaaS Blog
          </span>
        </div>

        {/* Post Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginTop: "auto",
            marginBottom: "auto",
          }}
        >
          <h1
            style={{
              fontSize: "64px",
              fontWeight: 700,
              color: "#111113",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>

        {/* Bottom Author Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "24px",
              fontWeight: 500,
              color: "#6B6B70",
            }}
          >
            Written by
          </span>
          <span
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#111113",
            }}
          >
            {author}
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
