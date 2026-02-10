<script setup lang="ts">
import { VPageHeader } from '@halo-dev/components'
import { RouterView } from 'vue-router'
</script>

<template>
  <VPageHeader title="日程" />
  <div class="layout-page">
    <RouterView />
  </div>
</template>

<style scoped>
.layout-page {
  padding: 16px;
}
</style>
