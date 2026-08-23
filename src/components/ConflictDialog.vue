<script setup lang="ts">
import { formatChineseDate } from '../services/date'
import type { ImportPreview } from '../types'

defineProps<{ preview: ImportPreview }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <section class="conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <header>
        <div><p class="eyebrow">DUPLICATE REVIEW / 重复检查</p><h2 id="conflict-title">发现 {{ preview.conflicts.length }} 项冲突</h2></div>
        <button class="icon-button" type="button" aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <p class="dialog-intro">请逐项选择保留现有记录，或使用本次导入的记录替换现有记录。</p>
      <div class="conflict-list">
        <article v-for="conflict in preview.conflicts" :key="conflict.id" class="conflict-item">
          <div class="conflict-reason"><span v-for="reason in conflict.reasons" :key="reason">{{ reason }}</span></div>
          <div class="conflict-choice-grid">
            <label :class="{ selected: conflict.resolution === 'existing' }">
              <input v-model="conflict.resolution" type="radio" value="existing" />
              <span>保留现有</span><strong>{{ conflict.existing[0]?.leaveType }} · {{ conflict.existing[0]?.documentNo || '手动记录' }}</strong>
              <small>{{ formatChineseDate(conflict.existing[0]?.startDate || '') }} 至 {{ formatChineseDate(conflict.existing[0]?.endDate || '') }}</small>
            </label>
            <label :class="{ selected: conflict.resolution === 'incoming' }">
              <input v-model="conflict.resolution" type="radio" value="incoming" />
              <span>使用导入</span><strong>{{ conflict.incoming.leaveType }} · {{ conflict.incoming.documentNo || '无文号' }}</strong>
              <small>{{ formatChineseDate(conflict.incoming.startDate) }} 至 {{ formatChineseDate(conflict.incoming.endDate) }}</small>
            </label>
          </div>
        </article>
      </div>
      <footer><button class="button secondary" type="button" @click="emit('close')">返回检查</button><button class="button primary" type="button" @click="emit('confirm')">确认并导入</button></footer>
    </section>
  </div>
</template>
