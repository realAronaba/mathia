import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MathIA",
    short_name: "MathIA",
    description: "Apprendre les mathématiques à son rythme.",
    start_url: "/",
    display: "standalone",
    background_color: "#eff6ff",
    theme_color: "#1d4ed8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
  };
}
