import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SaaS Blog",
    short_name: "SaaS Blog",
    description: "Minimalist reading page & drawings",
    start_url: "/",
    display: "standalone",
    background_color: "#E2E0DE",
    theme_color: "#201E1D",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
