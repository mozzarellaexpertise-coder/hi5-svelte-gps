<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";

  // Supabase client
  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let map;
  let markers = {};
  let channel;
  let hasCentered = false;
  let activeUsers = 0;
  let totalUpdates = 0;
  let lastUpdateTime = null;
  let connectionStatus = "Connecting...";
  let userList = [];

  // Marker icon
  function getMarkerIcon(status) {
    const colors = {
      STATIONARY: "#6c757d",
      WALKING: "#28a745",
      RUNNING: "#ffc107",
      VEHICLE: "#dc3545"
    };
    const color = colors[status] || "#007bff";

    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
        background: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        position: relative;
      ">
        <div style="
          position: absolute;
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        "></div>
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  }

  // Update or add marker
  function updateMarker(user) {
    const { user_id, lat, lng, status, speed, updated_at } = user;
    if (!lat || !lng || !map) return;

    const popupContent = `
      <div style="font-family:sans-serif; min-width:200px;">
        <h4>📍 Device ${user_id.slice(0,8)}</h4>
        <div>
          <strong>Status:</strong> ${status || "UNKNOWN"}<br/>
          <strong>Speed:</strong> ${speed?.toFixed(2) || "0.00"} m/s<br/>
          <strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}<br/>
          <strong>Last Update:</strong> ${new Date(updated_at).toLocaleString()}
        </div>
      </div>
    `;

    if (markers[user_id]) {
      markers[user_id].setLatLng([lat, lng]);
      markers[user_id].setIcon(getMarkerIcon(status));
      markers[user_id].getPopup().setContent(popupContent);
    } else {
      markers[user_id] = L.marker([lat, lng], { icon: getMarkerIcon(status) })
        .bindPopup(popupContent)
        .addTo(map);
      activeUsers++;
    }

    if (!hasCentered) {
      map.setView([lat, lng], 15);
      hasCentered = true;
    }

    // Update sidebar list
    const idx = userList.findIndex(u => u.user_id === user_id);
    if (idx !== -1) userList[idx] = user;
    else userList.push(user);
    userList = userList; // trigger reactivity

    totalUpdates++;
    lastUpdateTime = new Date();
  }

  function focusUser(user) {
    if (map && user.lat && user.lng) {
      map.setView([user.lat, user.lng], 17);
      markers[user.user_id]?.openPopup();
    }
  }

  function removeInactiveUsers() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    Object.entries(markers).forEach(([id, marker]) => {
      const user = userList.find(u => u.user_id === id);
      if (user && now - new Date(user.updated_at).getTime() > timeout) {
        map.removeLayer(marker);
        delete markers[id];
        userList = userList.filter(u => u.user_id !== id);
        activeUsers--;
      }
    });
  }

  onMount(async () => {
    // Initialize map
    map = L.map("map", { zoomControl: true }).setView([16.8661, 96.1951], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Load initial data
    connectionStatus = "Loading initial data...";
    const { data, error } = await supabase.from("locations").select("*");
    if (error) {
      console.error(error);
      connectionStatus = "❌ Error loading data";
    } else {
      data?.forEach(updateMarker);
      connectionStatus = data?.length ? "✅ Connected" : "⏳ Waiting for devices...";
    }

    // Realtime subscription
    channel = supabase
      .channel("live-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, (payload) => {
        if (payload.new) updateMarker(payload.new);
        connectionStatus = "✅ Live";
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") connectionStatus = "✅ Live";
        else if (status === "CHANNEL_ERROR") connectionStatus = "⚠️ Connection error";
      });

    const cleanupInterval = setInterval(removeInactiveUsers, 60000);

    return () => clearInterval(cleanupInterval);
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
    if (map) map.remove();
  });
</script>

<div class="viewer-container">
  <header class="header">
    <h1>🌍 Live Traffic Monitor</h1>
    <div class="status-indicator" class:connected={connectionStatus.includes('✅')}>
      <span class="status-dot"></span> {connectionStatus}
    </div>
  </header>

  <div class="main-content">
    <aside class="sidebar">
      <h3>📊 Active Devices: {activeUsers}</h3>

      <div class="prediction-panel">
        {#each userList.sort((a,b)=> (b.speed||0)-(a.speed||0)).slice(0,3) as user, i}
          <div>Row {i+1}: {user.user_id.slice(0,4)} - {(Math.abs(user.lat*100)%100).toFixed(0)}%</div>
        {/each}
      </div>

      <div class="user-list">
        {#each userList as user (user.user_id)}
          <div class="user-card" on:click={() => focusUser(user)}>
            <span>{user.status==='STATIONARY'?'⏸️':user.status==='WALKING'?'🚶':user.status==='RUNNING'?'🏃':user.status==='VEHICLE'?'🚗':'📍'}</span>
            {user.user_id.slice(0,8)} - {user.status}
          </div>
        {/each}
      </div>
    </aside>

    <div id="map"></div>
  </div>
</div>

<style>
  html, body { margin:0; padding:0; height:100%; width:100%; font-family:sans-serif; }
  .viewer-container { display:flex; flex-direction:column; height:100vh; width:100vw; }
  .header { padding:10px 20px; background:linear-gradient(135deg,#1e3c72,#2a5298); color:white; display:flex; justify-content:space-between; align-items:center; }
  .status-indicator { display:flex; align-items:center; gap:8px; }
  .status-dot { width:10px;height:10px;border-radius:50%; background:#ffc107; }
  .status-indicator.connected .status-dot { background:#28a745; animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
  .main-content { display:flex; flex:1; overflow:hidden; height: calc(100vh - 70px); }
  .sidebar { width:300px; background:white; border-right:1px solid #ccc; display:flex; flex-direction:column; overflow:auto; padding:10px; }
  #map { flex:1; height:100%; }
  .user-card { padding:8px; border:1px solid #eee; margin-bottom:5px; cursor:pointer; border-radius:6px; transition:0.2s; }
  .user-card:hover { border-color:#2a5298; transform:translateY(-2px); box-shadow:0 2px 6px rgba(0,0,0,0.1); }
  .prediction-panel { background:#fff9c4; border:1px solid #fbc02d; padding:8px; border-radius:6px; margin-bottom:10px; }
</style>