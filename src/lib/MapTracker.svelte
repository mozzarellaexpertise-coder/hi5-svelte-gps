<script>
  import { onMount } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabaseUrl = "https://nmzhlzkrkacftsbcvyka.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // your anon key
  const supabase = createClient(supabaseUrl, supabaseKey);

  let map, marker;

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Fix default marker icon in Vite/SvelteKit
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
    });

    // Start map in Yangon
    const yangon = [16.8661, 96.1951];
    map = L.map("map").setView(yangon, 13);

    // Load OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(map);

    // Initial marker
    marker = L.marker(yangon).addTo(map);

    // ======== Subscribe to Supabase 'locations' table ========
    const { data: subscription } = supabase
      .from("locations:id=eq.1") // replace 1 with your device ID
      .on("INSERT", payload => updateMarker(payload.new))
      .on("UPDATE", payload => updateMarker(payload.new))
      .subscribe();

    // Initial fetch in case table already has data
    const { data: rows } = await supabase.from("locations").select("*").eq("id", 1);
    if (rows && rows.length > 0) {
      updateMarker(rows[0]);
    }

    function updateMarker(loc) {
      const { lat, lng } = loc;
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
      sparkle.style.boxShadow = "0 0 12px currentColor, 0 0 20px currentColor";

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
    position: relative;
  }

  @keyframes sparkle {
    0% { transform: scale(0); opacity: 1; }
    100% { transform: scale(2); opacity: 0; }
  }
</style>

<div id="map"></div>