const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';
const TASKS_API = 'https://tasks.googleapis.com/tasks/v1';
let taskLists=[], tasks=[], tasksConnected=false;

function localDateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dueKey(task){return task.due?task.due.slice(0,10):''}
function filteredTasks(){const today=localDateKey();return tasks.filter(t=>!t.deleted&&!t.hidden&&t.status!=='completed').filter(t=>{const due=dueKey(t);return state.taskFilter==='upcoming'?due&&due>today:(!due||due<=today)}).sort((a,b)=>(dueKey(a)||'9999').localeCompare(dueKey(b)||'9999')||String(a.position||'').localeCompare(String(b.position||'')))}
function formatDue(task){const key=dueKey(task);if(!key)return '';return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(`${key}T12:00:00`))}

function setDisconnected(message='Connect your Google account to load Tasks.') {
  tasksConnected=false;
  els.syncState.classList.remove('connected');
  els.syncState.innerHTML='<span></span> Not connected';
  els.taskStatus.hidden=false;
  els.taskStatus.innerHTML=`<strong>Google Tasks not connected</strong><span>${message}</span><button id="inlineConnect" class="primary compact-button">Connect Google</button>`;
  $('inlineConnect').addEventListener('click',connectGoogle);
  els.taskList.hidden=true; els.addTaskForm.hidden=true; els.taskListSelect.hidden=true;
}

function renderTasks() {
  tasksConnected=true;
  const visible=filteredTasks();
  els.syncState.classList.add('connected');
  els.syncState.innerHTML='<span></span> Synced';
  els.taskStatus.hidden=true; els.taskList.hidden=false; els.addTaskForm.hidden=false;
  els.taskListSelect.hidden=taskLists.length<2; els.taskList.replaceChildren();
  if(!visible.length){els.taskList.innerHTML='<div class="task-status"><strong>All clear</strong><span>No tasks in this view.</span></div>';return}
  for(const task of visible){
    const row=document.createElement('div');row.className='task-row';
    const check=document.createElement('input');check.type='checkbox';check.addEventListener('change',()=>toggleTask(task,true));
    const title=document.createElement('span');title.className='task-title';title.textContent=task.title||'Untitled';
    const due=document.createElement('span');due.className='task-due';due.textContent=formatDue(task);
    const edit=document.createElement('button');edit.className='task-action';edit.textContent='✎';edit.title='Edit';edit.addEventListener('click',()=>editTask(task));
    const remove=document.createElement('button');remove.className='task-action';remove.textContent='×';remove.title='Delete';remove.addEventListener('click',()=>deleteTask(task));
    row.append(check,title,due,edit,remove);els.taskList.append(row);
  }
}

async function clearGoogleSession(){await sessionStore.remove(['googleAccessToken','googleTokenExpiresAt'])}
async function getGoogleToken(interactive=false){
  const cached=await sessionStore.get(['googleAccessToken','googleTokenExpiresAt']);
  if(cached.googleAccessToken&&Number(cached.googleTokenExpiresAt)>Date.now()+60000)return cached.googleAccessToken;
  if(!interactive)return '';
  if(!state.googleClientId)throw new Error('OAuth Client ID is missing. Open Settings → Google Tasks first.');
  const redirectUri=chrome.identity.getRedirectURL('google'), authState=crypto.randomUUID();
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',state.googleClientId);url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('response_type','token');
  url.searchParams.set('scope',TASKS_SCOPE);url.searchParams.set('include_granted_scopes','true');url.searchParams.set('state',authState);url.searchParams.set('prompt','select_account');
  const resultUrl=await chrome.identity.launchWebAuthFlow({url:url.toString(),interactive:true});
  if(!resultUrl)throw new Error('Google sign-in was cancelled.');
  const parsed=new URL(resultUrl), params=new URLSearchParams(parsed.hash.slice(1));
  if(params.get('state')!==authState)throw new Error('Google returned an invalid OAuth state.');
  if(params.get('error'))throw new Error(params.get('error_description')||params.get('error'));
  const token=params.get('access_token');if(!token)throw new Error('Google did not return an access token.');
  await sessionStore.set({googleAccessToken:token,googleTokenExpiresAt:Date.now()+Number(params.get('expires_in')||3600)*1000});return token;
}
async function tasksFetch(path,options={}){
  const token=await getGoogleToken(false);if(!token)throw new Error('REAUTH_REQUIRED');
  const response=await fetch(`${TASKS_API}${path}`,{...options,headers:{'Content-Type':'application/json',...(options.headers||{}),Authorization:`Bearer ${token}`}});
  if(response.status===401){await clearGoogleSession();throw new Error('REAUTH_REQUIRED')}
  if(!response.ok){let message=`${response.status} ${response.statusText}`;try{message=(await response.json())?.error?.message||message}catch{}throw new Error(message)}
  return response.status===204?null:response.json();
}
async function loadTaskLists(){
  const data=await tasksFetch('/users/@me/lists?maxResults=100');taskLists=data.items||[];if(!taskLists.length)throw new Error('No Google task lists were found.');
  if(!taskLists.some(x=>x.id===state.selectedTaskListId)){state.selectedTaskListId=taskLists[0].id;await storage.set({selectedTaskListId:state.selectedTaskListId})}
  els.taskListSelect.replaceChildren();for(const list of taskLists){const option=document.createElement('option');option.value=list.id;option.textContent=list.title;els.taskListSelect.append(option)}els.taskListSelect.value=state.selectedTaskListId;
}
async function loadTasks({interactive=false}={}){
  try{if(interactive)await getGoogleToken(true);const token=await getGoogleToken(false);if(!token){setDisconnected();return}await loadTaskLists();const data=await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks?maxResults=100&showCompleted=true&showHidden=false`);tasks=data.items||[];renderTasks()}
  catch(error){if(error.message==='REAUTH_REQUIRED')setDisconnected('Your Google session expired. Connect again.');else setDisconnected(error.message||'Could not load Google Tasks.')}
}
async function connectGoogle(){
  if(!state.googleClientId){openSettings(true);els.googleSetupHint.textContent='Paste a Google OAuth Client ID first, then press Connect / test Google Tasks.';return}
  els.syncState.innerHTML='<span></span> Connecting…';
  try{await loadTasks({interactive:true});els.googleSetupHint.textContent='Connected successfully.'}catch(error){setDisconnected(error.message);els.googleSetupHint.textContent=error.message}
}
async function addTask(title){const clean=title.trim();if(!clean||!state.selectedTaskListId)return;await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks`,{method:'POST',body:JSON.stringify({title:clean})});els.newTaskInput.value='';await loadTasks()}
async function toggleTask(task,completed){await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks/${encodeURIComponent(task.id)}`,{method:'PATCH',body:JSON.stringify({status:completed?'completed':'needsAction'})});await loadTasks()}
async function editTask(task){const title=prompt('Edit task:',task.title||'');if(title===null||!title.trim())return;await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks/${encodeURIComponent(task.id)}`,{method:'PATCH',body:JSON.stringify({title:title.trim()})});await loadTasks()}
async function deleteTask(task){if(!confirm(`Delete “${task.title||'Untitled'}”?`))return;await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks/${encodeURIComponent(task.id)}`,{method:'DELETE'});await loadTasks()}
