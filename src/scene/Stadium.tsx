import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { mulberry32 } from '../lib/physics'
import { coneAlpha, dotSprite, fogBand, skyGradient, type Quality } from './textures'

/**
 * სტადიონის გარემო — ტრიბუნების სილუეტი, პროჟექტორის ანძები, ღამის ცა.
 * §8: „ცარიელი წუთი" — სტადიონი თითქმის ცარიელია, მაგრამ ადგილი უნდა
 * იგრძნობოდეს. ყველაფერი პროცედურულია, seed-ით.
 */

export interface StadiumProps {
  quality: Quality
  /** გოლის მომენტში პროჟექტორები ერთხელ „ამოისუნთქებენ" — საათის დრო */
  flareAt: number | null
  reducedMotion: boolean
}

// ─── ცა ─────────────────────────────────────────────────────

function Sky() {
  return (
    <mesh scale={[1, 1, 1]}>
      <sphereGeometry args={[140, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
      <meshBasicMaterial map={skyGradient()} side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

function Stars({ quality }: { quality: Quality }) {
  const geometry = useMemo(() => {
    const rng = mulberry32(0x57a125)
    const count = quality === 'high' ? 260 : 130
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // მხოლოდ ზედა გუმბათზე, ჰორიზონტს არ ეკარება
      const az = rng() * Math.PI * 2
      const alt = 0.22 + rng() * 0.9
      const r = 130
      pos[i * 3] = Math.cos(az) * Math.cos(alt) * r
      pos[i * 3 + 1] = Math.sin(alt) * r
      pos[i * 3 + 2] = Math.sin(az) * Math.cos(alt) * r
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [quality])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        map={dotSprite()}
        color="#cfd8dc"
        size={0.9}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        fog={false}
      />
    </points>
  )
}

// ─── ტრიბუნები ──────────────────────────────────────────────

const TIERS = 4
const TIER_H = 2.1
const TIER_D = 3.2

interface StandSpec {
  /** ცენტრის პოზიცია და სიგრძე */
  x: number
  z: number
  length: number
  rotY: number
}

const STANDS: StandSpec[] = [
  { x: 0, z: -27, length: 96, rotY: 0 }, // კარის უკან
  { x: -45, z: -2, length: 56, rotY: Math.PI / 2 }, // მარცხენა
  { x: 45, z: -2, length: 56, rotY: -Math.PI / 2 }, // მარჯვენა
  { x: 0, z: 52, length: 96, rotY: Math.PI }, // დამრტყმელის უკან
]

function Stand({ spec }: { spec: StandSpec }) {
  return (
    <group position={[spec.x, 0, spec.z]} rotation={[0, spec.rotY, 0]}>
      {Array.from({ length: TIERS }, (_, i) => (
        <mesh
          key={i}
          position={[0, TIER_H * (i + 0.5) + 1.2, -TIER_D * i]}
          receiveShadow={false}
        >
          <boxGeometry args={[spec.length, TIER_H, TIER_D]} />
          <meshStandardMaterial color="#071009" roughness={1} metalness={0} emissive="#0c1c20" emissiveIntensity={0.09} />
        </mesh>
      ))}
      {/* სახურავის თხელი ზოლი — სილუეტს ხაზს უსვამს */}
      <mesh position={[0, TIER_H * TIERS + 1.5, -TIER_D * (TIERS - 1)]}>
        <boxGeometry args={[spec.length, 0.25, 1.4]} />
        <meshStandardMaterial color="#0a1512" roughness={0.7} />
      </mesh>
    </group>
  )
}

/** მეჩხერი ბრბო — ჩამქრალი წერტილები ტრიბუნებზე. ცარიელი და დაძაბული. */
function Crowd({ quality }: { quality: Quality }) {
  const geometry = useMemo(() => {
    const rng = mulberry32(0xc4a7d1)
    const pos: number[] = []
    const col: number[] = []
    const warm = new THREE.Color(PALETTE.sodium).multiplyScalar(0.5)
    const cool = new THREE.Color(PALETTE.floodlight).multiplyScalar(0.45)
    const density = quality === 'high' ? 0.16 : 0.1

    for (const s of STANDS) {
      if (s.rotY === Math.PI) continue // კამერის უკან — არ ჩანს
      const seats = Math.floor(s.length / 0.85)
      for (let tier = 0; tier < TIERS; tier++) {
        for (let i = 0; i < seats; i++) {
          if (rng() > density) continue
          const along = (i / seats - 0.5) * s.length + (rng() - 0.5) * 0.5
          const lx = along
          const ly = TIER_H * (tier + 1) + 1.2 + 0.35
          const lz = -TIER_D * tier + TIER_D * 0.18
          // ლოკალური → მსოფლიო
          const cos = Math.cos(s.rotY)
          const sin = Math.sin(s.rotY)
          pos.push(s.x + lx * cos + lz * sin, ly, s.z - lx * sin + lz * cos)
          const c = rng() < 0.5 ? warm : cool
          const dim = 0.35 + rng() * 0.6
          col.push(c.r * dim, c.g * dim, c.b * dim)
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3))
    return g
  }, [quality])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        map={dotSprite()}
        vertexColors
        size={0.42}
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

// ─── პროჟექტორის ანძები ─────────────────────────────────────

const TOWERS: { x: number; z: number }[] = [
  { x: -13.5, z: -20 },
  { x: 13.5, z: -20 },
]
const TOWER_H = 11.5

function FloodlightTower({
  x,
  z,
  flareAt,
  reducedMotion,
}: {
  x: number
  z: number
  flareAt: number | null
  reducedMotion: boolean
}) {
  const cone = useRef<THREE.Mesh>(null)
  const lamps = useRef<THREE.MeshBasicMaterial>(null)

  // კონუსი ლამპიდან მოედნისკენ იხრება
  const tilt = useMemo(() => {
    const head = new THREE.Vector3(x, TOWER_H, z)
    const target = new THREE.Vector3(0, 0, 2)
    const dir = target.sub(head).normalize()
    return { yaw: Math.atan2(dir.x, dir.z), pitch: Math.acos(-dir.y) }
  }, [x, z])

  useFrame(({ clock }) => {
    // გოლზე ერთი რბილი პულსი; reduced-motion-ზე სტატიკური
    let boost = 0
    if (flareAt !== null && !reducedMotion) {
      const u = (clock.elapsedTime - flareAt) / 0.9
      if (u >= 0 && u <= 1) boost = Math.sin(Math.PI * u) * 0.6
    }
    if (cone.current) {
      const m = cone.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.15 + boost * 0.3
    }
    if (lamps.current) lamps.current.color.setScalar(1 + boost * 1.6)
  })

  const coneLen = 13

  return (
    <group position={[x, 0, z]}>
      {/* ანძა */}
      <mesh position={[0, TOWER_H / 2, 0]}>
        <cylinderGeometry args={[0.14, 0.3, TOWER_H, 8]} />
        <meshStandardMaterial color="#0b1310" roughness={0.9} />
      </mesh>
      {/* ლამპების პანელი */}
      <group position={[0, TOWER_H, 0]} rotation={[0, tilt.yaw, 0]}>
        <mesh rotation={[tilt.pitch - Math.PI / 2, 0, 0]}>
          <boxGeometry args={[3.4, 2.2, 0.3]} />
          <meshStandardMaterial color="#0c1512" roughness={0.8} />
        </mesh>
        {/* ლამპები — bloom-ისთვის ღია */}
        <mesh rotation={[tilt.pitch - Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[3.1, 1.9]} />
          <meshBasicMaterial
            ref={lamps}
            color="#ffe3ae"
            toneMapped={false}
            fog={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {/* ყალბი ვოლუმეტრიკა — დანამატი გამჭვირვალე კონუსი */}
      <group position={[0, TOWER_H, 0]} rotation={[0, tilt.yaw, 0]}>
        <group rotation={[tilt.pitch, 0, 0]}>
          <mesh ref={cone} position={[0, -coneLen / 2, 0]} renderOrder={4}>
            <coneGeometry args={[3.6, coneLen, 20, 1, true]} />
            <meshBasicMaterial
              map={coneAlpha()}
              color={PALETTE.sodium}
              transparent
              opacity={0.16}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
              fog={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// ─── ნისლი კარის უკან ───────────────────────────────────────

function GroundFog() {
  return (
    <mesh position={[0, 1.4, -12.5]} renderOrder={3}>
      <planeGeometry args={[46, 3.4]} />
      <meshBasicMaterial
        map={fogBand()}
        color="#4c6a60"
        transparent
        opacity={0.22}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}

export function Stadium({ quality, flareAt, reducedMotion }: StadiumProps) {
  return (
    <group>
      <Sky />
      <Stars quality={quality} />
      {STANDS.map((s, i) => (
        <Stand key={i} spec={s} />
      ))}
      <Crowd quality={quality} />
      {TOWERS.map((t, i) => (
        <FloodlightTower key={i} {...t} flareAt={flareAt} reducedMotion={reducedMotion} />
      ))}
      <GroundFog />
    </group>
  )
}
