<script>
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let map;
  let L;
  let channel;
  let hasCentered = false;
  let connectionStatus = "Connecting...";

  const markers = {};
  const trails = {};
  const lastSeen = {};

  const STALE_MS = 30_000;     // fade start
  const REMOVE_MS = 60_000;    // remove completely
  const MAX_TRAIL = 20;

  function statusColor(status) {
    return {
      STATIONARY: "#6c757d",
      WALKING: "#28a745",
      RUNNING: "#ffc107",
      VEHICLE: "#dc3545"
    }[status] || "#007bff";
  }

  function markerIcon(status, opacity = 1) {
    const color = statusColor(status);
    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          background:${color};
          opacity:${opacity};
          width:24px;height:24px;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:2px solid white;
          box-shadow:0 2px 5px rgba(0,0,0,0.3);">
        </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24]
    });
  }

  function updateTrail(user) {
    const { user_id, lat, lng, status } = user;
    if (!trails[user_id]) {
      trails[user_id] = L.polyline([], {
        color: statusColor(status),
        weight: 3,
        opacity: 0.7
      }).addTo(map);
    }

    const latlngs = trails[user_id].getLatLngs();
    latlngs.push([lat, lng]);
    if (latlngs.length > MAX_TRAIL) latlngs.shift();
    trails[user_id].setLatLngs(latlngs);
    trails[user_id].setStyle({ color: statusColor(status) });
  }

  function updateMarker(user) {
    const { user_id, lat, lng, status, speed } = user;
    if (!lat || !lng || !map || !L) return;

    lastSeen[user_id] = Date.now();

    const popup = `
      <b>${user_id.slice(0, 8)}</b><br>
      ${status}<br>
      ${speed?.toFixed(2)} m/s
    `;

    if (markers[user_id]) {
      markers[user_id].setLatLng([lat, lng]);
      markers[user_id].setIcon(markerIcon(status, 1));
    } else {
      markers[user_id] = L.marker([lat, lng], {
        icon: markerIcon(status, 1)
      }).bindPopup(popup).addTo(map);
    }

    updateTrail(user);

    if (!hasCentered) {
      map.setView([lat, lng], 15);
      hasCentered = true;
    }
  }

  function cleanupStale() {
    const now = Date.now();

    Object.keys(markers).forEach((id) => {
      const age = now - (lastSeen[id] || 0);

      if (age > REMOVE_MS) {
        map.removeLayer(markers[id]);
        map.removeLayer(trails[id]);
        delete markers[id];
        delete trails[id];
        delete lastSeen[id];
      } else if (age > STALE_MS) {
        markers[id].setIcon(markerIcon("STATIONARY", 0.3));
      }
    });
  }

  onMount(async () => {
    if (!browser) return;

    const Leaflet = await import("leaflet");
    await import("leaflet/dist/leaflet.css");
    L = Leaflet.default || Leaflet;

    map = L.map("map", { zoomControl: false })
      .setView([16.8661, 96.1951], 12);

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19
    }).addTo(map);

    const { data } = await supabase
      .from("locations")
      .select("*")
      .eq("share_mode", "PUBLIC");

    data?.forEach(updateMarker);
    connectionStatus = "✅ Live";

    channel = supabase.channel("live-locations")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        (p) => p.new && p.new.share_mode === "PUBLIC" && updateMarker(p.new)
      )
      .subscribe();

    setInterval(cleanupStale, 5_000);
    setTimeout(() => map.invalidateSize(), 500);
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
    if (map) map.remove();
  });
</script>

<div class="viewer-container">
  <header class="header">
    <h1>🌍 Live Tracker</h1>
    <div class="status">
      <span class="dot" class:live={connectionStatus.includes("✅")}></span>
      {connectionStatus}
    </div>
  </header>
  <div id="map"></div>
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    font-family: system-ui, sans-serif;
  }

  .viewer-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #111;
  }

  .header {
    padding: 10px 20px;
    background: #1e3c72;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 1000;
  }

  #map {
    flex: 1;
    width: 100%;
    background: #222;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 6px;
    background: #ffc107;
  }

  .dot.live {
    background: #28a745;
  }
</style>