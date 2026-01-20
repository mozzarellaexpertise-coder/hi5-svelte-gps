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
  let connectionStatus = "Connecting...";

  const markers = {};
  const trails = {};
  const lastSeen = {};

  const STALE_MS = 30_000;
  const REMOVE_MS = 60_000;
  const MAX_TRAIL = 20;

  // 🔑 URL params
  let targetUserId = null;
  let targetHandle = null;

  // 🧭 Auto-follow
  let autoFollow = true;
  let lastCenter = null;
  const FOLLOW_DISTANCE_M = 10;

  function metersBetween(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) *
        Math.cos(b.lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

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
  }

  function updateMarker(user) {
    const { user_id, lat, lng, status, speed, handle } = user;
    if (!lat || !lng) return;

    lastSeen[user_id] = Date.now();

    const name = handle || targetHandle || user_id.slice(0, 8);

    const popup = `
      <b>${name}</b><br>
      ${status}<br>
      ${speed?.toFixed(2) ?? "0.00"} m/s
    `;

    if (markers[user_id]) {
      markers[user_id].setLatLng([lat, lng]);
      markers[user_id].setIcon(markerIcon(status));
    } else {
      markers[user_id] = L.marker([lat, lng], {
        icon: markerIcon(status)
      }).bindPopup(popup).addTo(map);
    }

    updateTrail(user);

    // 🧭 Auto-follow (single user only)
    if (targetUserId && autoFollow) {
      if (!lastCenter) {
        map.setView([lat, lng], 16);
        lastCenter = { lat, lng };
      } else {
        const d = metersBetween(lastCenter, { lat, lng });
        if (d > FOLLOW_DISTANCE_M) {
          map.panTo([lat, lng], { animate: true });
          lastCenter = { lat, lng };
        }
      }
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
      }
    });
  }

  onMount(async () => {
    if (!browser) return;

    const params = new URLSearchParams(window.location.search);
    targetUserId = params.get("user_id");
    targetHandle = params.get("handle");

    const Leaflet = await import("leaflet");
    await import("leaflet/dist/leaflet.css");
    L = Leaflet.default || Leaflet;

    map = L.map("map").setView([16.8661, 96.1951], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    map.on("dragstart zoomstart", () => autoFollow = false);

    let query = supabase.from("locations").select("*");
    query = targetUserId
      ? query.eq("user_id", targetUserId)
      : query.eq("share_mode", "PUBLIC");

    const { data } = await query;
    data?.forEach(updateMarker);

    channel = supabase.channel("live-locations")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        (p) => p.new && (
          targetUserId
            ? p.new.user_id === targetUserId
            : p.new.share_mode === "PUBLIC"
        ) && updateMarker(p.new)
      )
      .subscribe();

    connectionStatus = "✅ Live";
    setInterval(cleanupStale, 5_000);
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
    if (map) map.remove();
  });
</script>

<div class="viewer">
  <header>
    <h1>🌍 Live Tracker</h1>
    <span>{connectionStatus}</span>
  </header>

  <button
    class:active={autoFollow}
    class="follow"
    on:click={() => autoFollow = !autoFollow}
  >
    🧭 {autoFollow ? "Following" : "Free Pan"}
  </button>

  <div id="map"></div>
</div>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    font-family: system-ui, sans-serif;
  }

  .viewer {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #111;
  }

  header {
    background: #1e3c72;
    color: white;
    padding: 10px 16px;
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

  .follow {
    position: absolute;
    top: 64px;
    right: 12px;
    z-index: 1200;
    padding: 8px 14px;
    border-radius: 20px;
    border: none;
    background: #343a40;
    color: white;
    font-size: 13px;
    cursor: pointer;
  }

  .follow.active {
    background: #28a745;
  }
</style>