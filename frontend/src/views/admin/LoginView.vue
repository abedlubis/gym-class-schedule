<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const { signIn } = useAuth()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = ''
  const result = await signIn(email.value, password.value)
  busy.value = false
  if (result.ok) router.replace((route.query.next as string) ?? '/admin/slots')
  else error.value = result.message
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="w-full max-w-sm rounded-2xl bg-surface p-6 ring-1 ring-line/70">
      <p class="font-display text-[20px] font-bold text-wordmark">AF</p>
      <h1 class="mt-1 text-[18px] font-semibold text-ink">Schedule admin</h1>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <div>
          <label for="email" class="mb-1 block text-[13px] font-medium text-ink-muted">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            required
            class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] text-ink focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label for="password" class="mb-1 block text-[13px] font-medium text-ink-muted">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] text-ink focus:border-primary focus:outline-none"
          />
        </div>

        <!-- One message for every failure mode. Anything more specific turns
             this form into an account enumerator. -->
        <p v-if="error" role="alert" class="text-[13px] text-[#8A2C2C]">{{ error }}</p>

        <button
          type="submit"
          :disabled="busy"
          class="w-full rounded-lg bg-primary py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>
