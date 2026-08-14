import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { netRipple } from '../lib/flight'
import { GOAL_DEPTH, GOAL_HALF_WIDTH, GOAL_HEIGHT, POST_RADIUS } from '../lib/geometry'

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
  /** ბოლო შეხება ბადეზე — null თუ ტალღა არ გვინდა */
  impact: NetImpact | null
  /** ბოძში მოხვედრა — §5-ის „ტკბილი მომენტი", აღებისგან განსხვავებული */
  postFlash: PostFlash | null
  /** prefers-reduced-motion — ტალღა ითიშება, ლოგიკა უცვლელი რჩება */
  reducedMotion?: boolean
}

const COLS = 22
const ROWS = 9
/** ბოძის ციმციმის ხანგრძლივობა (წმ) */
const FLASH_TIME = 0.75

/** ბოძები და ჰორიზონტალი — ბოძი დარტყმაზე ანთდება */
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
      // ციმციმის შემდეგ ბოძი ჩამქრალი რჩება, სანამ შედეგი ეკრანზეა.
      // reduced-motion: ერთი სტატიკური ნიშანი, ციმციმის გარეშე.
      mat.emissiveIntensity = reducedMotion ? 1.2 : 0.55 + Math.max(0, 1 - u) * 2.1
    }
  })

  return (
    <>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_HEIGHT, 14]} />
          <meshStandardMaterial
            ref={s === -1 ? left : right}
            color={PALETTE.chalk}
            roughness={0.45}
            metalness={0.05}
            emissive={PALETTE.card}
            emissiveIntensity={0}
          />
        </mesh>
      ))}

      <mesh position={[0, GOAL_HEIGHT, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_HALF_WIDTH * 2, 14]} />
        <meshStandardMaterial color={PALETTE.chalk} roughness={0.45} metalness={0.05} />
      </mesh>
    </>
  )
}

/** ბადის უკანა პანელი — ერთადერთი, რომელიც ირხევა */
function BackNet({ impact, reducedMotion }: { impact: NetImpact | null; reducedMotion?: boolean }) {
  const ref = useRef<THREE.LineSegments>(null)
  const disturbed = useRef(false)

  const { geometry, rest } = useMemo(() => {
    const points: number[] = []
    const w = GOAL_HALF_WIDTH * 2
    for (let c = 0; c <= COLS; c++) {
      const x = -GOAL_HALF_WIDTH + (w * c) / COLS
      points.push(x, 0, 0, x, GOAL_HEIGHT, 0)
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = (GOAL_HEIGHT * r) / ROWS
      points.push(-GOAL_HALF_WIDTH, y, 0, GOAL_HALF_WIDTH, y, 0)
    }
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(points)
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return { geometry: g, rest: Float32Array.from(arr) }
  }, [])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array

    if (reducedMotion || !impact) {
      // მოსვენების მდგომარეობაში დაბრუნება ერთხელ, მერე აღარაფერი
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
    const iy = impact.y * GOAL_HEIGHT
    for (let i = 0; i < arr.length; i += 3) {
      const x = rest[i] ?? 0
      const y = rest[i + 1] ?? 0
      // ბადე კიდეებზე მიბმულია — ტალღა შუაში ყველაზე თავისუფალია
      const hold =
        Math.min(1, (GOAL_HALF_WIDTH - Math.abs(x)) / 0.9) * Math.min(1, (GOAL_HEIGHT - y) / 0.7)
      arr[i + 2] = -netRipple(x - ix, y - iy, elapsed, impact.strength) * Math.max(0, hold)
    }
    attr.needsUpdate = true
  })

  return (
    <lineSegments ref={ref} geometry={geometry} position={[0, 0, -GOAL_DEPTH]}>
      <lineBasicMaterial color={PALETTE.chalk} transparent opacity={0.3} />
    </lineSegments>
  )
}

/** გვერდითი და ზედა პანელები — სტატიკური */
function NetShell() {
  const geometry = useMemo(() => {
    const pts: number[] = []
    const push = (a: THREE.Vector3Like, b: THREE.Vector3Like) => {
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
    for (const sx of [-1, 1] as const) {
      const x = sx * GOAL_HALF_WIDTH
      for (let r = 0; r <= ROWS; r++) {
        const y = (GOAL_HEIGHT * r) / ROWS
        push({ x, y, z: 0 }, { x, y, z: -GOAL_DEPTH })
      }
      for (let c = 0; c <= 6; c++) {
        const z = (-GOAL_DEPTH * c) / 6
        push({ x, y: 0, z }, { x, y: GOAL_HEIGHT, z })
      }
    }
    for (let c = 0; c <= COLS; c++) {
      const x = -GOAL_HALF_WIDTH + (GOAL_HALF_WIDTH * 2 * c) / COLS
      push({ x, y: GOAL_HEIGHT, z: 0 }, { x, y: GOAL_HEIGHT, z: -GOAL_DEPTH })
    }
    for (let c = 0; c <= 6; c++) {
      const z = (-GOAL_DEPTH * c) / 6
      push({ x: -GOAL_HALF_WIDTH, y: GOAL_HEIGHT, z }, { x: GOAL_HALF_WIDTH, y: GOAL_HEIGHT, z })
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
    return g
  }, [])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={PALETTE.chalk} transparent opacity={0.16} />
    </lineSegments>
  )
}

export function Goal({ impact, postFlash, reducedMotion }: GoalProps) {
  return (
    <group>
      <Frame flash={postFlash} reducedMotion={reducedMotion} />
      <BackNet impact={impact} reducedMotion={reducedMotion} />
      <NetShell />
    </group>
  )
}
