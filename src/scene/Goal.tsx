import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { netRipple } from '../lib/flight'
import { GOAL_HALF_WIDTH, GOAL_HEIGHT, POST_RADIUS } from '../lib/geometry'

export interface NetImpact {
  /** შეხების წერტილი ნორმალიზებულ კარის კოორდინატებში */
  readonly x: number
  readonly y: number
  /** სცენის საათის დროშტამპი (წმ) */
  readonly at: number
  readonly strength: number
}

export interface PostFlash {
  /** −1 მარცხენა ბოძი, 1 მარჯვენა */
  readonly side: -1 | 1
  readonly at: number
}

export interface GoalProps {
  impact: NetImpact | null
  /** ბოძში მოხვედრა — §5-ის „ტკბილი მომენტი", აღებისგან განსხვავებული */
  postFlash: PostFlash | null
  reducedMotion?: boolean
}

/**
 * ბადის ფორმა — ყუთისებრი კარკასი:
 *   ჭერი გვირგვინიდან უკანა რელსამდე, უკანა პანელი რელსიდან მიწამდე,
 *   გვერდები სამკუთხაპროფილიანი. ჰორიზონტალური ძაფები ჩამოკიდებულია
 *   (კატენარი), უკანა პანელს მუცელი აქვს.
 */
const BACK_TOP_Y = 1.5 // უკანა რელსის სიმაღლე
const BACK_TOP_Z = -1.55 // უკანა რელსი
const BACK_BOT_Z = -1.85 // ბადის ძირი მიწაზე
const COLS = 30
const ROWS = 13
const ROOF_ROWS = 6
/** ჰორიზონტალური ძაფის ჩამოკიდება შუაში (მ) */
function sagAt(v: number): number {
  return 0.045 + (1 - v) * 0.075
}

/** უკანა პანელის წერტილი (u ∈ [0,1] განივი, v ∈ [0,1] სიმაღლე) */
function backPoint(u: number, v: number, out: THREE.Vector3): THREE.Vector3 {
  const x = -GOAL_HALF_WIDTH + u * GOAL_HALF_WIDTH * 2
  const hang = 4 * u * (1 - u)
  const y = v * BACK_TOP_Y - sagAt(v) * hang * (1 - v * 0.55)
  // მუცელი — ბადე ოდნავ უკან იბერება შუაში
  const z = THREE.MathUtils.lerp(BACK_BOT_Z, BACK_TOP_Z, v) - hang * 0.1 * (1 - Math.abs(v - 0.45))
  return out.set(x, Math.max(0.01, y), z)
}

/** ჭერის წერტილი (u განივი, w ∈ [0,1] სიღრმე: 0 გვირგვინი → 1 უკანა რელსი) */
function roofPoint(u: number, w: number, out: THREE.Vector3): THREE.Vector3 {
  const x = -GOAL_HALF_WIDTH + u * GOAL_HALF_WIDTH * 2
  const hang = 4 * u * (1 - u)
  const y = THREE.MathUtils.lerp(GOAL_HEIGHT, BACK_TOP_Y, w) - 0.05 * hang * Math.sin(Math.PI * w)
  const z = THREE.MathUtils.lerp(0, BACK_TOP_Z, w)
  return out.set(x, y, z)
}

/** გვერდის წერტილი (a ∈ [0,1] სიღრმე, v ∈ [0,1] სიმაღლე) */
function sidePoint(side: -1 | 1, a: number, v: number, out: THREE.Vector3): THREE.Vector3 {
  const x = side * GOAL_HALF_WIDTH
  const yTop = THREE.MathUtils.lerp(GOAL_HEIGHT, BACK_TOP_Y, a)
  const y = v * yTop
  const z = THREE.MathUtils.lerp(0, THREE.MathUtils.lerp(BACK_BOT_Z, BACK_TOP_Z, v), a)
  return out.set(x, y, z)
}

function buildLines(builder: (push: (a: THREE.Vector3, b: THREE.Vector3) => void) => void) {
  const pts: number[] = []
  const push = (a: THREE.Vector3, b: THREE.Vector3) => {
    pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  builder(push)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
  return g
}

/** უკანა პანელი — ერთადერთი მოძრავი ნაწილი; ტალღა შესვლის წერტილიდან ვრცელდება */
function BackNet({ impact, reducedMotion }: { impact: NetImpact | null; reducedMotion?: boolean }) {
  const ref = useRef<THREE.LineSegments>(null)
  const disturbed = useRef(false)

  const { geometry, rest } = useMemo(() => {
    const v3a = new THREE.Vector3()
    const v3b = new THREE.Vector3()
    const g = buildLines((push) => {
      for (let c = 0; c <= COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          push(backPoint(c / COLS, r / ROWS, v3a), backPoint(c / COLS, (r + 1) / ROWS, v3b))
        }
      }
      for (let r = 0; r <= ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          push(backPoint(c / COLS, r / ROWS, v3a), backPoint((c + 1) / COLS, r / ROWS, v3b))
        }
      }
    })
    const arr = g.getAttribute('position').array as Float32Array
    return { geometry: g, rest: Float32Array.from(arr) }
  }, [])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array

    if (reducedMotion || !impact) {
      if (disturbed.current) {
        arr.set(rest)
        attr.needsUpdate = true
        disturbed.current = false
      }
      return
    }
    disturbed.current = true

    const elapsed = clock.elapsedTime - impact.at
    const ix = impact.x * GOAL_HALF_WIDTH
    const iy = Math.min(impact.y * GOAL_HEIGHT, BACK_TOP_Y)
    for (let i = 0; i < arr.length; i += 3) {
      const x = rest[i] ?? 0
      const y = rest[i + 1] ?? 0
      // კიდეები მიბმულია რელსზე/მიწაზე — შუა თავისუფალია
      const hold =
        Math.min(1, (GOAL_HALF_WIDTH - Math.abs(x)) / 1.1) *
        Math.min(1, y / 0.25) *
        Math.min(1, (BACK_TOP_Y - y) / 0.35 + 0.55)
      arr[i + 2] =
        (rest[i + 2] ?? 0) -
        netRipple(x - ix, y - iy, elapsed, impact.strength) * Math.max(0, hold)
    }
    attr.needsUpdate = true
  })

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color={PALETTE.chalk} transparent opacity={0.26} />
    </lineSegments>
  )
}

/** სტატიკური ნაწილები: ჭერი და გვერდები */
function NetShell() {
  const geometry = useMemo(() => {
    const v3a = new THREE.Vector3()
    const v3b = new THREE.Vector3()
    return buildLines((push) => {
      // ჭერი
      for (let c = 0; c <= COLS; c += 1) {
        for (let w = 0; w < ROOF_ROWS; w++) {
          push(
            roofPoint(c / COLS, w / ROOF_ROWS, v3a),
            roofPoint(c / COLS, (w + 1) / ROOF_ROWS, v3b),
          )
        }
      }
      for (let w = 0; w <= ROOF_ROWS; w++) {
        for (let c = 0; c < COLS; c++) {
          push(roofPoint(c / COLS, w / ROOF_ROWS, v3a), roofPoint((c + 1) / COLS, w / ROOF_ROWS, v3b))
        }
      }
      // გვერდები
      for (const side of [-1, 1] as const) {
        const A = 8
        const V = ROWS
        for (let a = 0; a <= A; a++) {
          for (let v = 0; v < V; v++) {
            push(sidePoint(side, a / A, v / V, v3a), sidePoint(side, a / A, (v + 1) / V, v3b))
          }
        }
        for (let v = 0; v <= V; v++) {
          for (let a = 0; a < A; a++) {
            push(sidePoint(side, a / A, v / V, v3a), sidePoint(side, (a + 1) / A, v / V, v3b))
          }
        }
      }
    })
  }, [])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={PALETTE.chalk} transparent opacity={0.13} />
    </lineSegments>
  )
}

/** უკანა რელსის და მიწის ჩარჩო — ბადეს რაღაცაზე უნდა ეკიდოს */
function NetFrame() {
  return (
    <group>
      {([-1, 1] as const).map((s) => (
        <mesh
          key={s}
          position={[
            s * GOAL_HALF_WIDTH,
            BACK_TOP_Y / 2 + 0.01,
            (BACK_TOP_Z + BACK_BOT_Z) / 2 + 0.12,
          ]}
          rotation={[Math.atan2(BACK_TOP_Z - BACK_BOT_Z, BACK_TOP_Y), 0, 0]}
        >
          <cylinderGeometry args={[0.025, 0.025, BACK_TOP_Y * 1.25, 8]} />
          <meshStandardMaterial color="#aab4ac" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, BACK_TOP_Y, BACK_TOP_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, GOAL_HALF_WIDTH * 2, 8]} />
        <meshStandardMaterial color="#aab4ac" roughness={0.6} />
      </mesh>
    </group>
  )
}

const FLASH_TIME = 0.75

/** ბოძები და გვირგვინი — მრგვალი პროფილი, სუფთა თეთრი საღებავი */
function Frame({ flash, reducedMotion }: { flash: PostFlash | null; reducedMotion?: boolean }) {
  const left = useRef<THREE.MeshStandardMaterial>(null)
  const right = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    for (const [side, ref] of [
      [-1, left],
      [1, right],
    ] as const) {
      const mat = ref.current
      if (!mat) continue
      if (!flash || flash.side !== side) {
        mat.emissiveIntensity = 0
        continue
      }
      const u = (clock.elapsedTime - flash.at) / FLASH_TIME
      mat.emissiveIntensity = reducedMotion ? 1.2 : 0.55 + Math.max(0, 1 - u) * 2.1
    }
  })

  const paint = { color: PALETTE.chalk, roughness: 0.32, metalness: 0.06 }

  return (
    <>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_HEIGHT + POST_RADIUS, 20]} />
          <meshStandardMaterial
            ref={s === -1 ? left : right}
            {...paint}
            emissive={PALETTE.card}
            emissiveIntensity={0}
          />
        </mesh>
      ))}
      <mesh position={[0, GOAL_HEIGHT, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry
          args={[POST_RADIUS, POST_RADIUS, GOAL_HALF_WIDTH * 2 + POST_RADIUS * 2, 20]}
        />
        <meshStandardMaterial {...paint} />
      </mesh>
    </>
  )
}

export function Goal({ impact, postFlash, reducedMotion }: GoalProps) {
  return (
    <group>
      <Frame flash={postFlash} reducedMotion={reducedMotion} />
      <NetFrame />
      <BackNet impact={impact} reducedMotion={reducedMotion} />
      <NetShell />
    </group>
  )
}
