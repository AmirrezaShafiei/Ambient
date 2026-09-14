let timerId=null, timerSeconds=25*60;
function formatTimer(){const m=Math.floor(timerSeconds/60),s=timerSeconds%60;els.timerText.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}els.timerStart.textContent='▶ Start'}
function resetTimer(){stopTimer();timerSeconds=Number(state.timerMinutes||25)*60;formatTimer()}
function toggleTimer(){if(timerId){stopTimer();return}els.timerStart.textContent='Ⅱ Pause';timerId=setInterval(()=>{timerSeconds=Math.max(0,timerSeconds-1);formatTimer();if(timerSeconds===0){stopTimer();document.title='Focus complete · Ambient';setTimeout(()=>document.title='Ambient Dashboard',3000)}},1000)}

function bindEvents(){
  els.searchForm.addEventListener('submit',e=>{e.preventDefault();const q=els.searchInput.value.trim();if(q)location.href=searchUrl(q)});
  els.mainPlay.addEventListener('click',()=>isPlaying?stopAll():startAll());
  els.resetMix.addEventListener('click',()=>applyPreset('rainy',isPlaying));
  els.prevPreset.addEventListener('click',()=>cyclePreset(-1)); els.nextPreset.addEventListener('click',()=>cyclePreset(1));
  els.favoritePreset.addEventListener('click',()=>els.favoritePreset.textContent=els.favoritePreset.textContent==='♡'?'♥':'♡');
  document.querySelectorAll('.nav-item[data-target]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));button.classList.add('active');$(button.dataset.target)?.scrollIntoView({behavior:'smooth',block:'center'})}));
  els.settingsButton.addEventListener('click',()=>openSettings()); els.settingsNav.addEventListener('click',()=>openSettings());
  els.closeSettingsButton.addEventListener('click',()=>els.settingsDialog.close());
  els.settingsForm.addEventListener('submit',async e=>{e.preventDefault();await saveSettings();els.settingsDialog.close();await loadTasks()});
  [els.primaryColor,els.accentColor,els.glassIntensity,els.backgroundDim].forEach(input=>input.addEventListener('input',()=>{state.primaryColor=els.primaryColor.value;state.accentColor=els.accentColor.value;state.glassIntensity=Number(els.glassIntensity.value);state.backgroundDim=Number(els.backgroundDim.value);applyTheme()}));
  els.themeMode.addEventListener('change',()=>{state.themeMode=els.themeMode.value;applyTheme()});
  els.backgroundFile.addEventListener('change',()=>setBackground(els.backgroundFile.files?.[0]));
  els.clearBackgroundButton.addEventListener('click',async()=>{state.backgroundImage='';await storage.set({backgroundImage:''});applyTheme()});
  els.copyRedirectButton.addEventListener('click',async()=>{await navigator.clipboard.writeText(els.redirectUri.value);els.copyRedirectButton.textContent='Copied';setTimeout(()=>els.copyRedirectButton.textContent='Copy',1000)});
  els.testGoogleButton.addEventListener('click',async()=>{await saveSettings();await connectGoogle()});
  els.disconnectGoogleButton.addEventListener('click',async()=>{await clearGoogleSession();tasks=[];taskLists=[];setDisconnected('Disconnected. Your Google data was not deleted.')});
  els.connectTasksButton.addEventListener('click',connectGoogle);
  els.taskListSelect.addEventListener('change',async()=>{state.selectedTaskListId=els.taskListSelect.value;await storage.set({selectedTaskListId:state.selectedTaskListId});await loadTasks()});
  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',async()=>{state.taskFilter=tab.dataset.filter;await storage.set({taskFilter:state.taskFilter});document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===tab));if(tasksConnected)renderTasks();else setDisconnected()}));
  els.addTaskForm.addEventListener('submit',async e=>{e.preventDefault();try{await addTask(els.newTaskInput.value)}catch(error){setDisconnected(error.message)}});
  els.notes.addEventListener('input',()=>{els.notesSaved.textContent='Saving…';clearTimeout(notesTimer);notesTimer=setTimeout(async()=>{state.notes=els.notes.value;await storage.set({notes:state.notes});els.notesSaved.textContent='Saved'},300)});
  document.querySelectorAll('.focus-mode').forEach(button=>button.addEventListener('click',async()=>{document.querySelectorAll('.focus-mode').forEach(x=>x.classList.toggle('active',x===button));state.timerMinutes=Number(button.dataset.minutes);await storage.set({timerMinutes:state.timerMinutes});resetTimer()}));
  els.timerStart.addEventListener('click',toggleTimer); els.timerReset.addEventListener('click',resetTimer);
  els.resetSettingsButton.addEventListener('click',()=>{Object.assign(state,{themeMode:DEFAULTS.themeMode,primaryColor:DEFAULTS.primaryColor,accentColor:DEFAULTS.accentColor,glassIntensity:DEFAULTS.glassIntensity,backgroundDim:DEFAULTS.backgroundDim});populateSettings();applyTheme()});
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{if(state.themeMode==='auto')applyTheme()});
}

async function init(){
  const saved=await storage.get(Object.keys(DEFAULTS)); state={...structuredClone(DEFAULTS),...saved};
  if((saved.schemaVersion||0)<SCHEMA_VERSION){Object.assign(state,{schemaVersion:SCHEMA_VERSION,themeMode:'light',primaryColor:DEFAULTS.primaryColor,accentColor:DEFAULTS.accentColor,glassIntensity:DEFAULTS.glassIntensity,backgroundDim:DEFAULTS.backgroundDim});await storage.set({schemaVersion:SCHEMA_VERSION,themeMode:state.themeMode,primaryColor:state.primaryColor,accentColor:state.accentColor,glassIntensity:state.glassIntensity,backgroundDim:state.backgroundDim})}
  state.mix={...DEFAULTS.mix,...(saved.mix||{})}; applyTheme(); updateClock(); setInterval(updateClock,15000);
  els.notes.value=state.notes||''; renderSounds(); renderPresets(); showPresetMeta(state.currentPreset||'rainy');
  timerSeconds=Number(state.timerMinutes||25)*60; formatTimer();
  document.querySelectorAll('.focus-mode').forEach(b=>b.classList.toggle('active',Number(b.dataset.minutes)===Number(state.timerMinutes)));
  document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.filter===state.taskFilter));
  bindEvents(); populateSettings(); await loadTasks();
}
init();
