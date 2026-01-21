<script>
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { createClient } from "@supabase/supabase-js";

  // --- Supabase client ---
  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let map;
  let L;
  let channel;
  let connectionStatus = "Connecting…";

  const markers = {};
  const trails = {};
  const lastSeen = {};

  const STALE_MS = 30_000;      // Markers fade after 30s
  const REMOVE_MS = 60_000;     // Remove after 1min
  const MAX_TRAIL = 20;

  // --- HANDLE ---
  let handleInput = "";
  let targetHandle = null;

  // --- AUTO FOLLOW ---
  let autoFollow = true;
  let lastCenter = null;
  const FOLLOW_DISTANCE_M = 10;

  // --- HELPERS ---
  function normalizeHandle(h) {
    return h?.trim().toLowerCase() || null;
  }

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
    const { handle, lat, lng, status } = user;
    if (!trails[handle]) {
      trails[handle] = L.polyline([], {
        color: statusColor(status),
        weight: 3,
        opacity: 0.7
      }).addTo(map);
    }
    const latlngs = trails[handle].getLatLngs();
    latlngs.push([lat, lng]);
    if (latlngs.length > MAX_TRAIL) latlngs.shift();
    trails[handle].setLatLngs(latlngs);
  }

  function updateMarker(user) {
    const { handle, lat, lng, status, speed } = user;
    if (!lat || !lng || !handle) return;

    const normalizedHandle = normalizeHandle(handle);
    lastSeen[normalizedHandle] = Date.now();

    const popup = `
      <b>${handle}</b><br>
      ${status}<br>
      ${speed?.toFixed(2) ?? "0.00"} m/s
    `;

    if (markers[normalizedHandle]) {
      markers[normalizedHandle].setLatLng([lat, lng]);
      markers[normalizedHandle].setIcon(markerIcon(status));
    } else {
      markers[normalizedHandle] = L.marker([lat, lng], {
        icon: markerIcon(status)
      }).bindPopup(popup).addTo(map);
    }

    updateTrail({ ...user, handle: normalizedHandle });

    // AUTO FOLLOW
    if (autoFollow) {
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
    Object.keys(markers).forEach((h) => {
      const age = now - (lastSeen[h] || 0);
      if (age > REMOVE_MS) {
        map.removeLayer(markers[h]);
        map.removeLayer(trails[h]);
        delete markers[h];
        delete trails[h];
        delete lastSeen[h];
      }
    });
  }

  function jumpToHandle() {
    if (!handleInput) return;
    window.location.href = `/viewer?handle=${normalizeHandle(handleInput)}`;
  }

  // --- LIFECYCLE ---
  onMount(async () => {
    if (!browser) return;

    // --- URL PARAMS ---
    const params = new URLSearchParams(window.location.search);
    targetHandle = normalizeHandle(params.get("handle"));
    handleInput = targetHandle ?? "";

    // --- LEAFLET ---
    const Leaflet = await import("leaflet");
    await import("leaflet/dist/leaflet.css");
    L = Leaflet.default || Leaflet;

    map = L.map("map").setView([16.8661, 96.1951], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    map.on("dragstart zoomstart", () => (autoFollow = false));

    // --- FETCH LAST LOCATION ---
    if (targetHandle) {
      const { data } = await supabase
        .from("locations")
        .select("*")
        .eq("handle", targetHandle)
        .limit(1);

      data?.forEach(updateMarker);
    }

    // --- REALTIME ---
    channel = supabase
      .channel("live-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        (p) => {
          if (!p.new || !p.new.handle) return;
          if (targetHandle && normalizeHandle(p.new.handle) !== targetHandle)
            return;
          updateMarker(p.new);
        }
      )
      .subscribe();

    connectionStatus = "✅ Live";

    // --- CLEANUP INTERVAL ---
    setInterval(cleanupStale, 5_000);
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
    if (map) map.remove();
  });
</script>

<div class="viewer">
  <header>
    <input
      placeholder="Enter handle…"
      bind:value={handleInput}
      on:keydown={(e) => e.key === "Enter" && jumpToHandle()}
    />
    <button on:click={jumpToHandle}>Go</button>
    <span>{connectionStatus}</span>
  </header>

  <button class="follow" class:active={autoFollow} on:click={() => (autoFollow = !autoFollow)}>
    🧭 {autoFollow ? "Following" : "Free Pan"}
  </button>

  <div id="map"></div>
</div>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
  }

  header {
    height: 56px;
    background: #1e3c72;
    color: white;
    padding: 10px;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  header input {
    padding: 6px;
    border-radius: 4px;
    border: none;
  }

  header button {
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  #map {
    flex: 1;
  }

  .follow {
    position: absolute;
    top: 80px;
    right: 12px;
    z-index: 1100;
    padding: 10px 16px;
    border-radius: 30px;
    border: 2px solid white;
    background: #343a40;
    color: white;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-weight: bold;
    transition: all 0.2s ease;
  }

  .follow.active {
    background: #28a745;
  }

  .viewer {
    height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .follow:active {
    transform: scale(0.95);
  }
</style>
