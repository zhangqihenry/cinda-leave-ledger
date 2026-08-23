<script setup lang="ts">
const emit = defineEmits<{ empty: []; import: []; folder: [] }>()
</script>

<template>
  <div class="modal-backdrop">
    <section class="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <span class="welcome-index">00 / FIRST USE</span>
      <h2 id="welcome-title">开始建立你的休假账本</h2>
      <p>当前目录中没有找到 leave-records.json 或 leave-records.csv。请选择一种开始方式。</p>
      <div class="welcome-options">
        <button type="button" @click="emit('import')"><span>01</span><strong>导入 OA 记录</strong><small>选择 OA 导出的 CSV，自动筛除未完成或未通过审批的记录。</small></button>
        <button type="button" @click="emit('folder')"><span>02</span><strong>连接数据文件夹</strong><small>读取或建立 leave-records.json 和 leave-config.json。</small></button>
        <button type="button" @click="emit('empty')"><span>03</span><strong>从零开始</strong><small>先建立空账本，之后再手动新增或导入记录。</small></button>
      </div>
    </section>
  </div>
</template>
