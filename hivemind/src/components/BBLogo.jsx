export default function BBLogo({ size = 28 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="bbl-k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D3EBDA" /><stop offset="1" stopColor="#BFE0C8" /></linearGradient>
        <linearGradient id="bbl-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#68A4C2" /><stop offset="1" stopColor="#5C9AB8" /></linearGradient>
        <linearGradient id="bbl-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#477451" /><stop offset="1" stopColor="#3E6448" /></linearGradient>
        <linearGradient id="bbl-t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B05A6F" /><stop offset="1" stopColor="#A85268" /></linearGradient>
        <clipPath id="bbl-c"><path d="M16 1.5 28.56 8.75v14.5L16 30.5 3.44 23.25V8.75Z" /></clipPath>
      </defs>
      <g clipPath="url(#bbl-c)">
        <rect width="32" height="32" fill="url(#bbl-k)" />
        <path d="M0 15.5C8 11.5 14 14 20 12S28 9 32 10V32H0Z" fill="url(#bbl-s)" />
        <path d="M0 20.5C7 17.5 13 19.5 19 17.5S27 15.5 32 16.5V32H0Z" fill="url(#bbl-p)" />
        <path d="M0 27C7 24 13 26 19 24S27 22 32 23V32H0Z" fill="url(#bbl-t)" />
      </g>
    </svg>
  );
}
