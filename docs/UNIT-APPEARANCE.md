# CU, Start/Finish and fuel-rail artwork · Lokaler Entwurf

## Deutsch

Die CU hat ein abgestuftes, dunkelgraues Gehäuse mit Kanten, Anschlussbuchsen, fünf runden Kontrollleuchten und einer eingelassenen Tastenleiste. Start/Ziel liegt auf der zugehörigen Schiene vor dem Gehäuse: Schachbrettfelder an den Außenrändern, ein weißes Schriftfeld zwischen den beiden Spuren und kleine Sensorfenster neben den Slots. Die Tankschienen zeigen die seitlich aufgedruckten, zum Infrarotsensor zulaufenden Streifen, Eckmarkierungen und FUEL-Schrift. Beschriftungen bleiben auch bei gedrehten Teilen lesbar. Die übrige Fahrbahnoberfläche, Slots, Schienengeometrie und gespeicherten Positionen sind unverändert.

## English

The CU has a bevelled dark housing, connector sockets, five round indicators and a recessed button panel. Start/finish markings sit on its rail in front of the housing: outer checker patches, a white label between the lanes and small sensor windows beside the slots. Fuel rails use printed striped wedges converging on the infrared sensor, corner marks and FUEL lettering. Labels remain readable when parts rotate. Existing road surfaces, slots, geometry and saved positions are retained.

## Français

La CU reçoit un boîtier sombre à relief, des connecteurs, cinq voyants ronds et un panneau de touches encastré. Le départ/arrivée est placé sur son rail devant le boîtier : damiers sur les bords extérieurs, cartouche blanc entre les voies et petits capteurs à côté des rainures. Les rails de ravitaillement présentent des bandes convergeant vers le capteur infrarouge, des repères d’angle et le marquage FUEL. Les textes restent lisibles après rotation. Le revêtement, les rainures, la géométrie et les positions enregistrées sont conservés.

## References and implementation

Visual references: official [Control Unit 30352](https://carrera-toys.com/products/20030352-control-unit) and [Pit Stop Adapter Unit 30361](https://carrera-toys.com/products/20030361-pit-stop-adapter-unit) product images, checked 7 November 2026. These are planner-owned SVG illustrations; no manufacturer bitmap or logo is embedded. Proportions are illustrative within the existing nominal planning footprint, not factory dimensional drawings. LEDs and buttons do not claim a hardware status.

The existing attributed `TrackUnitDetails.jsx` is deliberately refined. `TrackPlanPreview.jsx` passes the world heading into the legacy fuel drawing so nested transforms retain readable text. PROVENANCE preserves original source hashes and records current export hashes and reasons. No room, track connection or placement geometry changes are introduced by the artwork.

## DE

### CU und Start/Ziel

![CU und Start/Ziel](screenshots/unit-appearance/de/01-cu-start-finish.png)

### Zwei Tankschienen

![Zwei Tankschienen](screenshots/unit-appearance/de/02-two-fuel-rails.png)

### CU mit Boxengasse

![CU mit Boxengasse](screenshots/unit-appearance/de/03-cu-and-pit-overview.png)

## EN

### CU and start/finish

![CU and start/finish](screenshots/unit-appearance/en/01-cu-start-finish.png)

### Two fuel rails

![Two fuel rails](screenshots/unit-appearance/en/02-two-fuel-rails.png)

### CU and pit overview

![CU and pit overview](screenshots/unit-appearance/en/03-cu-and-pit-overview.png)

## FR

### CU et départ/arrivée

![CU et départ/arrivée](screenshots/unit-appearance/fr/01-cu-start-finish.png)

### Deux rails de ravitaillement

![Deux rails de ravitaillement](screenshots/unit-appearance/fr/02-two-fuel-rails.png)

### CU et stands

![CU et stands](screenshots/unit-appearance/fr/03-cu-and-pit-overview.png)
