<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let status = "Waiting for GPS permission...";
  let user_id = "";
  let watchId;

  // Function to send data manually for testing
  async function sendManualUpdate() {
    status = "🛰️ Requesting coordinates...";
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await uploadLocation(pos);
    }, (err) => {
      status = `❌ GPS Error: ${err.message}`;
    });
  }

  async function uploadLocation(pos) {
    const { latitude, longitude, speed } = pos.coords;
    const movement = speed < 0.5 ? "STATIONARY" : speed < 2 ? "WALKING" : "MOVING";
    
    status = `📡 Sending (${movement})...`;
    
    const { error } = await supabase.from("locations").upsert({
      user_id,
      lat: latitude,
      lng: longitude,
      speed: speed || 0,
      status: movement,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (error) {
      status = "⚠️ Supabase Error: " + error.message;
      console.error(error);
    } else {
      status = `✅ Last sent: ${new Date().toLocaleTimeString()}`;
    }
  }

  onMount(() => {
    // Browser check
    user_id = localStorage.getItem("user_id") || crypto.randomUUID();
    localStorage.setItem("user_id", user_id);

    if (!navigator.geolocation) {
      status = "❌ Geolocation not supported";
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => uploadLocation(pos),
      (err) => { status = "❌ GPS: " + err.message; },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  });

  onDestroy(() => {
    if (typeof navigator !== 'undefined' && watchId) navigator.geolocation.clearWatch(watchId);
  });
</script>

<div class="device">
  <h2>📱 Live Device Sender</h2>
  <div class="card">
    <p><strong>My ID:</strong><br /><small>{user_id}</small></p>
    <p class="status" class:error={status.includes('❌')}>{status}</p>
    <button on:click={sendManualUpdate}>Force Update Now</button>
  </div>
  <p class="hint">Leave this screen active while walking.</p>
</div>

<style>
  .device { padding: 2rem; text-align: center; font-family: sans-serif; }
  .card { background: #f9f9f9; padding: 20px; border-radius: 12px; border: 1px solid #ddd; }
  .status { font-weight: bold; color: #2c3e50; margin: 20px 0; }
  .error { color: #e74c3c; }
  button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
  .hint { opacity: 0.6; font-size: 0.8rem; margin-top: 20px; }
</style>
