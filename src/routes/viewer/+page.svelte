<script>
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { createClient } from "@supabase/supabase-js";

  // 1. Supabase setup
  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let map;
  let L; // We will store the Leaflet instance here
  let markers = {};
  let channel;
  let hasCentered = false;
  let activeUsers = 0;
  let connectionStatus = "Connecting...";
  let userList = [];
  const formulaNote = "Formula: [ΔLocation / Time] + Base_Offset = Pred_Index";

  // 2. Browser-only Marker Logic
  function getMarkerIcon(status) {
    const colors = { STATIONARY: "#6c757d", WALKING: "#28a745", RUNNING: "#ffc107", VEHICLE: "#dc3545" };
    const color = colors[status] || "#007bff";

    return L.divIcon({
      className: "custom-marker",
      html: `<div style="background:${color};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);"><div style="position:absolute;width:10px;height:10px;background:white;border-radius:50%;top:50%;left:50%;transform:translate(-50%,-50%);"></div></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  }

  function updateMarker(user) {
    const { user_id, lat, lng, status, speed, updated_at } = user;
    if (!lat || !lng || !map || !L) return;

    const popupContent = `<b>Device ${user_id.slice(0, 8)}</b><br>Status: ${status}<br>Speed: ${speed?.toFixed(2)} m/s`;

    if (markers[user_id]) {
      markers[user_id].setLatLng([lat, lng]);
      markers[user_id].setIcon(getMarkerIcon(status));
    } else {
      markers[user_id] = L.marker([lat, lng], { icon: getMarkerIcon(status) }).bindPopup(popupContent).addTo(map);
      activeUsers++;
    }

    if (!hasCentered) { map.setView([lat, lng], 15); hasCentered = true; }

    const idx = userList.findIndex(u => u.user_id === user_id);
    if (idx !== -1) userList[idx] = user; else userList.push(user);
    userList = [...userList]; 
  }

  // 3. Dynamic Import (Prevents "window is not defined" error)
  onMount(async () => {
    if (browser) {
      const Leaflet = await import("leaflet");
      L = Leaflet.default || Leaflet;
      await import("leaflet/dist/leaflet.css");

      map = L.map("map", { zoomControl: true }).setView([16.8661, 96.1951], 12);
      
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Load data
      const { data } = await supabase.from("locations").select("*");
      data?.forEach(updateMarker);
      connectionStatus = "✅ Live";

      // Realtime
      channel = supabase.channel("live-locations")
        .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, (p) => {
          if (p.new) updateMarker(p.new);
        }).subscribe();
      
      // Force map to fill container
      setTimeout(() => map.invalidateSize(), 500);
    }
  });

  onDestroy(() => { if (channel) supabase.removeChannel(channel); if (map) map.remove(); });
</script>

<div class="viewer-container">
  <header class="header">
    <h1>🌍 Traffic Monitor</h1>
    <div class="status-indicator" class:connected={connectionStatus.includes('✅')}>
      <span class="status-dot"></span> {connectionStatus}
    </div>
  </header>

  <div class="main-content">
    <div id="map"></div>
  </div>
</div>

<style>
  :global(body, html) { margin:0; padding:0; height:100%; overflow:hidden; }
  .viewer-container { display:flex; flex-direction:column; height:100vh; }
  .header { padding:10px 20px; background:#1e3c72; color:white; display:flex; justify-content:space-between; align-items:center; }
  .status-dot { width:10px;height:10px;border-radius:50%; background:#ffc107; display:inline-block; margin-right:5px;}
  .connected .status-dot { background:#28a745; box-shadow: 0 0 5px #28a745; }
  .main-content { display:flex; flex:1; overflow:hidden; }
  #map { flex:1; background: #eee; } /* Grey background while loading */
</style>