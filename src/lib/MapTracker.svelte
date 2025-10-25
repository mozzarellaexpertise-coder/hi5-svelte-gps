<script context="module">
  // Disable SSR for this browser-only component
  export const ssr = false;
</script>

<script>
  import { onMount } from "svelte";
  import "leaflet/dist/leaflet.css";

  let map, marker;

  const SUPABASE_URL = "https://nmzhlzkrkacftsbcvyka.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5temhsemtya2FjZnRzYmN2eWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzQ2MzAsImV4cCI6MjA3NjkxMDYzMH0.kVmZ500dylxoirex8kXxz7Y-TkJn2bJhGaG6SKru6bA";

  onMount(async () => {
    // Dynamic import for SSR safety
    const L = (await import("leaflet")).default;
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Fix Leaflet marker icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const fallbackPos = [16.8661, 96.1951]; // Yangon fallback

    // Fetch latest location first
    const { data: rows } = await supabase
      .from("locations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    const initialPos =
      rows && rows.length > 0 ? [rows[0].lat, rows[0].lng] : fallbackPos;

    // Create map & initial marker
    map = L.map("map").setView(initialPos, 13);
    marker = L.marker(initialPos).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Subscribe to live updates
    supabase
      .from("locations")
      .on("INSERT", (payload) => updateMarker(payload.new))
      .on("UPDATE", (payload) => updateMarker(payload.new))
      .subscribe();

    function updateMarker(loc) {
      const { lat, lng } = loc;

      // Move marker & recenter map
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], map.getZoom());

      // Sparkle effect
      const mapDiv = document.getElementById("map");
      const sparkle = document.createElement("div");
      sparkle.style.position = "absolute";
      sparkle.style.width = "12px";
      sparkle.style.height = "12px";
      sparkle.style.borderRadius = "50%";
      sparkle.style.background = "#ff4081";
      sparkle.style.boxShadow =
        "0 0 12px currentColor, 0 0 20px currentColor";

      const point = map.latLngToContainerPoint([lat, lng]);
      sparkle.style.left = point.x + "px";
      sparkle.style.top = point.y + "px";
      sparkle.style.animation = "sparkle 1s forwards";

      mapDiv.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 1000);
    }
  });
</script>

<style>
  #map {
    height: 500px;
    width: 100%;
    max-width: 800px;
    margin: auto;
    position: relative;
  }

  @keyframes sparkle {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }
</style>

<div id="map"></div>