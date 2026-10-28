import { buildIdeaPrompt, getTemplateFields, IdeaInputError } from './lib/prompt-builder.mjs';
import { COMMON_FIELDS, LIMITS, PROMPT_VERSION, REFERENCE_MODES, TEMPLATES } from './lib/templates.mjs';
import { buildEnquiryMessage, createMessageHandoff } from './lib/chat-handoff.mjs';

const $ = selector => document.querySelector(selector);
const KEY = 'eleven-layers.idea-studio.v1';
const categoryKeys = Object.keys(TEMPLATES);
const commonKeys = COMMON_FIELDS.map(field => field.id);
const samples = {
  miniature: 'A miniature of me in my graduation gown, smiling and holding a book. I’d like my name on the base.',
  vase: 'A sage-green spiral vase for dried flowers, about 20 cm tall, with a wide, stable base.',
  accessory: 'A small desk organiser for my pens and phone, with a curved shape and my name on the front.',
};
const placeholders = {
  size:'For example, about 20 cm tall',colour:'A colour or a combination you like',style:'Minimal, playful, sculptural…',
  personalisation:'Exact spelling, names, or text',mustKeep:'The details that matter most',avoid:'Anything you don’t want',
  subject:'One person, a couple, a pet…',pose:'Standing, seated, holding something…',clothing:'Clothes and accessories you have in mind',baseText:'Exact spelling for the base',
  intendedUse:'Dried flowers, a plant, or decorative use…',opening:'Wide, narrow, or a shape you have in mind',surfacePattern:'Spiral, smooth, ribbed…',
  occasion:'A birthday, a wedding, a celebration…',recipient:'Who is it for?',giftFunction:'A keepsake, a magnet, a name keychain…',
  function:'What should it hold or help you do?',fittingDimensions:'Include measurements and units, if known',mounting:'Freestanding, on a wall, attached…',
  purpose:'What is the object for?',features:'Describe the features you imagine',
};
function emptyState(){return {
  version:1,step:1,maxStep:1,category:'custom',rawIdea:'',common:{},categories:{},references:{},
  prompt:'',generatedPrompt:'',promptEdited:false,templateVersion:PROMPT_VERSION,
  order:{quantity:'',neededBy:'',budget:'',notes:''},hasImage:false,
  enquiry:'',generatedEnquiry:'',enquiryEdited:false,
};}
let state=emptyState();
let storageAvailable=true;
let restored=false;
let pendingPrompt=null;
let confirmationAction=null;
let currentEnquiry='';

function checkedText(value,max,fallback=''){
  if(value===undefined)return fallback;
  if(typeof value!=='string'||Array.from(value).length>max)throw new Error('Invalid draft');
  return value;
}
function restoreDraft(){
  try{
    const saved=sessionStorage.getItem(KEY);
    if(!saved)return;
    if(saved.length>200000)throw new Error('Draft too large');
    const data=JSON.parse(saved);
    if(data.version!==1||!categoryKeys.includes(data.category))throw new Error('Unknown draft');
    const next=emptyState();
    next.category=data.category;next.rawIdea=checkedText(data.rawIdea,LIMITS.rawIdea);
    for(const field of COMMON_FIELDS)next.common[field.id]=checkedText(data.common?.[field.id],LIMITS.detail);
    for(const category of categoryKeys){
      next.categories[category]={};
      for(const field of TEMPLATES[category].fields)next.categories[category][field.id]=checkedText(data.categories?.[category]?.[field.id],LIMITS.detail);
      next.references[category]=REFERENCE_MODES.includes(data.references?.[category])?data.references[category]:'unspecified';
    }
    for(const key of ['prompt','generatedPrompt','enquiry','generatedEnquiry'])next[key]=checkedText(data[key],20000);
    next.promptEdited=Boolean(data.promptEdited);next.enquiryEdited=Boolean(data.enquiryEdited);
    for(const key of ['quantity','neededBy','budget','notes'])next.order[key]=checkedText(data.order?.[key],key==='notes'?1500:key==='budget'?100:30);
    next.hasImage=data.hasImage===true;
    next.maxStep=Math.max(1,Math.min(4,Number(data.maxStep)||1));
    next.step=Math.max(1,Math.min(next.maxStep,Number(data.step)||1));
    if(!next.rawIdea.trim()){next.step=1;next.maxStep=1;}
    else if(!next.prompt&&next.step>2){next.step=2;next.maxStep=2;}
    if(data.templateVersion!==PROMPT_VERSION){next.step=Math.min(next.step,2);next.maxStep=Math.min(next.maxStep,2);}
    state=next;restored=Boolean(next.rawIdea.trim()||next.prompt.trim());
  }catch{
    $('#draft-notice').hidden=false;
    $('#draft-notice').textContent='The saved draft could not be restored. Start here, or paste a brief you downloaded earlier.';
  }
}
function saveDraft(){
  try{sessionStorage.setItem(KEY,JSON.stringify(state));}
  catch{
    if(storageAvailable){$('#draft-notice').hidden=false;$('#draft-notice').textContent='This browser can’t save your draft in the tab. Keep this page open and download your brief before switching apps.';}
    storageAvailable=false;
  }
}
function announce(message){$('#status-message').textContent=message;}
function clearError(){$('#error-message').hidden=true;$('#error-message').textContent='';document.querySelectorAll('[aria-invalid=true]').forEach(input=>input.removeAttribute('aria-invalid'));}
function showError(error,focusTarget){
  const message=error instanceof Error?error.message:String(error);
  $('#error-message').textContent=message;$('#error-message').hidden=false;
  if(focusTarget){focusTarget.setAttribute('aria-invalid','true');focusTarget.focus();}
  else $('#error-message').scrollIntoView({block:'nearest',behavior:'instant'});
}
function readIdea(){return {
  category:state.category,rawIdea:state.rawIdea,
  referenceMode:state.category==='miniature'?(state.references.miniature||'unspecified'):'unspecified',
  details:{...state.common,...state.categories[state.category]},
};}
function readOrder(){return {...state.order,hasImage:state.hasImage};}
function updateSummary(){
  $('#summary-category').textContent=TEMPLATES[state.category].label;
  $('#summary-text').textContent=state.rawIdea.trim()||'Tell us about the object you have in mind. We’ll help you prepare the next step.';
  $('#idea-count').textContent=Array.from(state.rawIdea).length.toLocaleString('en-IN')+' / 4,000';
}
function renderFields(){
  const fields=getTemplateFields(state.category);
  const firstIds=[...TEMPLATES[state.category].fields.slice(0,2).map(field=>field.id),'size'];
  const primary=$('#primary-fields');const extra=$('#extra-fields');primary.replaceChildren();extra.replaceChildren();
  for(const field of fields){
    const wrapper=document.createElement('div');const label=document.createElement('label');
    label.htmlFor='detail-'+field.id;label.textContent=field.label;
    const input=document.createElement('input');input.type='text';input.id='detail-'+field.id;input.maxLength=LIMITS.detail;
    input.placeholder=placeholders[field.id]||'Optional';
    input.value=(commonKeys.includes(field.id)?state.common:state.categories[state.category])?.[field.id]||'';
    input.addEventListener('input',()=>{
      if(commonKeys.includes(field.id))state.common[field.id]=input.value;
      else{state.categories[state.category]??={};state.categories[state.category][field.id]=input.value;}
      saveDraft();
    });
    wrapper.append(label,input);
    (firstIds.includes(field.id)?primary:extra).append(wrapper);
  }
  $('#reference-field').hidden=state.category!=='miniature';
  $('#reference-mode').value=state.references.miniature||'unspecified';
}
function fillForm(){
  document.querySelectorAll('details').forEach(details=>details.open=false);
  $('#idea-description').value=state.rawIdea;
  document.querySelector('input[name=category][value="'+state.category+'"]').checked=true;
  for(const key of ['quantity','neededBy','budget','notes']){
    const id=key==='neededBy'?'order-date':'order-'+key;
    $('#'+id).value=state.order[key];
  }
  $('#prepared-prompt').value=state.prompt;$('#enquiry-text').value=state.enquiry;
  updateSummary();renderFields();
}
function displayStep(step,{focus=true}={}){
  state.step=step;state.maxStep=Math.max(state.maxStep,step);
  document.querySelectorAll('.studio-step').forEach(section=>section.hidden=section.id!=='step-'+step);
  document.querySelectorAll('[data-step]').forEach(button=>{
    const number=Number(button.dataset.step);button.disabled=number>state.maxStep;
    button.classList.toggle('is-complete',number<step);
    if(number===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  });
  clearError();announce('');
  if(step===2)renderFields();
  if(step===3){
    $('#prepared-prompt').value=state.prompt;
    try{const notices=buildIdeaPrompt(readIdea()).notices;$('#prompt-notices').hidden=!notices.length;$('#prompt-notices').textContent=notices.map(item=>item.text).join(' ');}catch{}
  }
  if(step===4){
    $('#chat-image-note').textContent=state.hasImage?'Choose where you’d like to discuss your idea. Attach your downloaded image directly in that chat.':'You can discuss your idea as it is. Choose a chat, and add a reference image there if you have one.';
    refreshEnquiry();
  }
  saveDraft();
  if(focus){$('#heading-'+step).focus({preventScroll:true});$('.studio-card').scrollIntoView({block:'start',behavior:'instant'});}
}
function validateDescription(){
  state.rawIdea=$('#idea-description').value;
  try{buildIdeaPrompt(readIdea());return true;}
  catch(error){showError(error,$('#idea-description'));return false;}
}
function acceptPrompt(result,keepEdited=false){
  state.generatedPrompt=result.prompt;
  if(!keepEdited)state.prompt=result.prompt;
  state.promptEdited=state.prompt!==state.generatedPrompt;state.templateVersion=result.templateVersion;
  displayStep(3);
  if(keepEdited)announce('Your edited prompt is kept. Check that it includes the details you just changed.');
}
function preparePrompt({force=false}={}){
  if(!validateDescription())return;
  try{
    const result=buildIdeaPrompt(readIdea());
    if(state.promptEdited&&state.prompt&&(force||result.prompt!==state.generatedPrompt)){
      pendingPrompt=result;$('#prompt-dialog').showModal();return;
    }
    acceptPrompt(result,state.promptEdited&&!force);
  }catch(error){showError(error);}
}
function navigate(step){
  if(step===1){displayStep(1);return;}
  if(!validateDescription()){displayStep(1);validateDescription();return;}
  if(step===2){displayStep(2);return;}
  if(step===3){preparePrompt();return;}
  if(step===4)displayStep(4);
}
function refreshEnquiry(){
  try{
    currentEnquiry=buildEnquiryMessage(readIdea(),readOrder());
    if(!state.enquiryEdited){
      state.enquiry=currentEnquiry;state.generatedEnquiry=currentEnquiry;state.enquiryEdited=false;
      $('#enquiry-text').value=state.enquiry;
    }
    $('#enquiry-stale').hidden=!(state.enquiryEdited&&currentEnquiry!==state.generatedEnquiry);
    const link=createMessageHandoff('whatsapp',state.enquiry);
    $('#whatsapp-action').firstChild.textContent=link.copyRequired?'Copy enquiry & open WhatsApp ':'Continue on WhatsApp ';
    saveDraft();return true;
  }catch(error){return false;}
}
function validEnquiry(){
  clearError();
  if(!$('#chat-form').checkValidity()){$('.order-details').open=true;$('#chat-form').reportValidity();return false;}
  try{
    currentEnquiry=buildEnquiryMessage(readIdea(),readOrder());
    if(!refreshEnquiry())throw new IdeaInputError('Check your enquiry details before continuing.','enquiry');
    if(!$('#enquiry-stale').hidden){$('#enquiry-stale').scrollIntoView({block:'center'});announce('Choose whether to update the enquiry or keep your edited wording.');return false;}
    createMessageHandoff('whatsapp',state.enquiry);return true;
  }catch(error){
    const ids={quantity:'order-quantity',neededBy:'order-date',budget:'order-budget',notes:'order-notes',enquiry:'enquiry-text'};
    if(ids[error.field]?.startsWith('order-'))$('.order-details').open=true;
    showError(error,$('#'+(ids[error.field]||'enquiry-text')));return false;
  }
}
function selectText(element){element.focus();element.select();element.setSelectionRange(0,element.value.length);}
async function copyText(text,element){
  if(!text.trim()){showError(new Error('Add some text before copying.'),element);return false;}
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);return true;
  }catch{selectText(element);announce('Automatic copying isn’t available. The text is selected—copy it, then use the separate link to continue.');return false;}
}
function reserveTab(){
  try{const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;return tab;}catch{return null;}
}
async function copyAndOpen(text,url,element,success){
  saveDraft();
  if(!navigator.clipboard?.writeText){await copyText(text,element);return false;}
  // Start clipboard access while this document still has focus and activation.
  const copying=copyText(text,element);
  const tab=reserveTab();
  const copied=await copying;
  if(!copied){try{tab?.close();}catch{}return false;}
  if(tab){tab.location.replace(url);announce(success);}
  else announce('Text copied. Your browser blocked the new tab—use the separate link to open it.');
  return true;
}
function askConfirmation({title,copy,accept,cancel='Keep my draft',action}){
  confirmationAction=action;$('#confirm-title').textContent=title;$('#confirm-copy').textContent=copy;
  $('#confirm-accept').textContent=accept;$('#confirm-cancel').textContent=cancel;$('#confirm-dialog').showModal();
}

restoreDraft();fillForm();
if(restored){$('#draft-notice').hidden=false;$('#draft-notice').textContent='Your text draft was restored from this tab. You can continue where you left off.';}
displayStep(state.step,{focus:false});
const today=new Date();$('#order-date').min=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');

$('#idea-description').addEventListener('input',event=>{state.rawIdea=event.target.value;updateSummary();clearError();saveDraft();});
document.querySelectorAll('input[name=category]').forEach(input=>input.addEventListener('change',()=>{state.category=input.value;updateSummary();renderFields();saveDraft();}));
$('#reference-mode').addEventListener('change',event=>{state.references.miniature=event.target.value;saveDraft();});
$('#describe-form').addEventListener('submit',event=>{event.preventDefault();if(validateDescription())displayStep(2);});
$('#shape-form').addEventListener('submit',event=>{event.preventDefault();preparePrompt();});
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>navigate(Number(button.dataset.step))));
document.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>navigate(Number(button.dataset.back))));
$('#prepared-prompt').addEventListener('input',event=>{state.prompt=event.target.value;state.promptEdited=state.prompt!==state.generatedPrompt;saveDraft();});
$('#rebuild-prompt').addEventListener('click',()=>preparePrompt({force:true}));
$('#prompt-keep').addEventListener('click',()=>{const result=pendingPrompt;pendingPrompt=null;$('#prompt-dialog').close();if(result)acceptPrompt(result,true);});
$('#prompt-rebuild').addEventListener('click',()=>{const result=pendingPrompt;pendingPrompt=null;$('#prompt-dialog').close();if(result)acceptPrompt(result);});
$('#prompt-cancel').addEventListener('click',()=>{$('#prompt-dialog').close();pendingPrompt=null;});
$('#prompt-dialog').addEventListener('close',()=>{pendingPrompt=null;});
$('#copy-prompt').addEventListener('click',async()=>{if(await copyText(state.prompt,$('#prepared-prompt')))announce('Prompt copied. Paste it into a new ChatGPT chat.');});
$('#select-prompt').addEventListener('click',()=>{selectText($('#prepared-prompt'));announce('Prompt selected. Copy it, then open ChatGPT.');});
$('#open-chatgpt').addEventListener('click',async event=>{
  const button=event.currentTarget;
  if(!state.prompt.trim()){showError(new Error('Your prompt is empty. Rebuild it or add your wording before copying.'),$('#prepared-prompt'));return;}
  button.disabled=true;await copyAndOpen(state.prompt,'https://chatgpt.com/',$('#prepared-prompt'),'Prompt copied. Paste it in ChatGPT, generate and download your image, then return to this tab.');button.disabled=false;
});
$('#have-image').addEventListener('click',()=>{state.hasImage=true;displayStep(4);});
$('#skip-image').addEventListener('click',()=>{state.hasImage=false;displayStep(4);});
for(const [id,key] of [['order-quantity','quantity'],['order-date','neededBy'],['order-budget','budget'],['order-notes','notes']]){
  $('#'+id).addEventListener('input',event=>{state.order[key]=event.target.value;$('#chat-result').hidden=true;refreshEnquiry();saveDraft();});
}
$('#chat-form').addEventListener('submit',event=>event.preventDefault());
$('#enquiry-text').addEventListener('input',event=>{state.enquiry=event.target.value;state.enquiryEdited=state.enquiry!==state.generatedEnquiry;$('#chat-result').hidden=true;saveDraft();try{const link=createMessageHandoff('whatsapp',state.enquiry);$('#whatsapp-action').firstChild.textContent=link.copyRequired?'Copy enquiry & open WhatsApp ':'Continue on WhatsApp ';}catch{}});
$('#update-enquiry').addEventListener('click',()=>{try{currentEnquiry=buildEnquiryMessage(readIdea(),readOrder());state.enquiry=currentEnquiry;state.generatedEnquiry=currentEnquiry;state.enquiryEdited=false;$('#enquiry-text').value=state.enquiry;refreshEnquiry();announce('Enquiry updated with your current requirements.');}catch(error){showError(error);}});
$('#keep-enquiry').addEventListener('click',()=>{try{state.generatedEnquiry=buildEnquiryMessage(readIdea(),readOrder());$('#enquiry-stale').hidden=true;saveDraft();announce('Your edited enquiry is kept. Check that it includes your latest requirements.');}catch(error){showError(error);}});
$('#copy-enquiry').addEventListener('click',async()=>{if(validEnquiry()&&await copyText(state.enquiry,$('#enquiry-text')))announce('Enquiry copied. Paste it into your chosen chat and attach your image there.');});
$('#select-enquiry').addEventListener('click',()=>{selectText($('#enquiry-text'));announce('Enquiry selected. Copy it, then open your chosen chat.');});
document.querySelectorAll('[data-chat]').forEach(button=>button.addEventListener('click',async()=>{
  if(!validEnquiry())return;
  const handoff=createMessageHandoff(button.dataset.chat,state.enquiry);saveDraft();
  $('#chat-result').hidden=false;$('#chat-result-copy').textContent=handoff.instructions;
  $('#chat-fallback').href=handoff.url;$('#chat-fallback').textContent='Open '+(handoff.channel==='whatsapp'?'WhatsApp':'Instagram')+' separately ↗';
  button.disabled=true;
  if(handoff.copyRequired)await copyAndOpen(handoff.message,handoff.url,$('#enquiry-text'),handoff.instructions);
  else{const tab=reserveTab();if(tab)tab.location.replace(handoff.url);announce(tab?handoff.instructions:'Your browser blocked the new tab. Use Open WhatsApp separately below.');}
  button.disabled=false;
}));
$('#download-brief').addEventListener('click',()=>{
  const lines=['ELEVEN LAYERS — MY IDEA','',state.rawIdea,'',JSON.stringify(readIdea().details,null,2),'','IMAGE PROMPT',state.prompt,'','Template: '+PROMPT_VERSION,'Generate your concept in your own ChatGPT account. Attach the chosen image directly in WhatsApp or Instagram when enquiring.'];
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='Eleven_Layers_My_Idea.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Your text brief has been downloaded.');
});
$('#reset-draft').addEventListener('click',()=>askConfirmation({title:'Clear this draft?',copy:'This clears the idea, details, and edited text saved in this tab.',accept:'Clear draft',action:()=>{state=emptyState();try{sessionStorage.removeItem(KEY);}catch{}$('#draft-notice').hidden=true;$('#chat-result').hidden=true;fillForm();displayStep(1);announce('Draft cleared. Start a new idea whenever you’re ready.');}}));
document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{
  const category=button.dataset.example;
  const apply=()=>{state=emptyState();state.category=category;state.rawIdea=samples[category];fillForm();displayStep(1);$('#idea-description').focus();saveDraft();};
  if(state.rawIdea.trim())askConfirmation({title:'Try this example?',copy:'This replaces your current description and details with an example. You can edit it afterward.',accept:'Use example',cancel:'Keep my idea',action:apply});else apply();
}));
$('#confirm-cancel').addEventListener('click',()=>{$('#confirm-dialog').close();confirmationAction=null;});
$('#confirm-accept').addEventListener('click',()=>{const action=confirmationAction;confirmationAction=null;$('#confirm-dialog').close();action?.();});
$('#confirm-dialog').addEventListener('close',()=>{confirmationAction=null;});
window.addEventListener('pagehide',saveDraft);
