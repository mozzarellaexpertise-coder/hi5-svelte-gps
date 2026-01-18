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

    const popupContent = `<b>Device ${user_id.slice(0, 8)}</b><br>Status: ${status}`;

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

      const { data } = await supabase.from("locations").select("*");
      data?.forEach(updateMarker);
      connectionStatus = "✅ Live";

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
            <div class="row-item" on:click={() => focusUser(user)}>
              <span class="rank">#{i+1}</span>
              <span class="id">{user.user_id.slice(0,4)}</span>
              <span class="chance">{(Math.abs(user.lat*100)%100).toFixed(0)}%</span>
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
              {user.status === 'VEHICLE' ? '🚗' : '🚶'} {user.user_id.slice(0,4)}
            </button>
          {/each}
        </div>
      </div>
    </section>
  </main>
</div>

<style>
  :global(body, html) { margin:0; padding:0; height:100%; overflow:hidden; font-family: sans-serif; }
  .viewer-container { display:flex; flex-direction:column; height:100vh; background: #f4f4f4; }
  
  .header { 
    padding: 8px 15px; 
    background: #1e3c72; 
    color: white; 
    display: flex; 
    justify-content: space-between; 
    align-items: center;
    z-index: 1000;
  }
  .header h1 { font-size: 1.1rem; margin: 0; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }

  .layout { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

  #map { flex: 2; width: 100%; min-height: 50vh; }

  .bottom-panel { 
    flex: 1; 
    background: white; 
    display: grid; 
    grid-template-columns: 1.2fr 1fr;
    gap: 10px;
    padding: 10px;
    border-top: 3px solid #1e3c72;
    box-shadow: 0 -5px 15px rgba(0,0,0,0.1);
    z-index: 1000;
  }

  .panel-header { font-size: 0.75rem; font-weight: bold; color: #666; margin-bottom: 5px; text-transform: uppercase; }

  /* Prediction Box Styling */
  .prediction-box { background: #fff9c4; padding: 8px; border-radius: 8px; border: 1px solid #fbc02d; overflow: hidden; }
  .rows-container { display: flex; flex-direction: column; gap: 4px; }
  .row-item { 
    display: flex; justify-content: space-between; background: rgba(255,255,255,0.5); 
    padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; cursor: pointer;
  }
  .rank { font-weight: bold; color: #1e3c72; }
  .formula-line { font-size: 0.6rem; color: #856404; font-style: italic; margin-top: 5px; border-top: 1px solid #fbc02d; padding-top: 3px; }

  /* Device List Styling */
  .active-devices { overflow: hidden; }
  .horizontal-scroll { 
    display: flex; flex-wrap: wrap; gap: 6px; overflow-y: auto; max-height: 80px; padding-top: 5px;
  }
  .device-pill { 
    background: #eef2ff; border: 1px solid #c7d2fe; padding: 4px 10px; 
    border-radius: 15px; font-size: 0.75rem; cursor: pointer; white-space: nowrap;
  }

  /* Mobile adjustment */
  @media (max-width: 600px) {
    .bottom-panel { grid-template-columns: 1fr; height: 40vh; overflow-y: auto; }
  }
</style>