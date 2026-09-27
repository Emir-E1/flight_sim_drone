// Registre global très simple : OsmBuildings y enregistre les boîtes englobantes des
// bâtiments dès qu'ils sont chargés, Drone.jsx les lit pour détecter les collisions.
// Pas besoin de Context React ici : un module partagé suffit et évite les re-renders inutiles.

let buildings = [];

export function registerBuildings(list) {
  buildings = list;
}

export function getBuildings() {
  return buildings;
}
