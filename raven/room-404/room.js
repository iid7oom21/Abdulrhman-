import { initialScene, nextScene } from './scene.mjs';

const sceneView = document.querySelector('#scene');
const frame = document.querySelector('#frame');
const status = document.querySelector('#scene-status');
const controls = [...sceneView.querySelectorAll('[data-prop]')];
const reset = document.querySelector('#reset-scene');
const initialNote = status.textContent;
const notes = {
  curtain: ['أُغلقت الستارة، واختفى ضوء اللافتة.', 'انكشفت النافذة. لافتة الفندق ما زالت مضاءة في الخارج.'],
  lamp: ['انطفأ المصباح. عاد الجدار إلى العتمة.', 'أضاء المصباح الجدار. ظهرت عليه كتابة باهتة: 04:04.'],
  drawer: ['أُغلق الدرج، واختفى مفتاح الغرفة.', 'انفتح الدرج. في داخله مفتاح يحمل الرقم 404.'],
};
let scene = initialScene();

function render() {
  frame.textContent = String(scene.frame).padStart(2, '0');
  reset.disabled = scene.frame === 1;
  for (const button of controls) {
    const prop = button.dataset.prop;
    sceneView.dataset[prop] = scene[prop] ? 'on' : 'off';
    button.setAttribute('aria-pressed', String(scene[prop]));
    button.disabled = false;
  }
}

for (const button of controls) {
  button.addEventListener('click', () => {
    const prop = button.dataset.prop;
    scene = nextScene(scene, prop);
    render();
    status.textContent = `اللقطة ${frame.textContent}: ${notes[prop][Number(scene[prop])]}`;
  });
}

reset.addEventListener('click', () => {
  scene = initialScene();
  render();
  status.textContent = `اللقطة ${frame.textContent}: ${initialNote}`;
  controls[0].focus();
});

render();
