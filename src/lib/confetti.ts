import confetti from "canvas-confetti"

export function celebrate() {
  confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ["#ffd60a", "#00c2ff", "#a855f7", "#22c55e"] })
}
