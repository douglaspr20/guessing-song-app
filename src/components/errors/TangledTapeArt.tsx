"use client";

import { useI18n } from "@/i18n/client";
import styles from "./errors.module.css";

const TAPE = "#5b3a1e"; // cinta magnética (mismo marrón que las bobinas del casete)
const c = (fill: string) => ({ fill });

/**
 * Casete partido: grieta de lado a lado, la cinta hecha un lío saliendo por la ventana y un lápiz
 * metido en la bobina, el truco de toda la vida para rebobinar. La carcasa da un respingo al
 * aparecer y el lápiz gira de vez en cuando; con movimiento reducido todo queda quieto.
 */
export function TangledTapeArt() {
  const { m } = useI18n();
  return (
    <svg className={styles.broken} viewBox="0 0 420 400" role="img" aria-label={m.common.errorPage.tangledArt}>
      <g className={styles.shell}>
        {/* Carcasa con tornillos */}
        <rect x="20" y="20" width="380" height="240" rx="26" style={c("var(--shell)")} />
        {[
          [46, 46],
          [374, 46],
          [46, 234],
          [374, 234],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="8" style={c("var(--shell-hi)")} />
        ))}

        {/* Etiqueta de cartulina con tres rayas y el título escrito a mano */}
        <rect x="58" y="40" width="304" height="62" rx="6" style={c("var(--card)")} />
        <rect x="58" y="40" width="304" height="6" style={c("var(--saffron)")} />
        <rect x="58" y="46" width="304" height="6" style={c(TAPE)} />
        <rect x="58" y="52" width="304" height="6" style={c("var(--sky)")} />
        <text x="74" y="90" style={{ fill: "var(--ink)", fontFamily: "var(--font-script)", fontWeight: 700, fontSize: 26 }}>
          {m.common.errorPage.tangledLabel}
        </text>

        {/* Ventana con las bobinas: la izquierda aún tiene cinta, la derecha quedó vacía */}
        <rect x="100" y="118" width="220" height="70" rx="35" style={c("var(--window)")} />
        <circle cx="150" cy="153" r="30" style={c(TAPE)} />
        <circle cx="150" cy="153" r="19" style={c("var(--card)")} />
        <circle cx="150" cy="153" r="7" style={c("var(--window)")} />
        <circle cx="270" cy="153" r="19" style={c("var(--card)")} />
        <circle cx="270" cy="153" r="7" style={c("var(--window)")} />

        {/* Rampa inferior */}
        <path d="M118 260 L140 214 H280 L302 260 Z" style={c("var(--shell-hi)")} />

        {/* La grieta: tinta gruesa con un filo claro, se lee sobre carcasa y sobre cartulina */}
        <polyline
          points="244,20 226,64 250,98 222,140 254,182 232,226 248,260"
          style={{ fill: "none", stroke: "var(--ink)", strokeWidth: 9, strokeLinejoin: "bevel" }}
        />
        <polyline
          points="244,20 226,64 250,98 222,140 254,182 232,226 248,260"
          style={{ fill: "none", stroke: "var(--on-shell-soft)", strokeWidth: 2.5, strokeLinejoin: "bevel" }}
        />
      </g>

      {/* La cinta enredada: sale por la ventana y se enrosca por debajo del casete */}
      <path
        d="M196 186 C 186 236, 116 236, 108 282 S 176 352, 150 322 S 52 300, 74 352 S 214 392, 236 344 S 318 300, 300 266 S 230 246, 268 228 S 352 262, 372 306 S 340 380, 300 372"
        style={{ fill: "none", stroke: TAPE, strokeWidth: 8, strokeLinecap: "round", strokeLinejoin: "round" }}
      />
      <path
        d="M214 188 C 230 222, 270 214, 262 250 S 196 290, 222 318"
        style={{ fill: "none", stroke: TAPE, strokeWidth: 6, strokeLinecap: "round" }}
      />

      {/* El lápiz clavado en la bobina izquierda */}
      <g className={styles.pencil}>
        <g transform="rotate(-38 150 153)">
          <rect x="4" y="145" width="16" height="16" rx="4" style={c("var(--tomato)")} />
          <rect x="20" y="145" width="14" height="16" style={c("var(--on-shell-soft)")} />
          <rect x="34" y="145" width="86" height="16" style={c("var(--card-rule)")} />
          <rect x="34" y="151" width="86" height="4" style={{ fill: "var(--ink)", opacity: 0.18 }} />
          <path d="M120 145 L144 153 L120 161 Z" style={c("var(--card)")} />
          <path d="M136 150.4 L150 153 L136 155.6 Z" style={c("var(--ink)")} />
        </g>
      </g>
    </svg>
  );
}
