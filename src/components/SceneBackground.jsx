import { useEffect, useRef, useState } from 'react'
import { sfx, sfxInit, sfxSet, sfxStop, startScene } from '../lib/maintenanceScene'
import '../pages/maintenance.css'

const isNight = () => {
  const h = new Date().getHours()
  return h < 6 || h >= 18
}

/**
 * The animated day/night scene used behind the maintenance page and the sign-in page, with `children`
 * centred on top of it. Day (6:00 to 17:59 on the visitor's clock) shows the sun scene in light colours;
 * night shows the moon scene in dark colours, re-checked every minute. `sound` adds the ambient audio,
 * which only starts after the visitor's first click, tap or key press. `forceNight` keeps it night
 * whatever the time is.
 */
export default function SceneBackground({ children, sound = false, forceNight = false }) {
  const [clockNight, setNight] = useState(isNight)
  useEffect(() => {
    const id = setInterval(() => setNight(isNight()), 60000)
    return () => clearInterval(id)
  }, [])
  const night = forceNight || clockNight
  const season = night ? 'rainy' : 'sunny'

  const canvasRef = useRef(null)
  const state = useRef({ season, dark: night })
  state.current = { season, dark: night }

  useEffect(() => {
    const stop = startScene(canvasRef.current, () => state.current)
    return stop
  }, [])

  useEffect(() => {
    if (!sound || !sfxInit()) return
    sfxSet(true, state.current.season)
    const events = ['pointerdown', 'keydown', 'touchend', 'click']
    const unlock = () => {
      sfx.ctx?.resume()
      events.forEach((e) => window.removeEventListener(e, unlock))
    }
    events.forEach((e) => window.addEventListener(e, unlock))
    sfx.ctx.resume().catch(() => {})
    return () => {
      events.forEach((e) => window.removeEventListener(e, unlock))
      sfxStop()
    }
  }, [sound])
  useEffect(() => { if (sound) sfxSet(true, season) }, [season, sound])

  return (
    <div className={`mnt ${night ? 'night' : 'day'}`}>
      <canvas ref={canvasRef} className="mnt-canvas" aria-hidden="true" />
      <main className="mnt-stage">{children}</main>
    </div>
  )
}
