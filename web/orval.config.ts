import { defineConfig } from 'orval'

export default defineConfig({
  // IAM / Identity
  identity: {
    input: {
    target: '../api/swagger.json',
    },
    output: {
      mode: 'tags-split',           // Tách file theo từng controller tag
      target: './lib/api/generated',
      schemas: './lib/api/model',   // TypeScript types
      client: 'react-query',        // Tạo TanStack Query hooks
      httpClient: 'axios',
      override: {
        mutator: {
          path: './lib/api/axios-instance.ts',  // Axios instance custom (gắn token JWT)
          name: 'customAxiosInstance',
        },
        query: {
          signal: true,             // AbortController support
        },
      },
    },
  },
})
