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
        .bindPopup(`<b>User ID:</b><br/>${user_id.slice(0, 13)}...`)
        .addTo(map);
    }

    if (!hasCentered) {
      map.setView([lat, lng], 15);
      hasCentered = true;
    }
  }

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    // Init Map to fill the container
    map = L.map("map").setView([16.8661, 96.1951], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map);

    const { data } = await supabase.from("locations").select("*");
    if (data) data.forEach(u => updateMarker(u, L));

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

<div class="dashboard">
  <aside class="sidebar">
    <div class="brand">
      <h1>APK-PARADISE</h1>
      <span class="version">V 5.2</span>
    </div>

    <div class="prediction-panel">
      <h2>Top Predictions</h2>
      <div class="pred-card high">
        <span class="rank">#1</span>
        <span class="num">24</span>
      </div>
      <div class="pred-card">
        <span class="rank">#2</span>
        <span class="num">81</span>
      </div>
      <div class="pred-card">
        <span class="rank">#3</span>
        <span class="num">07</span>
      </div>
    </div>

    <div class="status-box">
        <p>● Live Data Stream</p>
        <p>Vercel + Supabase Active</p>
    </div>
  </aside>

  <main id="map-container">
    <div id="map"></div>
  </main>
</div>

<style>
  /* RESET & FULL HEIGHT */
  :global(body, html) { 
    margin: 0; 
    padding: 0; 
    height: 100vh; 
    width: 100vw;
    overflow: hidden; 
    font-family: 'Inter', sans-serif;
  }

  .dashboard {
    display: flex;
    height: 100vh;
    width: 100vw;
  }

  /* SIDEBAR FOR DESKTOP */
  .sidebar {
    width: 300px;
    background: #121212;
    color: white;
    display: flex;
    flex-direction: column;
    padding: 20px;
    border-right: 2px solid #ff4081;
    z-index: 10;
  }

  .brand h1 { font-size: 1.4rem; margin: 0; color: #ff4081; }
  .version { font-size: 0.7rem; opacity: 0.6; }

  .prediction-panel { margin-top: 40px; flex-grow: 1; }
  .prediction-panel h2 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; opacity: 0.8; }

  .pred-card {
    background: #1e1e1e;
    padding: 15px;
    border-radius: 10px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #333;
  }
  .pred-card.high { border-color: #ff4081; background: #251018; }
  .rank { color: #ff4081; font-weight: bold; }
  .num { font-size: 1.8rem; font-weight: 800; }

  .status-box { font-size: 0.75rem; color: #4caf50; border-top: 1px solid #333; padding-top: 10px; }

  /* FULL WIDTH MAP */
  #map-container {
    flex-grow: 1;
    position: relative;
  }

  #map {
    height: 100%;
    width: 100%;
  }
</style>
