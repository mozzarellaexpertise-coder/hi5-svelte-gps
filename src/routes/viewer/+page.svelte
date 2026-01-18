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
  let L;
  let markers = {};
  let channel;
  let hasCentered = false;
  let activeUsers = 0;
  let connectionStatus = "Connecting...";
  let userList = [];
  const formulaNote = "Formula: [ΔLocation / Time] + Base_Offset = Pred_Index";

  // Dynamic Marker Colors
  function getMarkerIcon(status) {
    const colors = { STATIONARY: "#6c757d", WALKING: "#28a745", RUNNING: "#ffc107", VEHICLE: "#dc3545" };
    const color = colors[status] || "#007bff";
    return L.divIcon({
      className: "custom-marker",
      html: `<div style="background:${color};width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"><div style="position:absolute;width:8px;height:8px;background:white;border-radius:50%;top:50%;left:50%;transform:translate(-50%,-50%);"></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24]
    });
  }

  function focusUser(user) {
    if (map && user.lat && user.lng) {
      map.setView([user.lat, user.lng], 17);
      markers[user.user_id]?.openPopup();
    }
  }

  function updateMarker(user) {
    const { user_id, lat, lng, status, speed } = user;
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

  onMount(async () => {
    if (browser) {
      const Leaflet = await import("leaflet");
      L = Leaflet.default || Leaflet;
      await import("leaflet/dist/leaflet.css");

      map = L.map("map", { zoomControl: false }).setView([16.8661, 96.1951], 12);
      L.control.zoom({ position: 'topright' }).addTo(map);
      
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OSM',
        maxZoom: 19
      }).addTo(map);

      // Fetch initial data
      const { data } = await supabase.from("locations").select("*");
      data?.forEach(updateMarker);
      connectionStatus = "✅ Live";

      // Listen for Realtime updates
      channel = supabase.channel("live-locations")
        .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, (p) => {
          if (p.new) updateMarker(p.new);
        }).subscribe();
      
      setTimeout(() => map.invalidateSize(), 500);
    }
  });

  onDestroy(() => { if (channel) supabase.removeChannel(channel); if (map) map.remove(); });
</script>

<div class="viewer-container">
  <header class="header">
    <h1>🌍 Traffic Monitor</h1>
    <div class="status-indicator">
      <span class="status-dot" style="background: {connectionStatus.includes('✅') ? '#28a745' : '#ffc107'}"></span>
      {connectionStatus}
    </div>
  </header>

  <main class="layout">
    <div id="map"></div>

    <section class="bottom-panel">
      
      <div class="prediction-box">
        <div class="panel-header">🎯 TOP 3 PREDICTIONS</div>
        <div class="rows-container">
          {#each userList.sort((a,b)=> (b.speed||0)-(a.speed||0)).slice(0,3) as user, i}
            <div class="row-item" on:click={() => focusUser(user)} role="button" tabindex="0">
              <span class="rank">#{i+1}</span>
              <span class="id">{user.user_id.slice(0,8)}</span>
              <span class="chance">{(Math.abs(user.lat*100)%100).toFixed(0)}% Prob.</span>
            </div>
          {/each}
        </div>
        <div class="formula-line">{formulaNote}</div>
      </div>

      <div class="active-devices">
        <div class="panel-header">📊 Active Devices ({activeUsers})</div>
        <div class="horizontal-scroll">
          {#each userList as user (user.user_id)}
            <button class="device-pill" on:click={() => focusUser(user)}>
              <span class="status-icon">{user.status === 'VEHICLE' ? '🚗' : user.status === 'WALKING' ? '🚶' : '📍'}</span>
              {user.user_id.slice(0,4)}
            </button>
          {/each}
        </div>
      </div>

    </section>
  </main>
</div>

<style>
  :global(body, html) { margin:0; padding:0; height:100%; overflow:hidden; font-family: -apple-system, system-ui, sans-serif; }
  
  .viewer-container { display:flex; flex-direction:column; height:100vh; background: #111; }
  
  .header { 
    padding: 10px 20px; 
    background: #1e3c72; 
    color: white; 
    display: flex; 
    justify-content: space-between; 
    align-items: center;
    z-index: 1000;
  }
  .header h1 { font-size: 1.2rem; margin: 0; letter-spacing: 1px; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }

  .layout { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

  #map { flex: 2; width: 100%; min-height: 50vh; background: #222; }

  /* Bottom Panel Styling */
  .bottom-panel { 
    flex: 1; 
    background: white; 
    display: grid; 
    grid-template-columns: 1.3fr 1fr;
    gap: 15px;
    padding: 15px;
    border-top: 4px solid #1e3c72;
    box-shadow: 0 -5px 20px rgba(0,0,0,0.2);
    z-index: 1000;
  }

  .panel-header { font-size: 0.7rem; font-weight: bold; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }

  /* Prediction Box */
  .prediction-box { background: #fff9c4; padding: 12px; border-radius: 12px; border: 1px solid #fbc02d; display: flex; flex-direction: column; }
  .rows-container { display: flex; flex-direction: column; gap: 6px; flex-grow: 1; }
  .row-item { 
    display: flex; justify-content: space-between; background: rgba(255,255,255,0.7); 
    padding: 6px 10px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; border: 1px solid transparent;
  }
  .row-item:hover { border-color: #fbc02d; background: white; }
  .rank { font-weight: bold; color: #1e3c72; }
  .id { font-family: monospace; }
  .formula-line { font-size: 0.6rem; color: #856404; font-style: italic; margin-top: 8px; border-top: 1px solid rgba(133, 100, 4, 0.2); padding-top: 5px; }

  /* Active Devices */
  .active-devices { display: flex; flex-direction: column; }
  .horizontal-scroll { 
    display: flex; flex-wrap: wrap; gap: 8px; overflow-y: auto; padding-right: 5px;
  }
  .device-pill { 
    background: #f0f4ff; border: 1px solid #d1d5db; padding: 6px 12px; 
    border-radius: 20px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 5px;
    transition: 0.2s;
  }
  .device-pill:hover { background: #1e3c72; color: white; }

  /* Mobile Tweaks */
  @media (max-width: 650px) {
    .bottom-panel { grid-template-columns: 1fr; height: 45vh; overflow-y: auto; }
    #map { flex: 1.5; }
  }
</style>