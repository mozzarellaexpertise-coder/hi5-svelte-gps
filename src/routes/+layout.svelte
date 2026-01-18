<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>APK-PARADISE | Command Center</title>
</svelte:head>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		width: 100vw;
		height: 100vh;
		overflow: hidden; /* Prevents double scrollbars on the monitor */
		background-color: #000;
		color: white;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>

{@render children?.()}
