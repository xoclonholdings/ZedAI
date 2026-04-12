const zedLogoSvg = `
<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="zed-gradient" x1="12" y1="8" x2="82" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#00F0FF"/>
      <stop offset="0.45" stop-color="#4E7BFF"/>
      <stop offset="1" stop-color="#FF3D9A"/>
    </linearGradient>
    <linearGradient id="zed-glow" x1="20" y1="18" x2="76" y2="78" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#91FEFF" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#FF8FCC" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="80" height="80" rx="22" fill="url(#zed-gradient)"/>
  <rect x="10.5" y="10.5" width="75" height="75" rx="19.5" stroke="url(#zed-glow)" stroke-opacity="0.65"/>
  <path d="M28 31H68L40.5 49.5H68V65H28L55.5 46.5H28V31Z" fill="white"/>
</svg>
`;

export const zedLogoSrc = `data:image/svg+xml;utf8,${encodeURIComponent(zedLogoSvg)}`;
