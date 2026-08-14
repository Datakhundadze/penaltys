/**
 * გათამაშების კადრის მდგომარეობა — სუფთა ფუნქცია, რომ ტესტირებადი იყოს.
 *
 * ინვარიანტი: ყოველი რაუნდი იწყება ორივე ფიგურის იდლი პოზით.
 * 'hold' მხოლოდ შედეგის ეკრანზეა დასაშვები; ყველა სხვა არა-ანიმაციურ
 * ფაზაში კადრი იდლია, მიუხედავად იმისა, რა მოხდა წინა რაუნდში.
 */

import type { Phase } from './store'

export type FrameKind = 'idle' | 'hold' | 'live'

export function frameKind(phase: Phase, hasPlan: boolean): FrameKind {
  if (phase === 'animating' && hasPlan) return 'live'
  if (phase === 'between-rounds' && hasPlan) return 'hold'
  return 'idle'
}
