<script>
  import { onMount } from 'svelte';
  // Automatically send users to the viewer page
  onMount(() => {
    window.location.href = '/viewer';
  });
</script>

<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
  <p>Redirecting to Live Traffic Monitor...</p>
</div>