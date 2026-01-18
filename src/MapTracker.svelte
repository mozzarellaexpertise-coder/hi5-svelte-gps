<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik" // Your Public Key
  );

  let map;
  let markers = {};
  let channel;
  let hasCentered = false;

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Init Map
    map = L.map("map").setView([16.8661, 96.1951], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // Initial Load
    const { data } = await supabase.from("locations").select("*");
    if (data) data.forEach(u => updateMarker(u, L));

    // Realtime Sync
    channel = supabase.channel("live-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, 
        (payload) => updateMarker(payload.new, L)
      ).subscribe();

    function updateMarker(user, L) {
      const { user_id, lat, lng } = user;
      if (!lat || !lng) return;
      if (markers[user_id]) {
        markers[user_id].setLatLng([lat, lng]);
      } else {
        markers[user_id] = L.marker([lat, lng]).bindPopup(`User: ${user_id.slice(0,5)}`).addTo(map);
      }
      if (!hasCentered) { map.setView([lat, lng], 15); hasCentered = true; }
    }
  });

  onDestroy(() => { if (channel) supabase.removeChannel(channel); });
</script>

<div class="dashboard">
  <aside class="sidebar">
    <h2>APK-PARADISE</h2>
    <div class="prediction">#1 Prediction: <strong>24</strong></div>
    <div class="prediction">#2 Prediction: <strong>81</strong></div>
    <div class="prediction">#3 Prediction: <strong>07</strong></div>
    <p class="status">● Live Stream Active</p>
  </aside>
  <main id="map"></main>
</div>

<style>
  :global(body, html) { margin: 0; padding: 0; height: 100vh; overflow: hidden; }
  .dashboard { display: flex; height: 100vh; width: 100vw; }
  .sidebar { width: 250px; background: #111; color: #ff4081; padding: 20px; border-right: 2px solid #ff4081; }
  .prediction { background: #222; padding: 15px; margin: 10px 0; border-radius: 8px; color: white; border: 1px solid #333; }
  #map { flex-grow: 1; height: 100%; }
  .status { font-size: 0.7rem; color: #4caf50; margin-top: 20px; }
</style>
