export const PROPS = Object.freeze(['curtain', 'lamp', 'drawer']);

export function initialScene() {
  return { frame: 1, curtain: false, lamp: false, drawer: false };
}

// One action equals one cut. The other props keep their state across cuts.
export function nextScene(scene, prop) {
  if (!PROPS.includes(prop)) return scene;
  return { ...scene, frame: scene.frame + 1, [prop]: !scene[prop] };
}
