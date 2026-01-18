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

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Standard Map Init
    map = L.map("map").setView([16.8661, 96.1951], 12); 
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // 1️⃣ Load initial data
    const { data, error } = await supabase.from("locations").select("*");
    if (data) {
      data.forEach(user => updateMarker(user, L));
    }

    // 2️⃣ Realtime sync
    channel = supabase
      .channel("live-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, 
        payload => {
          updateMarker(payload.new, L);
        }
      )
      .subscribe();

    function updateMarker(user, L) {
      const { user_id, lat, lng } = user;
      if (!lat || !lng) return;

      if (markers[user_id]) {
        markers[user_id].setLatLng([lat, lng]);
      } else {
        markers[user_id] = L.marker([lat, lng])
          .bindPopup(`ID: ${user_id.slice(0,8)}...`)
          .addTo(map);
      }

      // Auto-focus on the first active user found
      if (!hasCentered) {
        map.setView([lat, lng], 16);
        hasCentered = true;
      }
    }
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });
</script>

<div class="viewer-container">
  <div class="header">
    <h2>🌍 Live Traffic Monitor</h2>
    <p>Index 5.2 Active</p>
  </div>

  <div id="map"></div>

  <div class="footer">
    <div class="stat"><strong>Prediction 1:</strong> 24</div>
    <div class="stat"><strong>Prediction 2:</strong> 81</div>
    <div class="stat"><strong>Prediction 3:</strong> 07</div>
  </div>
</div>

<style>
  /* Ensure the whole page takes up the full screen */
  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
  }

  .viewer-container {
    display: flex;
    flex-direction: column;
    height: 100vh; /* Full viewport height */
    width: 100vw;
  }

  .header {
    padding: 10px;
    background: #1a1a1a;
    color: white;
    text-align: center;
  }

  #map {
    flex-grow: 1; /* This makes the map fill all available space */
    width: 100%;
    z-index: 1;
  }

  .footer {
    display: flex;
    justify-content: space-around;
    padding: 15px;
    background: white;
    border-top: 2px solid #ff4081;
    font-family: sans-serif;
  }

  .stat {
    font-size: 1rem;
  }
</style>
