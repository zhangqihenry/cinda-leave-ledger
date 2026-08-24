<script setup lang="ts">
withDefaults(defineProps<{ desktopMode?: boolean }>(), { desktopMode: false })
const emit = defineEmits<{ empty: []; import: []; folder: []; settings: [] }>()
</script>

<template>
  <div class="modal-backdrop">
    <section class="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <span class="welcome-index">00 / FIRST USE</span>
      <h2 id="welcome-title">开始建立你的休假账本</h2>
      <p v-if="desktopMode">这是程序第一次运行。开始使用前，建议先设置当年的年假、特别假天数，并上传从 OA 系统导出的请假记录。</p>
      <p v-else>当前目录中没有找到 leave-records.json 或 leave-records.csv。请选择一种开始方式。</p>
      <div class="welcome-options">
        <button v-if="desktopMode" type="button" @click="emit('settings')"><span>01</span><strong>设置假期额度</strong><small>前往设置页面，填写当年的年假和特别假天数。</small></button>
        <button type="button" @click="emit('import')"><span>{{ desktopMode ? '02' : '01' }}</span><strong>导入 OA 记录</strong><small>建议选择 OA 导出的 CSV，系统会自动筛除未完成或未通过审批的记录。</small></button>
        <button v-if="!desktopMode" type="button" @click="emit('folder')"><span>02</span><strong>连接数据文件夹</strong><small>读取或建立 leave-records.json 和 leave-config.json。</small></button>
        <button type="button" @click="emit('empty')"><span>03</span><strong>{{ desktopMode ? '稍后处理' : '从零开始' }}</strong><small>{{ desktopMode ? '先进入空账本，之后可在设置和新增记录页面完成上述操作。' : '先建立空账本，之后再手动新增或导入记录。' }}</small></button>
      </div>
    </section>
  </div>
</template>
