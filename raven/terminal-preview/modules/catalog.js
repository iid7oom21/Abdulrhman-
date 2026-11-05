// Approved RAVEN media. Posters are frames from these exact films, not new artwork.
// Duration is in seconds; durationLabel preserves the site's minute:second labels.
const asset = (name) => new URL(`../assets/${name}`, import.meta.url).href;

export const HERO = Object.freeze({
  poster: asset('hero-poster.jpg'),
  video: asset('hero-loop.mp4'),
  src: asset('hero-loop.mp4'),
  width: 896,
  height: 504,
  duration: 7,
});

export const EPISODES = Object.freeze([
  Object.freeze({
    id: 1,
    // Keep progress tied to the original film, independently of display order.
    progressId: 2,
    labelAr: 'الجزء الأول',
    labelEn: 'Part One',
    src: 'https://res.cloudinary.com/du88n6b83/video/upload/v1789985735/raven17/episode-2.mp4',
    poster: asset('episode-2.jpg'),
    duration: 115.766667,
    durationLabel: '1:55',
    width: 384,
    height: 848,
  }),
  Object.freeze({
    id: 2,
    progressId: 3,
    labelAr: 'الجزء الثاني',
    labelEn: 'Part Two',
    src: 'https://res.cloudinary.com/du88n6b83/video/upload/v1789986504/raven17/episode-3.mp4',
    poster: asset('episode-3.jpg'),
    duration: 238.1,
    durationLabel: '3:58',
    width: 464,
    height: 848,
  }),
]);

export const ZARQA = Object.freeze({
  labelAr: 'زرقاء اليمامة',
  labelEn: 'Zarqa Al-Yamama',
  src: 'https://res.cloudinary.com/du88n6b83/video/upload/v1790012325/raven17/raven-zarqa-teaser-01.mp4',
  poster: asset('zarqa-poster.jpg'),
  duration: 16,
  durationLabel: '0:16',
  width: 512,
  height: 910,
});
