import i18n from '@core/i18n'
import de from './locales/de.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
for (const [language, words] of Object.entries({ de, en, fr }))
  i18n.addResourceBundle(language, 'plannerIntegration', words, true, true)
export default i18n

import editingDe from './locales/editing.de.json'
import editingEn from './locales/editing.en.json'
import editingFr from './locales/editing.fr.json'
for (const [lang, words] of Object.entries({ de: editingDe, en: editingEn, fr: editingFr }))
  i18n.addResourceBundle(lang, 'plannerEditing', words, true, true)

import roomDe from './locales/room.de.json'
import roomEn from './locales/room.en.json'
import roomFr from './locales/room.fr.json'
for (const [lang, words] of Object.entries({ de: roomDe, en: roomEn, fr: roomFr }))
  i18n.addResourceBundle(lang, 'plannerRoom', words, true, true)

import actionsDe from './locales/actions.de.json'
import actionsEn from './locales/actions.en.json'
import actionsFr from './locales/actions.fr.json'
for (const [lang,words] of Object.entries({de:actionsDe,en:actionsEn,fr:actionsFr})) i18n.addResourceBundle(lang,'plannerActions',words,true,true)

import threeDe from './locales/three.de.json'
import threeEn from './locales/three.en.json'
import threeFr from './locales/three.fr.json'
for(const [lang,words] of Object.entries({de:threeDe,en:threeEn,fr:threeFr}))i18n.addResourceBundle(lang,'planner3D',words,true,true)
