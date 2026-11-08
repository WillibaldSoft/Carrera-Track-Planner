import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './i18n'
import StandalonePlanner from './StandalonePlanner'
import {PlannerUpdateProvider} from './updates/UpdateContext'
import EmbeddedPlanner from './EmbeddedPlanner'
createRoot(document.getElementById('root')).render(
  <PlannerUpdateProvider>{window.parent === window ? <StandalonePlanner /> : <EmbeddedPlanner />}</PlannerUpdateProvider>
)
