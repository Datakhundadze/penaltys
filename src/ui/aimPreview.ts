import type { Swipe } from '../lib/controls'

/**
 * მიმდინარე მოსმის ცოცხალი მდგომარეობა — განზრახ zustand-ის გარეთ.
 *
 * თითის ყოველ მოძრაობაზე store-ში ჩაწერა მთელ React-ის ხეს ხელახლა
 * არენდერებდა და მობილურზე რეტიკული თითს ჩამორჩებოდა. აქ ჩვეულებრივი
 * მუტაბელური ობიექტია: AimSurface წერს pointermove-ზე, AimReticle
 * კითხულობს პირდაპირ useFrame-ში — შუაში React არ დგას.
 *
 * თამაშის ლოგიკა ამას არასდროს კითხულობს; store-ში მხოლოდ დადასტურებული
 * მოსმა ხვდება (commitAim), ასე რომ resolve-ჯერ-ანიმაცია-მერე წესი უცვლელია.
 */
export const aimPreview: { swipe: Swipe | null } = { swipe: null }
