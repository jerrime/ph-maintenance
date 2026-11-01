import { useEffect, useState } from 'react'
import { ArrowRight, Mail, Phone } from 'lucide-react'
import { mailHref, telHref } from '../lib/contact'
import SceneBackground from '../components/SceneBackground'


/**
 * Shown in place of the public site while `system_maintenance` is on. Staff bypass this
 * entirely (see App.jsx), and /admin and /login stay reachable so an admin can sign in
 * and turn it back off even if they land here with no active session.
 */
export default function Maintenance() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <SceneBackground sound>
        <section className={`mnt-card ${ready ? 'in' : ''}`}>
          <span className="mnt-badge mnt-reveal" style={{ '--i': 1, marginTop: 18 }}><i />We've moved</span>
          <h1 className="mnt-title mnt-reveal" style={{ '--i': 2 }}>We have a new website address</h1>

          <div className="mnt-move mnt-reveal" style={{ '--i': 3 }}>
            <div className="mnt-old"><small>Old address</small><b>it-solutions.jmglori.com</b></div>
            <ArrowRight size={22} strokeWidth={2.25} className="mnt-move-arrow" aria-hidden="true" />
            <div className="mnt-new"><small>New address</small><b>jmglori.com</b></div>
          </div>

          <ol className="mnt-steps mnt-reveal" style={{ '--i': 4 }}>
            <li><i className="s1">1</i><span><b>Everything moved.</b>Packages, services and contact are all on jmglori.com now.</span></li>
            <li><i className="s2">2</i><span><b>Update your bookmarks.</b>Use jmglori.com from now on.</span></li>
          </ol>

          <p className="mnt-help mnt-reveal" style={{ '--i': 5 }}>Need help? Contact us:</p>

          <div className="mnt-contacts mnt-reveal" style={{ '--i': 4 }}>
            <a href={mailHref('jerrimemglori@gmail.com')}><Mail strokeWidth={1.75} /> jerrimemglori@gmail.com</a>
            <a href={telHref('09164558813')}><Phone strokeWidth={1.75} /> 09164558813</a>
          </div>

          <a href="https://jmglori.com" className="mnt-btn mnt-reveal" style={{ '--i': 5 }}>
            <ArrowRight size={18} strokeWidth={2} /> Go to jmglori.com
          </a>

        </section>
    </SceneBackground>
  )
}
