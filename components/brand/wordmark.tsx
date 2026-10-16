// Logotipo de Mova: "mova" en Instrument Sans (peso 600, espaciado ajustado a
// mano) convertido a trazos, con el movimiento naranja de Kodexa bajo la "o".
// Es un SVG vectorial: se ve nítido en cualquier tamaño y no depende de que la
// fuente esté cargada. El naranja es su único uso en la interfaz.
// La misma pieza está en public/brand/mova-wordmark.svg para usos fuera de la app.

const VIEWBOX = "59 -538 2470 735";
const LETTERS = "M67 0V-510H190V-390H193V0ZM410 0V-329Q410 -374 388 -395Q365 -417 324 -417Q288 -417 258 -400Q228 -383 210 -352Q193 -321 193 -280L180 -397Q206 -453 255 -487Q304 -520 369 -520Q447 -520 492 -476Q537 -431 537 -361V0ZM753 0V-329Q753 -374 731 -395Q709 -417 668 -417Q631 -417 601 -400Q571 -383 554 -352Q537 -321 537 -280L515 -397Q540 -453 591 -487Q642 -520 709 -520Q789 -520 835 -474Q880 -429 880 -354V0Z M1204 10Q1123 10 1061 -24Q1000 -58 966 -118Q932 -179 932 -257Q932 -335 966 -394Q1000 -453 1062 -487Q1123 -520 1204 -520Q1286 -520 1347 -487Q1408 -453 1442 -394Q1476 -335 1476 -257Q1476 -179 1442 -118Q1407 -58 1346 -24Q1285 10 1204 10ZM1204 -91Q1244 -91 1276 -112Q1308 -132 1326 -170Q1344 -207 1344 -258Q1344 -333 1304 -376Q1265 -419 1204 -419Q1143 -419 1103 -376Q1063 -333 1063 -258Q1063 -207 1081 -170Q1100 -132 1132 -112Q1163 -91 1204 -91Z M1701 0 1497 -510H1633L1796 -41H1729L1892 -510H2024L1819 0Z M2395 0Q2390 -20 2388 -44Q2385 -68 2385 -102H2381V-344Q2381 -384 2358 -404Q2336 -425 2290 -425Q2245 -425 2218 -409Q2192 -392 2186 -361H2065Q2073 -432 2133 -476Q2193 -520 2294 -520Q2399 -520 2453 -472Q2507 -425 2507 -333V-102Q2507 -78 2510 -53Q2514 -28 2521 0ZM2218 10Q2141 10 2096 -28Q2050 -67 2050 -132Q2050 -202 2101 -243Q2152 -284 2245 -298L2404 -322V-242L2266 -221Q2221 -214 2198 -196Q2176 -178 2176 -146Q2176 -117 2197 -101Q2218 -86 2255 -86Q2309 -86 2345 -113Q2381 -140 2381 -179L2395 -102Q2375 -47 2329 -19Q2284 10 2218 10Z";
const MOTION = "M932 140 C1006 116 1129 116 1204 140 S1401 164 1476 140";

// height: alto en px del logotipo completo (letras y trazo).
export function Wordmark({ className = "", height = 18 }: { className?: string; height?: number }) {
  return (
    <svg
      viewBox={VIEWBOX}
      role="img"
      aria-label="Mova"
      className={`block w-auto shrink-0 text-ink ${className}`}
      style={{ height }}
    >
      <path d={LETTERS} fill="currentColor" />
      <path d={MOTION} fill="none" stroke="var(--color-kodexa)" strokeWidth="64" strokeLinecap="round" />
    </svg>
  );
}
