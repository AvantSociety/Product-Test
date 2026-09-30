import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Product-Test/',
  // The search worker (src/workers/embedWorker.js) imports transformers.js,
  // which splits into chunks; only ES module workers can load those.
  worker: { format: 'es' },
  resolve: {
    alias: {
      // transformers.js imports the WebGPU build of the ONNX runtime, which
      // makes Vite emit an unused 27 MB WebGPU runtime. Search runs on the
      // CPU only, so the CPU-only build is used instead.
      'onnxruntime-web/webgpu': 'onnxruntime-web/wasm',
    },
  },
})
