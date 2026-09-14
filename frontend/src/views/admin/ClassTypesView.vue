<script setup lang="ts">
import { ref, watch } from 'vue'
import { adminFetch, adminList, type Paged } from '@/api/admin'
import AdminShell from '@/components/admin/AdminShell.vue'
import DataTable from '@/components/admin/DataTable.vue'

type Template = {
  id: string
  name: string
  family: string | null
  programme: string | null
  defaultDurationMin: number
  category: string
  color: string
}
type Category = { id: string; slug: string; label: string; colorHex: string }

const result = ref<Paged<Template> | null>(null)
const categories = ref<Category[]>([])
const loading = ref(true)
const page = ref(1)
const query = ref('')

async function load() {
  loading.value = true
  result.value = await adminList<Template>('/admin/class-templates', {
    page: page.value,
    limit: 25,
    q: query.value || undefined,
  })
  loading.value = false
}

async function loadCategories() {
  const res = await adminFetch<Category[]>('/admin/categories')
  categories.value = res ?? []
}

watch([page, query], load, { immediate: true })
loadCategories()

async function setColor(cat: Category, colorHex: string) {
  await adminFetch(`/admin/categories/${cat.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ colorHex }),
  })
  await Promise.all([loadCategories(), load()])
}
</script>

<template>
  <AdminShell>
    <h1 class="text-[20px] font-semibold text-ink">Class types</h1>
    <p class="mt-1 max-w-[60ch] text-[14px] text-ink-muted">
      Studios name the same class differently, so each class type belongs to a
      family. Members filter by family; the schedule still shows the studio's own
      name.
    </p>

    <section class="mt-5">
      <h2 class="text-[14px] font-semibold text-ink">Category colours</h2>
      <div class="mt-2 flex flex-wrap gap-2">
        <label
          v-for="cat in categories"
          :key="cat.id"
          class="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-[13px] ring-1 ring-line/70"
        >
          <input
            type="color"
            :value="cat.colorHex"
            class="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
            :aria-label="`Colour for ${cat.label}`"
            @change="setColor(cat, ($event.target as HTMLInputElement).value)"
          />
          {{ cat.label }}
        </label>
      </div>
    </section>

    <input
      v-model="query"
      type="search"
      placeholder="Search class types"
      aria-label="Search class types"
      class="mt-5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] lg:max-w-xs"
      @input="page = 1"
    />

    <div class="mt-4">
      <DataTable
        :rows="result?.data ?? []"
        :columns="[
          { key: 'name', label: 'Name' },
          { key: 'family', label: 'Family' },
          { key: 'category', label: 'Category' },
          { key: 'programme', label: 'Programme' },
          { key: 'duration', label: 'Default' },
        ]"
        :loading="loading"
        :total="result?.meta.total"
        :page="result?.meta.page"
        :limit="result?.meta.limit"
        @change-page="page = $event"
      >
        <template #row="{ row }">
          <td class="px-4 py-2.5 font-medium text-ink">{{ (row as Template).name }}</td>
          <td class="px-4 py-2.5 text-ink-muted">{{ (row as Template).family ?? '—' }}</td>
          <td class="px-4 py-2.5">
            <span class="inline-flex items-center gap-2 text-ink-muted">
              <span class="h-2 w-2 rounded-full" :style="{ background: (row as Template).color }" />
              {{ (row as Template).category }}
            </span>
          </td>
          <td class="px-4 py-2.5 text-ink-muted">{{ (row as Template).programme ?? '—' }}</td>
          <td class="tnum px-4 py-2.5 text-ink-muted">{{ (row as Template).defaultDurationMin }}m</td>
          <td />
        </template>
      </DataTable>
    </div>
  </AdminShell>
</template>
