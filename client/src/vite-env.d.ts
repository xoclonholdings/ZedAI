/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BACKEND_URL_SIMPLE: string
    readonly VITE_BACKEND_URL_AGENT: string
    readonly DEV: boolean
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
