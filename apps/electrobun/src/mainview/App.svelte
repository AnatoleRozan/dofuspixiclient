<script lang="ts">
  import { onMount } from 'svelte';
  import MapRenderer from '@/components/MapRenderer.svelte';

  let windowHeight = 0;
  let windowWidth = 0;

  function handleResize() {
    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;
  }

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<main>
  <div class="content">
    <MapRenderer />
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  main {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
  }
</style>
