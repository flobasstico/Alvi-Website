"use client"

import { RuleBoard } from "@/components/escalation/rule-board"
import { useEscalation, type EscState } from "@/components/escalation/use-escalation"

// OBS-Browserquellen dürfen ohne Klick Ton abspielen – Alarm ist hier immer an
export function OverlayBoard({ initial, serverNow }: { initial: EscState; serverNow: number }) {
  const { session, rules, now, newest, openPoll } = useEscalation(initial, serverNow, { sound: true })
  return (
    <div className="p-3">
      <RuleBoard session={session} rules={rules} now={now} newest={newest} poll={openPoll} overlay />
    </div>
  )
}
