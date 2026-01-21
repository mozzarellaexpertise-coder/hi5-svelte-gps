<script>
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { createClient } from "@supabase/supabase-js";

  // ---------------- SUPABASE ----------------
  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  // ---------------- STATE ----------------
  let map;
  let L;
  let channel;
  let cleanupTimer;

  let connectionStatus = "Connecting…";

  const markers = {};
  const trails = {};
  const lastSeen = {};

  const STALE_MS = 30_000;
  const REMOVE_MS = 60_000;
  const MAX_TRAIL = 20;

  // ---------------- HANDLE ----------------
  let handleInput = "";
  let targetHandle = null;

  // ---------------- AUTO FOLLOW ----------------
  let autoFollow = true;
  let lastCenter = null;
  const FOLLOW_DISTANCE_M = 10;

  // ---------------- HELPERS ----------------
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
    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          background:${statusColor(status)};
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

  // ---------------- TRAILS ----------------
  function updateTrail({ handle, lat, lng, status }) {
    if (!trails[handle]) {
      trails[handle] = L.polyline([], {
        weight: 3,
        opacity: 0.7
      }).addTo(map);
    }

    trails[handle].setStyle({ color: statusColor(status) });

    const latlngs = trails[handle].getLatLngs();
    latlngs.push([lat, lng]);
    if (latlngs.length > MAX_TRAIL) latlngs.shift();
    trails[handle].setLatLngs(latlngs);
  }

  // ---------------- MARKERS ----------------
  function updateMarker(user) {
    const { handle, lat, lng, status, speed } = user;
    if (!handle || lat == null || lng == null) return;

    const h = normalizeHandle(handle);
    lastSeen[h] = Date.now();

    const popup = `
      <b>${handle}</b><br>
      ${status}<br>
      ${(speed ?? 0).toFixed(2)} m/s
    `;

    if (markers[h]) {
      markers[h]
        .setLatLng([lat, lng])
        .setIcon(markerIcon(status))
        .setPopupContent(popup);
    } else {
      markers[h] = L.marker([lat, lng], {
        icon: markerIcon(status)
      })
        .bindPopup(popup)
        .addTo(map);
    }

    updateTrail({ handle: h, lat, lng, status });

    // ---------- AUTO FOLLOW (TARGET ONLY) ----------
    if (autoFollow && (!targetHandle || h === targetHandle)) {
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

  // ---------------- CLEANUP ----------------
  function cleanupStale() {
    const now = Date.now();

    Object.keys(markers).forEach((h) => {
      const age = now - (lastSeen[h] || 0);

      if (age > STALE_MS && age < REMOVE_MS) {
        markers[h].setIcon(markerIcon("STATIONARY", 0.4));
      }

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

  // ---------------- LIFECYCLE ----------------
  onMount(async () => {
    if (!browser) return;

    const params = new URLSearchParams(window.location.search);
    targetHandle = normalizeHandle(params.get("handle"));
    handleInput = targetHandle ?? "";

    const Leaflet = await import("leaflet");
    await import("leaflet/dist/leaflet.css");
    L = Leaflet.default || Leaflet;

    map = L.map("map").setView([16.8661, 96.1951], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    map.on("dragstart zoomstart", () => (autoFollow = false));

    // ----- FETCH LAST KNOWN -----
    if (targetHandle) {
      const { data } = await supabase
        .from("locations")
        .select("*")
        .eq("handle", targetHandle)
        .limit(1);

      data?.forEach(updateMarker);
    }

    // ----- REALTIME -----
    channel = supabase
      .channel("live-locations")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "locations" },
        (p) => {
          if (!p.new?.handle) return;
          if (targetHandle && normalizeHandle(p.new.handle) !== targetHandle)
            return;
          updateMarker(p.new);
        }
      )
      .subscribe();

    connectionStatus = "✅ Live";

    cleanupTimer = setInterval(cleanupStale, 5000);
  });

  onDestroy(() => {
    if (cleanupTimer) clearInterval(cleanupTimer);
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

  <button
    class="follow"
    class:active={autoFollow}
    on:click={() => (autoFollow = !autoFollow)}
  >
    🧭 {autoFollow ? "Following" : "Free Pan"}
  </button>

  <div id="map"></div>
</div>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
  }

  .viewer {
    height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
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

  header input,
  header button {
    padding: 6px;
    border-radius: 4px;
    border: none;
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
    font-weight: bold;
  }

  .follow.active {
    background: #28a745;
  }
</style>