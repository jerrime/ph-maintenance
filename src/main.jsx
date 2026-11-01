import { createRoot } from 'react-dom/client'
import './index.css'
import Maintenance from './pages/Maintenance'

// Same rule as the main site: light 06:00-17:59, dark otherwise.
const h = new Date().getHours()
document.documentElement.classList.toggle('dark', !(h >= 6 && h < 18))
document.title = "We've moved to jmglori.com | JMGlori IT Solutions"
createRoot(document.getElementById('root')).render(<Maintenance />)
