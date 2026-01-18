<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let map;
  let markers = {};
  let channel;
  let hasCentered = false;

  function updateMarker(user, L) {
    const { user_id, lat, lng } = user;
    if (!lat || !lng) return;

    if (markers[user_id]) {
      markers[user_id].setLatLng([lat, lng]);
    } else {
      markers[user_id] = L.marker([lat, lng])
        .bindPopup(`User: ${user_id.slice(0, 5)}`)
        .addTo(map);
    }

    // Auto-zoom to the first active device found
    if (!hasCentered) {
      map.setView([lat, lng], 15);
      hasCentered = true;
    }
  }

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Standard Leaflet Icon Fix
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    // Initialize Map - Default to Yangon if no data
    map = L.map("map").setView([16.8661, 96.1951], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // 1️⃣ Get initial data
    const { data } = await supabase.from("locations").select("*");
    if (data) data.forEach(u => updateMarker(u, L));

    // 2️⃣ Live Sync
    channel = supabase
      .channel("live-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, 
        (payload) => updateMarker(payload.new, L)
      )
      .subscribe();
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });
</script>

<div class="app-container">
  <div class="header">
    <h1>🌍 APK-PARADISE LIVE</h1>
    <div class="badge">Index 5.2</div>
  </div>

  <div id="map"></div>

  <div class="prediction-footer">
    <div class="box"><span>#1</span><strong>24</strong></div>
    <div class="box"><span>#2</span><strong>81</strong></div>
    <div class="box"><span>#3</span><strong>07</strong></div>
  </div>
</div>

<style>
  :global(body, html) { margin: 0; padding: 0; height: 100%; overflow: hidden; }
  
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: #f0f0f0;
  }

  .header {
    background: #111;
    color: white;
    padding: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 { font-size: 1rem; margin: 0; letter-spacing: 1px; }

  .badge {
    background: #ff4081;
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: bold;
  }

  #map {
    flex-grow: 1; /* This makes the map fill the middle space */
    width: 100%;
  }

  .prediction-footer {
    display: flex;
    background: white;
    padding: 15px;
    gap: 10px;
    border-top: 2px solid #ff4081;
  }

  .box {
    flex: 1;
    text-align: center;
    background: #f8f8f8;
    padding: 5px;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .box span { display: block; font-size: 0.6rem; color: #ff4081; font-weight: bold; }
  .box strong { font-size: 1.2rem; color: #333; }
</style>
