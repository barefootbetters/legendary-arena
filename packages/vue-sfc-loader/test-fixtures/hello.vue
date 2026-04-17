<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<template>
  <div class="hello">Hello, {{ name }}!</div>
</template>

<style>
.hello {
  color: red;
}
</style>
