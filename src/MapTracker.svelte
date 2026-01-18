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
      // Custom Red Marker for "Troops"
      const troopIcon = L.divIcon({
        className: 'troop-marker',
        html: `<div class="pulse-ring"></div><div class="dot"></div>`,
        iconSize: [20, 20]
      });

      markers[user_id] = L.marker([lat, lng], { icon: troopIcon })
        .bindPopup(`<b>Troop ID:</b> ${user_id.slice(0, 8)}`)
        .addTo(map);
    }

    if (!hasCentered) {
      map.setView([lat, lng], 16);
      hasCentered = true;
    }
  }

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Initialize Map to absolute full screen
    map = L.map("map", { zoomControl: false }).setView([16.8661, 96.1951], 13);
    // Switch to Voyager for better street visibility
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19
    }).addTo(map);

    // Initial Fetch
    const { data } = await supabase.from("locations").select("*");
    if (data) data.forEach(u => updateMarker(u, L));

    // Live Sync
    channel = supabase.channel("live-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, 
        (payload) => updateMarker(payload.new, L)
      ).subscribe();
  });

  onDestroy(() => { if (channel) supabase.removeChannel(channel); });
</script>

<div class="monitor-wrapper">
  <div class="hud-sidebar">
    <div class="glitch-header">COMMAND CENTER</div>
    <div class="logic-label">INDEX 5.2 ACTIVE</div>
    
    <div class="prediction-list">
      <div class="pred-item"><span>01</span> <strong>24</strong></div>
      <div class="pred-item"><span>02</span> <strong>81</strong></div>
      <div class="pred-item"><span>03</span> <strong>07</strong></div>
    </div>
    
    <div class="system-status">
        <span class="blink">●</span> SECURE STREAM: ON
    </div>
  </div>

  <div id="map"></div>
</div>

<style>
  /* Remove all browser scrollbars and spacing */
  :global(body, html) { 
    margin: 0; padding: 0; width: 100vw; height: 100vh; 
    overflow: hidden; background: #000;
  }

  .monitor-wrapper {
    position: relative;
    width: 100vw;
    height: 100vh;
  }

  #map {
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  /* HUD Overlay Styling */
  .hud-sidebar {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 1000; /* Above the map */
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border: 1px solid #ff4081;
    padding: 20px;
    color: white;
    font-family: 'Courier New', Courier, monospace;
    width: 220px;
    pointer-events: none; /* Allow clicking through to the map */
  }

  .glitch-header { font-weight: bold; font-size: 1.2rem; color: #ff4081; border-bottom: 1px solid #ff4081; margin-bottom: 5px; }
  .logic-label { font-size: 0.7rem; margin-bottom: 20px; opacity: 0.7; }

  .pred-item { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; background: rgba(255, 64, 129, 0.1); padding: 10px; border-left: 3px solid #ff4081; }
  .pred-item strong { font-size: 1.4rem; }
  .pred-item span { font-size: 0.6rem; color: #ff4081; }

  .system-status { font-size: 0.7rem; color: #4caf50; margin-top: 15px; }
  .blink { animation: blinker 1s linear infinite; }
  @keyframes blinker { 50% { opacity: 0; } }

  /* Troop Marker Pulse Effect */
  :global(.troop-marker) { position: relative; }
  :global(.dot) { width: 10px; height: 10px; background: #ff4081; border-radius: 50%; box-shadow: 0 0 10px #ff4081; }
  :global(.pulse-ring) {
    position: absolute; width: 30px; height: 30px;
    border: 2px solid #ff4081; border-radius: 50%;
    top: -10px; left: -10px;
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
</style>
