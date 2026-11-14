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
for (const [lang, words] of Object.entries({ de: actionsDe, en: actionsEn, fr: actionsFr }))
  i18n.addResourceBundle(lang, 'plannerActions', words, true, true)

import threeDe from './locales/three.de.json'
import threeEn from './locales/three.en.json'
import threeFr from './locales/three.fr.json'
for (const [lang, words] of Object.entries({ de: threeDe, en: threeEn, fr: threeFr }))
  i18n.addResourceBundle(lang, 'planner3D', words, true, true)

import updatesDe from './locales/updates.de.json'
import updatesEn from './locales/updates.en.json'
import updatesFr from './locales/updates.fr.json'
for (const [lang, words] of Object.entries({ de: updatesDe, en: updatesEn, fr: updatesFr }))
  i18n.addResourceBundle(lang, 'plannerUpdates', words, true, true)

import interfaceDe from './locales/interface.de.json'
import interfaceEn from './locales/interface.en.json'
import interfaceFr from './locales/interface.fr.json'
for (const [lang, words] of Object.entries({ de: interfaceDe, en: interfaceEn, fr: interfaceFr }))
  i18n.addResourceBundle(lang, 'plannerInterface', words, true, true)

for (const [lang, label] of Object.entries({
  de: 'Spurwechsel 20517 (Einzelteil; 2 je Packung)',
  en: 'Lane change 20517 (individual rail; 2 per pack)',
  fr: 'Changement de voie 20517 (rail individuel ; 2 par boîte)',
}))
  i18n.addResourceBundle(lang, 'tracks', { inventory: { parts: { fixedCross: label } }, pitParts:{fixedCross:label} }, true, true)
