"use client"

import { animate, motion, type MotionValue } from "framer-motion"
import { randomInt } from "@/lib/random"

export type WheelItem = { id: number; text: string; weight: number }
export type Slice<T extends WheelItem> = { item: T; start: number; end: number; color: string }

const COLORS = ["#7c3aed", "#0ea5e9", "#f59e0b", "#ec4899", "#22c55e", "#ef4444", "#6366f1", "#14b8a6"]
const SIZE = 500
const R = SIZE / 2

function polar(angleDeg: number, radius: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return [R + radius * Math.cos(a), R + radius * Math.sin(a)]
}

function slicePath(start: number, end: number) {
  const [x1, y1] = polar(start, R - 4)
  const [x2, y2] = polar(end, R - 4)
  const large = end - start > 180 ? 1 : 0
  return `M ${R} ${R} L ${x1} ${y1} A ${R - 4} ${R - 4} 0 ${large} 1 ${x2} ${y2} Z`
}

export function buildSlices<T extends WheelItem>(list: T[]): Slice<T>[] {
  const total = list.reduce((s, r) => s + r.weight, 0)
  let acc = 0
  return list.map((item, i) => {
    const start = (acc / total) * 360
    acc += item.weight
    const end = (acc / total) * 360
    return { item, start, end, color: COLORS[i % COLORS.length] }
  })
}

/** Dreht das Rad so, dass der Zeiger (oben) auf einer zufälligen Stelle im Ziel-Segment landet. */
export async function spinTo(rotation: MotionValue<number>, slice: { start: number; end: number }) {
  const margin = (slice.end - slice.start) * 0.15
  const target = slice.start + margin + (randomInt(1000) / 1000) * (slice.end - slice.start - 2 * margin)
  const now = rotation.get()
  const base = now - (now % 360)
  const final = base + 360 * (6 + randomInt(3)) + (360 - target)
  await animate(rotation, final, { duration: 5.5, ease: [0.12, 0.8, 0.2, 1] })
}

export function WheelSvg<T extends WheelItem>({ slices, rotation }: { slices: Slice<T>[]; rotation: MotionValue<number> }) {
  return (
    <div className="relative w-full max-w-[520px]">
      <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 text-5xl text-accent drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]">▼</div>
      <motion.svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full drop-shadow-2xl" style={{ rotate: rotation }}>
        <circle cx={R} cy={R} r={R - 1} fill="#0b0a1f" stroke="#ffd60a" strokeWidth="4" />
        {slices.map(({ item, start, end, color }) => {
          const mid = (start + end) / 2
          const [tx, ty] = polar(mid, R * 0.6)
          const label = item.text.length > 26 ? item.text.slice(0, 25) + "…" : item.text
          return (
            <g key={item.id}>
              <path d={slicePath(start, end)} fill={color} stroke="#0b0a1f" strokeWidth="3" />
              {slices.length === 1 && <circle cx={R} cy={R} r={R - 4} fill={color} />}
              <text
                x={tx}
                y={ty}
                fill="white"
                fontSize={slices.length > 10 ? 14 : 17}
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid - 90} ${tx} ${ty})`}
                style={{ paintOrder: "stroke", stroke: "#0008", strokeWidth: 3 }}
              >
                {label}
              </text>
            </g>
          )
        })}
        <circle cx={R} cy={R} r={34} fill="#ffd60a" stroke="#0b0a1f" strokeWidth="4" />
      </motion.svg>
    </div>
  )
}
