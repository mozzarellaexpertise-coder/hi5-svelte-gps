<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik" // Your Anon Key
  );

  let map;
  let markers = {};
  let channel;

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Fix icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    // ⚡ PRO TIP: Use preferCanvas: true for 2026 mobile performance
    map = L.map("map", { preferCanvas: true }).setView([16.8661, 96.1951], 13);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // 1️⃣ Initial Load
    const { data, error } = await supabase.from("locations").select("*");
    if (!error && data) {
      data.forEach(user => addOrUpdateMarker(user));
    }

    // 2️⃣ Realtime Channel with Cleanup
    channel = supabase
      .channel("live-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        payload => {
          if (payload.new) addOrUpdateMarker(payload.new);
        }
      )
      .subscribe();

    function addOrUpdateMarker(user) {
      const { user_id, lat, lng } = user;
      if (markers[user_id]) {
        markers[user_id].setLatLng([lat, lng]);
      } else {
        markers[user_id] = L.marker([lat, lng])
          .bindPopup(`User: ${user_id}`)
          .addTo(map);
      }
    }
  });

  // 🧹 Critical: Stop listening when page closes to save Supabase quota
  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });
</script>

<div class="viewer">
  <header>
    <h2>🌍 Live User Map</h2>
    <div class="status-bar">
      <span class="pulse-dot"></span> 2D Live Feed Active
    </div>
  </header>
  <div id="map"></div>
</div>

<style>
  .viewer { padding: 1rem; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
  .status-bar { text-align: center; font-size: 0.8rem; color: #666; margin-bottom: 10px; }
  .pulse-dot { 
    height: 8px; width: 8px; background-color: #4caf50; 
    border-radius: 50%; display: inline-block; 
    animation: pulse 1.5s infinite; 
  }
  @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
  #map { height: 75vh; width: 100%; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
</style>
