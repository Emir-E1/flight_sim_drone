# BRIEF PROJET — Simulateur de Drone 3D pour Génération de Dataset

> **Usage de ce document** : Ce fichier est conçu pour être collé en début de conversation avec n'importe quel assistant IA (Claude, GPT, Gemini, etc.) afin de reprendre ce projet là où il en est, sans perte de contexte. Tenez-le à jour à chaque session importante (section "Journal des décisions" en bas).

---

## 1. Objectif du projet

Créer un **simulateur de vol de drone en 3D**, piloté au clavier (contrôles par gestes main/caméra = fonctionnalité secondaire, non prioritaire), survolant une carte urbaine 3D. L'opérateur peut :

- Piloter le drone en vue caméra embarquée (dont vue plongeante).
- Prendre des photos depuis la caméra du drone.
- Déclencher des **désastres naturels** à la demande (séisme, incendie, inondation...).
- Observer des **bâtiments qui se dégradent aléatoirement** (effondrement partiel, dommages visuels).

**Finalité réelle** : générer un **dataset d'images** (bâtiments endommagés vus du ciel) destiné à alimenter un algorithme d'analyse développé dans le cadre d'une **thèse de doctorat** (vraisemblablement détection/classification de dommages via vision par ordinateur).

## 2. Profil du développeur

- Dev **fullstack MERN** (MongoDB, Express, React, Node).
- **3D artist** (compétence en modélisation/texturing — atout majeur pour ce projet).
- Développeur **solo**.

## 3. Contrainte technique centrale (déjà tranchée — NE PAS revenir dessus sans raison)

Le duo "carte Google Earth 3D photoréaliste" + "bâtiments destructibles individuellement" est **incompatible techniquement**. Les tuiles 3D de Google Earth (Photorealistic 3D Tiles) sont un mesh de photogrammétrie fusionné : impossible d'isoler un bâtiment précis pour le faire s'effondrer ou le remplacer.

**Décision retenue : Option A — Ville procédurale**

- Récupération des empreintes de bâtiments réelles via **OpenStreetMap / Overpass API** (gratuit).
- Extrusion en volumes 3D (low/mid-poly), chaque bâtiment = objet Three.js indépendant.
- Système de dégâts par **swap de mesh** (intact → endommagé → gravats) piloté par une state machine, + shaders de dissolve/fissure en GLSL, + particules (fumée, poussière, feu).
- Coordonnées géographiques réelles conservées si besoin pour l'algo de la thèse (à confirmer — voir section 5).

**Options écartées ou en attente** :

- Option B (hybride Google 3D Tiles + bâtiments procéduraux calés dessus) : trop complexe pour un solo dev en MVP, calage géographique lourd.
- Option C (ville 100% fictive sans vraies coordonnées) : à envisager seulement si l'algo de la thèse n'a pas besoin de géolocalisation réelle.

## 4. Stack technique retenue

| Besoin                                    | Outil                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Moteur 3D                                 | **Three.js** via **`@react-three/fiber`** (décidé — cohérence avec stack React du dev)                         |
| Physique (débris, collisions)             | **Rapier** (plus rapide que Cannon.js)                                                                         |
| Données bâtiments réels                   | **OpenStreetMap / Overpass API**                                                                               |
| Terrain/relief (optionnel, fond de scène) | Mapbox Terrain-RGB ou Google 3D Tiles en arrière-plan non-interactif                                           |
| Dégâts visuels                            | Shaders GLSL (dissolve/fissure) + systèmes de particules                                                       |
| Capture photo                             | `renderer.domElement.toDataURL()` ou rendu offscreen vers texture                                              |
| Backend                                   | Node/Express + MongoDB (stockage sessions, métadonnées photos : timestamp, position simulée, type de désastre) |

## 5. Questions ouvertes — à trancher avant de coder l'urbanisme

1. **L'algo de la thèse a-t-il besoin de vraies coordonnées GPS**, ou juste d'images plausibles de zone urbaine endommagée ? → Détermine si on garde OSM réel ou si on part sur une ville 100% fictive (plus simple).
2. Quel **niveau de réalisme visuel** est attendu par le doctorant pour que ses images soient exploitables (résolution, angle, format EXIF/métadonnées) ?
3. Combien de **types de désastres** sont réellement nécessaires pour le dataset (mieux vaut 1 type solide que 5 approximatifs pour un MVP) ?
4. Y a-t-il une **contrainte de volume** (nombre d'images, fréquence de génération) côté thèse qui impacterait les perfs à prévoir ?

## 6. Estimation de faisabilité (solo dev)

| Bloc                                                                | Estimation                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Vol drone + contrôles clavier + caméra embarquée + capture photo    | 1 à 3 semaines                                             |
| Ville procédurale destructible (génération OSM + système de dégâts) | 2 à 4 mois                                                 |
| Un désastre naturel crédible (shaders + particules)                 | Variable, compter un mini-projet par type                  |
| Intégration Google 3D Tiles réaliste calée finement (Option B)      | Déconseillé pour MVP solo — trop coûteux en temps/perf/API |

## 7. Roadmap proposée (à valider/ajuster)

- [ ] **Sprint 0** : trancher les questions ouvertes (section 5) avec le doctorant/labo.
- [ ] **Sprint 1** : POC vol de drone Three.js (contrôles clavier, caméra embarquée, capture photo basique sur scène de test).
- [ ] **Sprint 2** : génération procédurale de ville à partir d'OSM (zone réelle test), rendu statique.
- [ ] **Sprint 3** : système de dégâts sur bâtiments (state machine intact/endommagé/gravats).
- [ ] **Sprint 4** : premier désastre naturel scripté de bout en bout.
- [ ] **Sprint 5** : pipeline de capture/export du dataset (photo + métadonnées) vers backend.
- [ ] **Sprint 6+** : contrôles gestuels via caméra (fonctionnalité secondaire).

## 8. Tableau de bord technique — État d'avancement

> **Règle pour toute IA qui reprend ce projet** : mettre à jour ce tableau à chaque génération de code (nouveau fichier, fichier modifié, mapping clavier changé, etc.), pour que la session suivante n'ait pas besoin de relire tout l'historique de chat.

### Fichiers du projet

| Fichier                               | Rôle                                                                    | État                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `DroneSimScene.jsx`                   | Composant principal — Canvas R3F, sol de test, caméra en poursuite, HUD | ✅ POC fonctionnel                                                   |
| `Drone.jsx`                           | Groupe drone (géométrie placeholder) + logique de contrôle 6DOF         | ✅ POC fonctionnel — géométrie à remplacer par un vrai modèle `.glb` |
| `useKeyboardControls.js`              | Hook clavier générique (état des touches pressées)                      | ✅ Stable, ne devrait plus bouger                                    |
| Génération de ville procédurale (OSM) | —                                                                       | ❌ Non commencé                                                      |
| Système de dégâts sur bâtiments       | —                                                                       | ❌ Non commencé                                                      |
| Désastres naturels                    | —                                                                       | ❌ Non commencé                                                      |
| Capture photo + export dataset        | —                                                                       | ❌ Non commencé                                                      |
| Chargement modèle drone `.glb` réel   | —                                                                       | ⏳ En attente que l'utilisateur fournisse/choisisse un modèle        |

### Mapping clavier actuel (référence — ne pas réinventer sans le signaler ici)

| Touche(s)        | Action                                                                               | Axe                                                     |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `↑` / `↓`        | Avancer / reculer (toujours à plat, indépendant du tilt visuel)                      | Translation locale Z, basée sur le cap (yaw) uniquement |
| `←` / `→`        | Strafe gauche / droite (idem, toujours à plat)                                       | Translation locale X, basée sur le cap (yaw) uniquement |
| `Espace` / `Maj` | Monter / descendre                                                                   | Translation absolue Y                                   |
| `Q` / `D`        | Cap réel — rotation persistante (détermine la direction de vol)                      | Rotation Y du groupe extérieur                          |
| `Z` / `S`        | Inclinaison visuelle avant/arrière (purement cosmétique, revient à 0 au relâchement) | Rotation X du groupe intérieur (tiltGroup)              |
| `A` / `E`        | Inclinaison visuelle latérale (purement cosmétique, idem)                            | Rotation Z du groupe intérieur (tiltGroup)              |

**Architecture importante (ne pas régresser dessus)** : le drone est composé de **deux groupes imbriqués**. Le groupe extérieur ne porte que la position et le cap (yaw) — c'est lui qui sert de référence pour la translation et pour la caméra. Le groupe intérieur (`tiltGroup`, exposé via `drone.userData.tiltGroup`) ne porte que l'inclinaison visuelle (pitch/roll), qui s'anime en douceur (lerp) mais n'affecte jamais la trajectoire. Cette séparation corrige un bug initial où incliner le nez faisait dériver l'altitude en avançant (la translation suivait l'axe incliné au lieu de rester horizontale).

Pivot de rotation = centre géométrique du `<group>` drone (le body n'a pas d'offset de position).

## 9. Journal des décisions

| Date       | Décision                                                                                                 | Raison                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 2026-09-26 | Choix Option A (ville procédurale OSM) plutôt que Google 3D Tiles destructibles                          | Incompatibilité technique des tuiles photogrammétriques avec la destruction sélective                   |
| 2026-09-26 | Passage de Three.js vanilla à **React + `@react-three/fiber`**                                           | Cohérence avec la stack MERN/React du dev                                                               |
| 2026-09-26 | Mapping clavier : flèches = translation, ZQSD = rotation (au lieu de l'inverse initialement prototypé)   | Choix ergonomique du dev                                                                                |
| 2026-09-26 | Séparation cap (yaw, groupe extérieur) / inclinaison visuelle (pitch+roll, groupe intérieur `tiltGroup`) | Bug : la translation suivait l'axe du nez incliné, causant une dérive d'altitude non voulue en avançant |
| 2026-09-26 | Éclairage renforcé (ambient 0.9 + hemisphere light + directional 1.3) et sol/grille éclaircis            | Scène jugée trop sombre par le dev, mauvaise lisibilité du déplacement                                  |

---

**Instruction pour l'IA qui reprend ce projet** : lire ce brief en entier avant de proposer du code ou de l'architecture. Si une section contredit une demande de l'utilisateur, signaler la contradiction plutôt que de trancher silencieusement.
