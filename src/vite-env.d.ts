/// <reference types="vite/client" />

// Type declarations for vite-imagetools
declare module '*?format=webp&quality=80' {
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