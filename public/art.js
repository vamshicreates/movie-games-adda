export const icon = (name, size = 20) => {
  const paths = {
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H5m6 6-6-6 6-6"/>',
    play: '<path fill="currentColor" stroke="none" d="M8 4.5v15l12-7.5z"/>',
    frame: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16.5" cy="8.5" r="1"/>',
    song: '<path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
    audio: '<path d="M3 10v4m4-8v12m5-15v18m5-15v12m4-8v4"/>',
    lyric: '<path d="M11 6H7a3 3 0 0 0-3 3v7h6v-5H6m14-5h-4a3 3 0 0 0-3 3v7h6v-5h-4"/>',
    emoji: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.4 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    hero: '<path d="m3 18 2-11 5 4 2-6 2 6 5-4 2 11ZM5 21h14"/>',
    heroine: '<path d="m12 3 2.5 6.3 6.5.4-5 4.2 1.5 6.4-5.5-3.5-5.5 3.5L8 13.9 3 9.7l6.5-.4z"/>',
    plot: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8m-8 4h6m-6 4h8"/>',
    meme: '<path d="M20 15a2 2 0 0 1-2 2h-5l-4 4v-4H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2zM8 11s1.2 2 4 2 4-2 4-2"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8"/>',
    choices: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
    trophy: '<path d="M8 21h8m-4-4v4M7 3h10v8a5 5 0 0 1-10 0V3Zm0 3H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M12 16V3M7 8l5-5 5 5M4 15v5h16v-5"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};

const large = {
  frame: '<g transform="rotate(-13 127 75)"><rect x="55" y="26" width="144" height="99" rx="7"/><path d="M55 46h144m-144 60h144M70 26v20m28-20v20m29-20v20m29-20v20m28-20v20M70 106v19m28-19v19m29-19v19m29-19v19m28-19v19"/><path d="m66 99 39-35 28 28 20-18 33 25"/><circle cx="163" cy="62" r="8"/></g>',
  audio: '<g stroke-linecap="round"><path d="M41 75v8m13-16v24m13-35v46m13-37v28m13-50v72m13-54v36m13-72v108m13-94v80m13-65v50m13-58v66m13-41v16m13-29v42m13-33v24m13-16v8"/><path opacity=".3" d="M33 79h187"/></g>',

  song: '<g stroke-linecap="round"><path d="M41 75v8m13-16v24m13-35v46m13-37v28m13-50v72m13-54v36m13-72v108m13-94v80m13-65v50m13-58v66m13-41v16m13-29v42m13-33v24m13-16v8"/><path opacity=".3" d="M33 79h187"/></g>',
  lyric: '<g transform="rotate(-10 127 72)"><path d="M118 39c-22 3-35 17-35 38v17h36V63H99c4-10 10-15 20-18zm52 0c-22 3-35 17-35 38v17h36V63h-20c4-10 10-15 20-18z" fill="currentColor" fill-opacity=".17"/><path opacity=".4" d="M64 111h120M87 124h74"/></g>',
  emoji: '<g transform="rotate(12 127 75)"><circle cx="123" cy="75" r="48"/><path d="M98 82c9 19 40 19 50 0M109 61h.1m28 0h.1" stroke-linecap="round"/><path d="m185 23 5 11 11 4-11 5-5 11-4-11-11-5 11-4zm-121 68 4 10 9 4-9 4-4 9-4-9-9-4 9-4z" stroke-width="2"/></g>',
  hero: '<g transform="rotate(-9 128 75)"><path d="m66 96 9-58 34 26 19-42 19 42 34-26 9 58z" fill="currentColor" fill-opacity=".12"/><path d="M72 110h112M89 96v14m77-14v14"/><circle cx="128" cy="79" r="7"/><path d="M52 58h-11m173 0h-11" opacity=".45"/></g>',
  heroine: '<g transform="rotate(12 128 75)"><path d="m127 18 14 37 41 2-31 27 10 40-34-22-34 22 10-40-31-27 41-2z" fill="currentColor" fill-opacity=".13"/><path d="m189 32 4 10 9 4-9 4-4 10-4-10-9-4 9-4zM62 91l3 7 8 3-8 3-3 8-3-8-8-3 8-3z"/></g>',
  plot: '<g transform="rotate(-10 128 75)"><path d="M87 22h62l25 25v78H87a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6zM149 22v26h25" fill="currentColor" fill-opacity=".09"/><path d="M101 61h50m-50 16h47m-47 17h24m13 0h12" stroke-linecap="round"/><path d="M67 42H54m18 58H55m137-28h12" opacity=".55"/></g>',
  meme: '<g transform="rotate(10 127 75)"><path d="M178 36H78a12 12 0 0 0-12 12v41a12 12 0 0 0 12 12h17v19l24-19h59a12 12 0 0 0 12-12V48a12 12 0 0 0-12-12z" fill="currentColor" fill-opacity=".13"/><path d="M103 74q24 24 48 0M110 57h.1m33 0h.1" stroke-linecap="round"/><path d="m203 20 4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/></g>',
};
export const cardArt = name => `<svg viewBox="0 0 255 145" class="card-art" fill="none" stroke="currentColor" stroke-width="${name === 'audio' ? 3 : 2.1}" aria-hidden="true">${large[name]}</svg>`;
