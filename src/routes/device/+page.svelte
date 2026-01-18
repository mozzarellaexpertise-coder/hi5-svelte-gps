<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    "https://nmzhlzkrkacftsbcvyka.supabase.co",
    "YOUR_PUBLIC_ANON_KEY"
  );

  let status = "Initializing…";
  let lastSent = 0;
  let watchId;

  // Persistent device/user id
  let user_id =
    localStorage.getItem("user_id") ||
    crypto.randomUUID();

  localStorage.setItem("user_id", user_id);

  const SEND_INTERVAL = 3000; // ms (3 seconds)

  onMount(() => {
    if (!navigator.geolocation) {
      status = "❌ Geolocation not supported";
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      async pos => {
        const now = Date.now();
        if (now - lastSent < SEND_INTERVAL) return;

        lastSent = now;

        const { latitude, longitude, speed } = pos.coords;

        const movement =
          speed < 0.5 ? "STATIONARY" :
          speed < 2 ? "WALKING" :
          "MOVING";

        status = `📡 Sending (${movement})`;

        const { error } = await supabase
          .from("locations")
          .upsert({
            user_id,
            lat: latitude,
            lng: longitude,
            speed,
            status: movement,
            updated_at: new Date()
          });

        if (error) {
          console.error(error);
          status = "⚠️ Send failed";
        }
      },
      err => {
        console.error(err);
        status = "❌ GPS error";
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000
      }
    );
  });

  onDestroy(() => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
  });
</script>

<div class="device">
  <h2>📱 Live Device Sender</h2>

  <p><strong>User ID:</strong><br />{user_id}</p>
  <p class="status">{status}</p>

  <p class="hint">
    Keep this page open.<br />
    Your movement appears on the viewer map.
  </p>
</div>

<style>
  .device {
    padding: 1.5rem;
    max-width: 420px;
    margin: auto;
    font-family: system-ui, sans-serif;
    text-align: center;
  }

  h2 {
    margin-bottom: 1rem;
  }

  .status {
    margin-top: 1rem;
    font-size: 1.1rem;
  }

  .hint {
    margin-top: 2rem;
    opacity: 0.7;
    font-size: 0.9rem;
  }
</style>
