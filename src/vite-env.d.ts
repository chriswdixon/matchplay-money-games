/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Type declarations for vite-imagetools
declare module '*?format=webp&quality=80' {
  const src: string;
  export default src;
}

declare module '*?format=webp&quality=55&w=1280' {
  const src: string;
  export default src;
}

declare module '*?format=webp' {
  const src: string;
  export default src;
}

declare module '*?format=avif' {
  const src: string;
  export default src;
}