import type { Difficulty, ShotResult } from '../lib/physics'

/** UI-ის ქართული ტექსტები ერთ ადგილას */
export const T = {
  title: 'SPOT',
  subtitle: 'პენალტების სერია',
  difficulty: 'მეკარის დონე',
  start: 'დაწყება',
  you: 'შენ',
  bot: 'ბოტი',
  shootTurn: 'შენი დარტყმაა',
  keepTurn: 'შენი დაცვაა',
  aimHintShoot: 'ჩამოსვი და გაასრიალე — მიმართულება ამიზნებს, სიგრძე ძალას მატებს',
  aimHintKeep: 'გაასრიალე იქით, საითაც ეშვები',
  timingHintShoot: 'შეაჩერე ცენტრში',
  timingHintKeep: 'შეაჩერე ცენტრში — ნაადრევი დივი ჯარიმაა',
  tapToStop: 'დააჭირე გასაჩერებლად',
  next: 'შემდეგი',
  again: 'თავიდან',
  menu: 'მენიუ',
  suddenDeath: 'გადამწყვეტი სერია',
  kick: 'დარტყმა',
  won: 'მოიგე',
  lost: 'წააგე',
} as const

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'მარტივი',
  normal: 'საშუალო',
  hard: 'რთული',
}

export const DIFFICULTY_NOTE: Record<Difficulty, string> = {
  easy: 'ნელი რეაქცია, მოკლე წვდომა',
  normal: 'თანაბარი მოწინააღმდეგე',
  hard: 'სწრაფი რეაქცია, გრძელი წვდომა',
}

/** შედეგის სათაური — ბოძს და აღებას სხვადასხვა ხმა აქვს (§5) */
export const RESULT_LABEL: Record<ShotResult, string> = {
  goal: 'გოლი',
  save: 'აღება',
  post: 'ბოძი',
  out: 'აუტი',
  rebound: 'მოგერიება',
}
