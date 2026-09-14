const SOUNDS = [
  {id:'rain',name:'Rain',icon:'☂'}, {id:'wind',name:'Wind',icon:'〰'}, {id:'cafe',name:'Café',icon:'☕'},
  {id:'thunder',name:'Thunder',icon:'ϟ'}, {id:'forest',name:'Forest',icon:'♟'}, {id:'white',name:'White Noise',icon:'≋'}
];
const PRESETS = [
  {id:'deep',name:'Deep Focus',desc:'Forest · Rain · White Noise',title:'Deep Focus',subtitle:'A soft blanket of sound for concentrated work.',mix:{rain:42,wind:0,cafe:0,thunder:0,forest:44,white:34}},
  {id:'rainy',name:'Rainy Café',desc:'Rain · Café · Soft room tone',title:'Rainy Café',subtitle:'A cozy space for clearer thoughts.',mix:{rain:70,wind:20,cafe:50,thunder:10,forest:0,white:10}},
  {id:'night',name:'Night Wind',desc:'Wind · Distant city · White Noise',title:'Night Wind',subtitle:'A quiet city settling down for the night.',mix:{rain:0,wind:62,cafe:14,thunder:0,forest:10,white:28}}
];

let audioContext, masterGain, isPlaying=false;
const engines = new Map();

function renderSounds() {
  els.soundGrid.replaceChildren();
  for (const sound of SOUNDS) {
    const card = document.createElement('div');
    card.className = `sound-card${state.mix[sound.id] > 0 ? ' active' : ''}`;
    card.innerHTML = `<span class="sound-icon">${sound.icon}</span><strong>${sound.name}</strong><span class="sound-value">${state.mix[sound.id]}%</span><input class="sound-range" type="range" min="0" max="100" value="${state.mix[sound.id]}" aria-label="${sound.name} volume">`;
    const range = card.querySelector('input');
    const value = card.querySelector('.sound-value');
    range.addEventListener('input', async ()=>{
      state.mix[sound.id] = Number(range.value);
      value.textContent = `${range.value}%`;
      card.classList.toggle('active', Number(range.value)>0);
      await storage.set({mix:state.mix});
      if (isPlaying) restartSound(sound.id);
    });
    els.soundGrid.append(card);
  }
}

function renderPresets() {
  els.presetGrid.replaceChildren();
  PRESETS.forEach(preset=>{
    const button = document.createElement('button');
    button.className = 'preset-card';
    button.innerHTML = `<span class="preset-copy"><strong>${preset.name}</strong><small>${preset.desc}</small></span><span class="preset-play">▶</span>`;
    button.addEventListener('click',()=>applyPreset(preset.id,true));
    els.presetGrid.append(button);
  });
}

function showPresetMeta(id) {
  const preset = PRESETS.find(x=>x.id===id) || PRESETS[1];
  els.sceneTitle.textContent = preset.title;
  els.sceneSubtitle.textContent = preset.subtitle;
}

function applyPreset(id, play=false) {
  const preset = PRESETS.find(x=>x.id===id) || PRESETS[1];
  state.currentPreset = preset.id;
  state.mix = {...preset.mix};
  showPresetMeta(preset.id);
  storage.set({currentPreset:state.currentPreset,mix:state.mix});
  renderSounds();
  if (play) { if (isPlaying) stopAll(); startAll(); }
}

function cyclePreset(step) {
  const index = PRESETS.findIndex(p=>p.id===state.currentPreset);
  const next = (index + step + PRESETS.length) % PRESETS.length;
  applyPreset(PRESETS[next].id, isPlaying);
}

function initAudio() {
  if (audioContext) return;
  audioContext = new (window.AudioContext||window.webkitAudioContext)();
  masterGain = audioContext.createGain(); masterGain.gain.value=.62; masterGain.connect(audioContext.destination);
}

function noiseBuffer(seconds=3,brown=false) {
  const length=audioContext.sampleRate*seconds;
  const buffer=audioContext.createBuffer(1,length,audioContext.sampleRate);
  const data=buffer.getChannelData(0); let last=0;
  for(let i=0;i<length;i++){
    const white=Math.random()*2-1;
    if(brown){last=(last+.02*white)/1.02;data[i]=last*3.4}else data[i]=white;
  }
  return buffer;
}
function makeNoise(brown=false){const src=audioContext.createBufferSource();src.buffer=noiseBuffer(4,brown);src.loop=true;return src}

function createEngine(id,volume) {
  initAudio();
  const gain=audioContext.createGain(); gain.gain.value=Math.max(.0001,volume/100); gain.connect(masterGain);
  const nodes=[]; const add=n=>{nodes.push(n);return n};
  if(id==='rain'||id==='white'){
    const n=add(makeNoise(false)), f=add(audioContext.createBiquadFilter());
    f.type=id==='rain'?'highpass':'bandpass'; f.frequency.value=id==='rain'?1000:1400; f.Q.value=id==='rain'?.2:.5;
    n.connect(f).connect(gain); n.start();
  } else if(id==='wind'||id==='forest'){
    const n=add(makeNoise(id==='forest')), f=add(audioContext.createBiquadFilter()), lfo=add(audioContext.createOscillator()), lg=add(audioContext.createGain());
    f.type='bandpass'; f.frequency.value=id==='wind'?500:900; f.Q.value=.4; lfo.frequency.value=id==='wind'?.09:.16; lg.gain.value=id==='wind'?240:160;
    lfo.connect(lg).connect(f.frequency); n.connect(f).connect(gain); n.start(); lfo.start();
  } else if(id==='cafe'){
    const n=add(makeNoise(true)), f=add(audioContext.createBiquadFilter()); f.type='bandpass'; f.frequency.value=620; f.Q.value=.7; n.connect(f).connect(gain); n.start();
  } else if(id==='thunder'){
    const n=add(makeNoise(true)), f=add(audioContext.createBiquadFilter()); f.type='lowpass'; f.frequency.value=180; n.connect(f).connect(gain); n.start();
  }
  return {stop(){nodes.forEach(n=>{try{n.stop?.()}catch{}});try{gain.disconnect()}catch{}}};
}
function startAll(){initAudio();audioContext.resume();for(const sound of SOUNDS){if(state.mix[sound.id]>0&&!engines.has(sound.id))engines.set(sound.id,createEngine(sound.id,state.mix[sound.id]))}isPlaying=true;els.mainPlay.textContent='Ⅱ'}
function stopAll(){for(const engine of engines.values())engine.stop();engines.clear();isPlaying=false;els.mainPlay.textContent='▶'}
function restartSound(id){if(!isPlaying)return;const old=engines.get(id);if(old){old.stop();engines.delete(id)}if(state.mix[id]>0)engines.set(id,createEngine(id,state.mix[id]))}
