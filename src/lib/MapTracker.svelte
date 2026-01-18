<script>
  import { onMount } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  // Using the credentials you provided
  const supabase = createClient(
    "https://nmzhlzkrkacftsbcvyka.supabase.co", 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Your key
  );

  let map, marker;
  const deviceId = 1;

  onMount(async () => {
    // 2026 dynamic import to prevent SSR errors
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Fix for Leaflet marker icons in SvelteKit
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    map = L.map("map").setView([16.9008, 96.1111], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    marker = L.marker([16.9008, 96.1111]).addTo(map);

    // Watch real-time location and update Supabase
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        await supabase.from("locations").update({ lat: latitude, lng: longitude }).eq("device_id", deviceId);
        
        // Local update for the user
        marker.setLatLng([latitude, longitude]);
        map.setView([latitude, longitude], map.getZoom());
        showSparkle(latitude, longitude);
      });
    }

    function showSparkle(lat, lng) {
      const point = map.latLngToContainerPoint([lat, lng]);
      const sparkle = document.createElement("div");
      sparkle.className = "sparkle-effect";
      sparkle.style.left = point.x + "px";
      sparkle.style.top = point.y + "px";
      document.getElementById("map").appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 1000);
    }
  });
</script>

<div id="map"></div>

<style>
  #map { height: 500px; width: 100%; position: relative; border-radius: 12px; }
  :global(.sparkle-effect) {
    position: absolute; width: 12px; height: 12px; border-radius: 50%;
    background: #ff4081; box-shadow: 0 0 12px #ff4081;
    animation: sparkle 1s forwards; pointer-events: none;
  }
  @keyframes sparkle { 0% { transform: scale(0); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
</style>
