<script setup lang="ts">
defineProps<{ username?: string; desktopMode?: boolean }>()
const emit = defineEmits<{ logout: [] }>()
const tabs = [
  { to: '/', label: '首页', index: '01' },
  { to: '/calendar', label: '年度日历', index: '02' },
  { to: '/add', label: '新增记录', index: '03' },
  { to: '/details', label: '请假明细', index: '04' },
  { to: '/settings', label: '设置', index: '05' },
]
</script>

<template>
  <header class="app-header">
    <RouterLink class="brand" to="/" aria-label="休假账本首页">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-copy">
        <strong>休假账本</strong>
        <small>LEAVE LEDGER · HK</small>
      </span>
    </RouterLink>
    <nav class="main-nav" aria-label="主导航">
      <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to">
        <span>{{ tab.index }}</span>{{ tab.label }}
      </RouterLink>
    </nav>
    <div v-if="!desktopMode && username" class="header-account">
      <span>{{ username }}</span>
      <button type="button" @click="emit('logout')">退出</button>
    </div>
  </header>
</template>
