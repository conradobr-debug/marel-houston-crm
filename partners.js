/* Marel Houston partner relationships, cadences, and content. */
const PARTNER_STAGES = window.APP_CONFIG.pipelines.partners.slice();
const PARTNER_CLASSIFICATIONS = ["Unclassified", "A — Strategic", "B — Potential", "C — Developing"];
const RELATIONSHIP_LEVELS = ["New", "Developing", "Active", "Recurring"];
const PARTNER_REQUIRED_NEXT_ACTION_STAGES = new Set(PARTNER_STAGES.slice(1, 8));
const PARTNER_INTEREST_TAGS = [
  "Kitchens", "Closets", "Entertainment spaces", "Bedrooms", "Bathrooms", "Home offices", "Commercial",
  "Natural wood", "Lacquer", "Hardware", "Lighting", "Technical solutions", "Trends",
  "High-end residential", "Remodels", "New construction"
];
const CONTENT_PILLARS = [
  "Design and inspiration", "Technical expertise", "Professional support",
  "Marel differentiators", "Case studies and proof", "Experiences and relationships"
];
const CONTENT_FORMATS = ["Image", "Video", "PDF", "Catalog", "Case Study", "Text", "Link", "Invitation", "Physical Sample", "Other"];
const CONTACT_CHANNELS = ["Email", "Phone Call", "Showroom Meeting", "Office Visit", "Coffee Meeting", "Event / Networking", "Content Follow-Up", "Other"];
const CONTACT_RESULTS = ["No Response", "Content Sent", "Conversation Completed", "Meeting Scheduled", "Interest Confirmed", "Opportunity Identified", "Project Referred", "No Current Project", "Follow Up Later", "Not Interested"];
const INITIAL_CADENCE = [
  {day:1, key:"initial_d1", title:"Post-visit thank-you", channel:"Email", objective:"Thank the partner and reference a specific point from the conversation."},
  {day:7, key:"initial_d7", title:"Send relevant content", channel:"Email / content", objective:"Share one useful item aligned with the partner's interests."},
  {day:15, key:"initial_d15", title:"Review active projects", channel:"Phone Call", objective:"Identify projects approaching the cabinetry or millwork phase."},
  {day:30, key:"initial_d30", title:"Share a case study", channel:"Email / content", objective:"Demonstrate a relevant design, technical, or project-delivery solution."},
  {day:45, key:"initial_d45", title:"Principal relationship outreach", channel:"Phone call, coffee, or invitation", objective:"Reinforce Marel Houston's commitment to the partnership.", classification:"A — Strategic", strategic:true},
  {day:60, key:"initial_d60", title:"Identify the first opportunity", channel:"Phone Call or Email", objective:"Ask whether there is a suitable project where Marel Houston can contribute."},
  {day:90, key:"initial_d90", title:"Review relationship and classification", channel:"Internal review or outreach", objective:"Review the partner's potential and select the appropriate ongoing cadence."}
];
const PERMANENT_CADENCES = {
  "Strategic": [
    {days:18, title:"Personalized content follow-up", channel:"Email / content"},
    {days:30, title:"Relationship call", channel:"Phone Call", ownerName:"Marianna"},
    {days:42, title:"Content or invitation", channel:"Email / invitation"},
    {days:55, title:"Principal relationship outreach", channel:"Phone call, coffee, or invitation", ownerName:"Conrado"},
    {days:90, title:"Quarterly strategic review", channel:"Internal review"}
  ],
  "Potential": [
    {days:30, title:"Send relevant content", channel:"Email / content"},
    {days:60, title:"Call, invitation, or personal outreach", channel:"Phone Call or invitation"},
    {days:90, title:"Review classification", channel:"Internal review"}
  ],
  "Relationship": [
    {days:50, title:"Relationship content or invitation", channel:"Email / invitation"},
    {days:75, title:"Reactivation outreach", channel:"Email or Phone Call"},
    {days:90, title:"Review classification", channel:"Internal review"}
  ]
};

SPECIFIER_STAGES.splice(0, SPECIFIER_STAGES.length, ...PARTNER_STAGES);
Object.assign(filters, {partnerClassification:"All", relationshipLevel:"All", cadence:"All", opportunity:"All", attention:"All"});

function partnerCsv(value){
  return String(value || "").split(",").map(item=>item.trim()).filter(Boolean);
}
function partnerLocalDateTimeValue(iso){
  const date = iso ? new Date(iso) : new Date();
  if(Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0,16);
}
function partnerAdjustedDate(baseValue, days, time="09:00"){
  const base = new Date(baseValue || Date.now());
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Number(days), Number(time.split(":")[0] || 9), Number(time.split(":")[1] || 0), 0, 0);
  if(date.getDay() === 6) date.setDate(date.getDate() + 2);
  if(date.getDay() === 0) date.setDate(date.getDate() + 1);
  return date.toISOString();
}
function partnerProfileByName(name){
  const needle = String(name || "").toLowerCase();
  return profiles.find(profile=>String(profile.display_name || "").toLowerCase().includes(needle)) || null;
}
function partnerDaysWithoutContact(record){
  const value = record.last_contact_at || record.first_visit_at || record.created_at;
  if(!value) return null;
  return Math.max(0, daysBetween(new Date(value), new Date()));
}
function partnerNeedsNextAction(record){ return PARTNER_REQUIRED_NEXT_ACTION_STAGES.has(record.stage); }
function partnerHasOpportunity(record){ return ["Qualified Partner", "Active Referral Partner", "Strategic Partner"].includes(record.stage); }
function partnerOwnerOption(id){
  return profiles.map(profile=>`<option value="${escapeHtml(profile.id)}" ${profile.id===id?"selected":""}>${escapeHtml(profile.display_name)}</option>`).join("");
}
function partnerNormalizeAppointment(item){
  return {
    ...item,
    id:item.id || crypto.randomUUID(),
    starts_at:item.starts_at || null,
    kind:item.kind || "Follow-up",
    details:item.details || null,
    duration_minutes:Number(item.duration_minutes || 30),
    reminder_minutes:Number(item.reminder_minutes ?? 30),
    status:item.status || "scheduled",
    event_id:item.event_id || null,
    web_link:item.web_link || null,
    synced_at:item.synced_at || null
  };
}
function partnerCreateInitialCadence(record, baseValue, classification, ownerId){
  const existing = new Set(normalizeAppointments(record).map(item=>item.cadence_key).filter(Boolean));
  const conrado = partnerProfileByName("Conrado");
  return INITIAL_CADENCE
    .filter(item=>!item.classification || item.classification === classification)
    .filter(item=>!existing.has(item.key))
    .map(item=>partnerNormalizeAppointment({
      id:crypto.randomUUID(), starts_at:partnerAdjustedDate(baseValue, item.day), kind:item.title,
      details:item.objective, objective:item.objective, channel:item.channel,
      owner_id:item.strategic ? (conrado?.id || null) : (ownerId || null),
      owner_name:item.strategic ? "Conrado" : profileNameById(ownerId),
      source:"cadence_auto", cadence_key:item.key, cadence_type:"Initial 90 Days", cadence_day:item.day,
      duration_minutes:30, reminder_minutes:30, status:"scheduled"
    }));
}
function partnerNextPermanentAppointment(record, completedAt=new Date().toISOString()){
  const cadence = PERMANENT_CADENCES[record.cadence_type];
  if(!cadence?.length) return null;
  const cycle = Math.max(0, Number(record.cadence_cycle || 0));
  const item = cadence[cycle % cadence.length];
  const named = item.ownerName ? partnerProfileByName(item.ownerName) : null;
  return partnerNormalizeAppointment({
    id:crypto.randomUUID(), starts_at:partnerAdjustedDate(completedAt, item.days), kind:item.title,
    details:`Next action in the ${record.cadence_type} ongoing cadence.`, channel:item.channel,
    owner_id:named?.id || record.owner_id || null, owner_name:item.ownerName || profileNameById(record.owner_id),
    source:"cadence_auto", cadence_key:`permanent_${record.cadence_type}_${cycle+1}`,
    cadence_type:record.cadence_type, cadence_cycle:cycle+1,
    duration_minutes:30, reminder_minutes:30, status:"scheduled"
  });
}

function partnerInjectInterface(){
  const kpis = document.createElement("div");
  kpis.id = "partnerKpis";
  kpis.className = "partnerKpis";
  kpis.hidden = true;
  document.querySelector(".toolbar")?.insertAdjacentElement("afterend", kpis);

  const extraFilters = document.createElement("div");
  extraFilters.id = "partnerExtraFilters";
  extraFilters.className = "partnerExtraFilters";
  extraFilters.hidden = true;
  extraFilters.innerHTML = `
    <div class="field"><label>Classification</label><select id="fPartnerClassification"><option>All</option>${PARTNER_CLASSIFICATIONS.map(v=>`<option>${escapeHtml(v)}</option>`).join("")}</select></div>
    <div class="field"><label>Relationship level</label><select id="fRelationshipLevel"><option>All</option>${RELATIONSHIP_LEVELS.map(v=>`<option>${escapeHtml(v)}</option>`).join("")}</select></div>
    <div class="field"><label>Cadence</label><select id="fPartnerCadence"><option>All</option><option>Active</option><option>Inactive</option></select></div>
    <div class="field"><label>Opportunity</label><select id="fPartnerOpportunity"><option>All</option><option>With opportunity</option><option>No opportunity</option></select></div>
    <div class="field"><label>Follow-up</label><select id="fPartnerAttention"><option>All</option><option>No next action</option><option>Overdue contact</option><option>Dormant</option></select></div>
    <button class="primary" id="btnContentBank" type="button">Content library</button>`;
  document.querySelector(".toolbar")?.appendChild(extraFilters);
  [["fPartnerClassification","partnerClassification"],["fRelationshipLevel","relationshipLevel"],["fPartnerCadence","cadence"],["fPartnerOpportunity","opportunity"],["fPartnerAttention","attention"]].forEach(([id,key])=>{
    $(id).addEventListener("change", event=>{ filters[key]=event.target.value; render(); });
  });
  $("btnContentBank").addEventListener("click", partnerOpenContentBank);

  const form = $("form");
  form.insertAdjacentHTML("afterbegin", `<div id="partnerFormTabs" class="partnerFormTabs col-12" hidden>
    <button type="button" class="active" data-partner-form-tab="basic">Basic details</button>
    <button type="button" data-partner-form-tab="profile">Profile and potential</button>
    <button type="button" data-partner-form-tab="relationship">Relationship and schedule</button>
  </div>`);
  $("partnerFormTabs").addEventListener("click", event=>{
    const button = event.target.closest("[data-partner-form-tab]");
    if(button) partnerSelectFormTab(button.dataset.partnerFormTab);
  });

  $("wrapCompanyName").insertAdjacentHTML("afterend", `<section id="partnerProfileSection" class="partnerOnly partnerFormSection col-12" data-partner-group="profile" hidden>
    <div class="partnerSectionTitle"><div><b>Profile and potential</b><span>Information used to personalize the relationship.</span></div></div>
    <div class="partnerSectionGrid">
      <div class="col-4"><label>Partner classification</label><select id="partnerClassification">${PARTNER_CLASSIFICATIONS.map(v=>`<option>${escapeHtml(v)}</option>`).join("")}</select><div class="fieldHelp">A: strategic with clear business potential. B: promising and developing. C: early-stage relationship or limited current fit.</div></div>
      <div class="col-4"><label>Relationship level</label><select id="relationshipLevel">${RELATIONSHIP_LEVELS.map(v=>`<option>${escapeHtml(v)}</option>`).join("")}</select></div>
      <div class="col-4"><label>Partner source</label><input id="partnerOrigin" /></div>
      <div class="col-4"><label>Service area</label><input id="partnerRegion" /></div>
      <div class="col-4"><label>First visit date</label><input id="firstVisitAt" type="date" /></div>
      <div class="col-4"><label>Typical client investment profile</label><input id="partnerClientProfile" /></div>
      <div class="col-6"><label>Typical project profile</label><textarea id="partnerProjectProfile"></textarea></div>
      <div class="col-6"><label>Primary design style</label><input id="preferredStyles" placeholder="Separate with commas" /></div>
      <div class="col-6"><label>Commonly specified rooms / spaces</label><input id="preferredEnvironments" placeholder="Separate with commas" /></div>
      <div class="col-6"><label>Current brands or suppliers</label><textarea id="currentSuppliers"></textarea></div>
      <div class="col-6"><label>What the partner values most about Marel</label><textarea id="valuedDifferentials"></textarea></div>
      <div class="col-6"><label>Observed objections or concerns</label><textarea id="partnerObjections"></textarea></div>
      <div class="col-12"><label>Projects mentioned</label><textarea id="mentionedProjects"></textarea></div>
      <div class="col-12"><label>Preferred interests and topics</label><div class="tagPicker" id="partnerInterestTags">${PARTNER_INTEREST_TAGS.map(tag=>`<label><input type="checkbox" value="${escapeHtml(tag)}" /> ${escapeHtml(tag)}</label>`).join("")}</div></div>
    </div>
  </section>
  <section id="partnerRelationshipSection" class="partnerOnly partnerFormSection col-12" data-partner-group="relationship" hidden>
    <div class="partnerSectionTitle"><div><b>Relationship cadence</b><span>The partner keeps one primary relationship owner.</span></div></div>
    <div class="partnerSectionGrid">
      <div class="col-3"><label>Active cadence</label><select id="cadenceActive"><option value="false">Inactive</option><option value="true">Active</option></select></div>
      <div class="col-3"><label>Cadence type</label><select id="cadenceType"><option>Manual</option><option>Initial 90 Days</option><option>Strategic</option><option>Potential</option><option>Relationship</option></select></div>
      <div class="col-3"><label>Start date</label><input id="cadenceStartedAt" type="date" /></div>
      <div class="col-3"><label>Next-action owner</label><select id="nextActionOwner"></select></div>
      <div class="col-12 cadenceActivation" id="cadenceActivation" hidden><label><input id="activateInitialCadence" type="checkbox" checked /> Activate the initial 90-day relationship cadence when saving</label></div>
      <div class="col-12"><div class="timelineHeader"><b>Timeline</b><select id="timelineFilter"><option value="all">All</option><option value="contacts">Contacts</option><option value="appointments">Appointments</option><option value="contents">Content</option><option value="stages">Stages</option><option value="opportunities">Opportunities</option></select></div><div id="partnerTimeline" class="partnerTimeline"></div></div>
    </div>
  </section>`);
  $("timelineFilter").addEventListener("change", ()=>partnerRenderTimeline(records.find(r=>r.id===$("id").value)));

  const direct = Array.from(form.children);
  const basicIds = new Set(["firstName","lastName","phone","city","owner","stage","wrapSpecifierType","wrapCompanyName","email","notes"]);
  direct.forEach(child=>{
    const ownId = child.id;
    const containsBasic = ownId && basicIds.has(ownId) || Array.from(child.querySelectorAll("[id]")).some(node=>basicIds.has(node.id));
    if(containsBasic) child.dataset.partnerGroup = "basic";
  });
  $("appointmentComposer").dataset.partnerGroup = "relationship";

  document.body.insertAdjacentHTML("beforeend", partnerDialogsMarkup());
  partnerBindDialogs();
}

function partnerDialogsMarkup(){
  return `<dialog id="contactModal" class="partnerDialog"><div class="modalHd"><div><div class="modalTitle">Log activity</div><div class="modalSub" id="contactPartnerName"></div></div><button class="ghost" type="button" id="btnCloseContact">Close</button></div>
    <div class="modalBd"><form class="form" id="contactForm">
      <div class="col-4"><label>Date and time</label><input id="contactAt" type="datetime-local" /></div>
      <div class="col-4"><label>Owner</label><select id="contactOwner"></select></div>
      <div class="col-4"><label>Channel</label><select id="contactChannel">${CONTACT_CHANNELS.map(v=>`<option>${escapeHtml(v)}</option>`).join("")}</select></div>
      <div class="col-4"><label>Activity type</label><input id="contactType" placeholder="Example: follow-up or prospecting" /></div>
      <div class="col-4"><label>Result</label><select id="contactResult">${CONTACT_RESULTS.map(v=>`<option>${escapeHtml(v)}</option>`).join("")}</select></div>
      <div class="col-4"><label>Related appointment</label><select id="relatedAppointment"><option value="">None</option></select></div>
      <div class="col-6"><label>Objective</label><textarea id="contactObjective"></textarea></div>
      <div class="col-6"><label>Activity summary</label><textarea id="contactSummary" required></textarea></div>
      <div class="col-6"><label>Project mentioned</label><textarea id="contactProject"></textarea></div>
      <div class="col-6"><label>Content sent</label><select id="contactContent"><option value="">None</option></select><div id="contentSuggestions" class="fieldHelp"></div></div>
      <div class="col-4"><label>Next action</label><input id="contactNextAction" /></div>
      <div class="col-4"><label>Next-action date</label><input id="contactNextAt" type="datetime-local" /></div>
      <div class="col-4"><label>Next-action owner</label><select id="contactNextOwner"></select></div>
    </form></div><div class="modalFt"><div class="note">Saving updates the timeline and last-contact date.</div><div class="modalQuick"><button class="ghost" type="button" id="btnCancelContact">Cancel</button><button class="primary" type="button" id="btnSaveContact">Save activity</button></div></div></dialog>

  <dialog id="contentBankModal" class="contentBankDialog"><div class="modalHd"><div><div class="modalTitle">Content library</div><div class="modalSub">Marel references for professional partner relationships.</div></div><button class="ghost" type="button" id="btnCloseContentBank">Close</button></div>
    <div class="modalBd contentBankLayout"><form id="contentForm" class="contentEditor"><input id="contentId" type="hidden" /><label>Title</label><input id="contentTitle" required /><label>Pillar</label><select id="contentPillar">${CONTENT_PILLARS.map(v=>`<option>${escapeHtml(v)}</option>`).join("")}</select><label>Format</label><select id="contentFormat">${CONTENT_FORMATS.map(v=>`<option>${escapeHtml(v)}</option>`).join("")}</select><label>Description</label><textarea id="contentDescription"></textarea><label>External link</label><input id="contentUrl" type="url" placeholder="Google Drive, website, Instagram, YouTube, or catalog" /><label>Tags</label><input id="contentTags" placeholder="Separate with commas" /><label>Status</label><select id="contentStatus"><option>Active</option><option>Archived</option></select><label>Internal notes</label><textarea id="contentNotes"></textarea><button class="primary" type="button" id="btnSaveContent">Save content</button><button class="ghost" type="button" id="btnNewContent">Clear form</button></form><div><div class="contentListTools"><input id="contentSearch" placeholder="Search content or tags" /><select id="contentStatusFilter"><option>Active</option><option>Archived</option><option>All</option></select></div><div id="contentList" class="contentList"></div></div></div></dialog>

  <dialog id="nextActionWarning" class="smallDecisionDialog"><div class="modalHd"><div class="modalTitle">Next action required</div></div><div class="modalBd"><p>This partner will have no scheduled follow-up. Save anyway?</p><div id="nextActionReasonWrap" hidden><label>Reason</label><textarea id="nextActionReason"></textarea></div></div><div class="modalFt"><button class="ghost" type="button" data-next-decision="cancel">Cancel</button><button class="ghost" type="button" data-next-decision="create">Create next action</button><button class="danger" type="button" data-next-decision="justify">Save with reason</button></div></dialog>`;
}

function partnerBindDialogs(){
  $("btnCloseContact").addEventListener("click", ()=>$("contactModal").close());
  $("btnCancelContact").addEventListener("click", ()=>$("contactModal").close());
  $("btnSaveContact").addEventListener("click", partnerSaveContact);
  $("btnCloseContentBank").addEventListener("click", ()=>$("contentBankModal").close());
  $("btnSaveContent").addEventListener("click", partnerSaveContent);
  $("btnNewContent").addEventListener("click", partnerClearContentForm);
  $("contentSearch").addEventListener("input", partnerRenderContents);
  $("contentStatusFilter").addEventListener("change", partnerRenderContents);
  $("contentList").addEventListener("click", event=>{
    const button = event.target.closest("[data-content-edit]");
    if(button) partnerEditContent(button.dataset.contentEdit);
  });
}

function partnerSelectFormTab(tab){
  $("partnerFormTabs").querySelectorAll("button").forEach(button=>button.classList.toggle("active", button.dataset.partnerFormTab===tab));
  $("form").querySelectorAll("[data-partner-group]").forEach(section=>{ section.hidden = section.dataset.partnerGroup !== tab; });
}
function partnerSelectedTags(){ return Array.from($("partnerInterestTags").querySelectorAll("input:checked")).map(input=>input.value); }
function partnerSetSelectedTags(tags){
  const selected = new Set(Array.isArray(tags) ? tags : []);
  $("partnerInterestTags").querySelectorAll("input").forEach(input=>{ input.checked = selected.has(input.value); });
}
function partnerPopulateFields(record){
  $("partnerClassification").value = PARTNER_CLASSIFICATIONS.includes(record?.partner_classification) ? record.partner_classification : "Unclassified";
  $("relationshipLevel").value = RELATIONSHIP_LEVELS.includes(record?.relationship_level) ? record.relationship_level : "New";
  $("partnerOrigin").value = record?.partner_origin || "";
  $("partnerRegion").value = record?.region || "";
  $("firstVisitAt").value = record?.first_visit_at ? inputDateValue(new Date(record.first_visit_at)) : "";
  $("partnerClientProfile").value = record?.client_profile || "";
  $("partnerProjectProfile").value = record?.project_profile || "";
  $("preferredStyles").value = (record?.preferred_styles || []).join(", ");
  $("preferredEnvironments").value = (record?.preferred_environments || []).join(", ");
  $("currentSuppliers").value = record?.current_suppliers || "";
  $("valuedDifferentials").value = record?.valued_differentials || "";
  $("partnerObjections").value = record?.objections || "";
  $("mentionedProjects").value = record?.mentioned_projects || "";
  partnerSetSelectedTags(record?.interest_tags || []);
  $("cadenceActive").value = String(Boolean(record?.cadence_active));
  $("cadenceType").value = ["Manual","Initial 90 Days","Strategic","Potential","Relationship"].includes(record?.cadence_type) ? record.cadence_type : "Manual";
  $("cadenceStartedAt").value = record?.cadence_started_at ? inputDateValue(new Date(record.cadence_started_at)) : "";
  $("nextActionOwner").innerHTML = partnerOwnerOption(record?.next_action_owner || record?.owner_id || session?.user?.id);
  $("activateInitialCadence").checked = true;
  partnerUpdateCadenceActivation(record);
  partnerRenderTimeline(record);
}
function partnerUpdateCadenceActivation(record=null){
  const shouldOffer = $("recordType").value === "specifier" && $("stage").value === "Intro Meeting" && !record?.cadence_active;
  $("cadenceActivation").hidden = !shouldOffer;
  if(shouldOffer && !$("firstVisitAt").value) $("firstVisitAt").value = inputDateValue(new Date());
}
function partnerFormPayload(existing){
  return {
    partner_classification:$("partnerClassification").value,
    relationship_level:$("relationshipLevel").value,
    first_visit_at:$("firstVisitAt").value ? localScheduleIso($("firstVisitAt").value, "12:00") : null,
    region:$("partnerRegion").value.trim() || null,
    project_profile:$("partnerProjectProfile").value.trim() || null,
    client_profile:$("partnerClientProfile").value.trim() || null,
    preferred_styles:partnerCsv($("preferredStyles").value),
    preferred_environments:partnerCsv($("preferredEnvironments").value),
    current_suppliers:$("currentSuppliers").value.trim() || null,
    valued_differentials:$("valuedDifferentials").value.trim() || null,
    objections:$("partnerObjections").value.trim() || null,
    mentioned_projects:$("mentionedProjects").value.trim() || null,
    interest_tags:partnerSelectedTags(),
    partner_origin:$("partnerOrigin").value.trim() || null,
    cadence_type:$("cadenceType").value,
    cadence_active:$("cadenceActive").value === "true",
    cadence_started_at:$("cadenceStartedAt").value ? localScheduleIso($("cadenceStartedAt").value, "12:00") : null,
    next_action_owner:$("nextActionOwner").value || existing?.owner_id || null,
    no_next_action_reason:existing?.no_next_action_reason || null
  };
}

function partnerAskNoNextAction(){
  return new Promise(resolve=>{
    const dialog = $("nextActionWarning");
    $("nextActionReasonWrap").hidden = true;
    $("nextActionReason").value = "";
    const handler = event=>{
      const button = event.target.closest("[data-next-decision]");
      if(!button) return;
      const decision = button.dataset.nextDecision;
      if(decision === "justify" && $("nextActionReasonWrap").hidden){
        $("nextActionReasonWrap").hidden = false;
        $("nextActionReason").focus();
        return;
      }
      if(decision === "justify" && !$("nextActionReason").value.trim()) return toast("Enter a reason.");
      dialog.removeEventListener("click", handler);
      dialog.close();
      resolve({decision, reason:$("nextActionReason").value.trim()});
    };
    dialog.addEventListener("click", handler);
    dialog.showModal();
  });
}

function partnerTimelineItems(record){
  if(!record) return [];
  const items = [];
  recordEvents.filter(event=>event.record_id===record.id).forEach(event=>items.push({
    at:event.occurred_at, type:event.event_type, title:({created:"Record created",stage_changed:"Stage changed",followup_scheduled:"Appointment created",contact_logged:"Activity logged",classification_changed:"Classification changed",relationship_changed:"Relationship level changed",cadence_activated:"Cadence activated",cadence_paused:"Cadence paused",owner_changed:"Owner changed"})[event.event_type] || event.event_type,
    detail:event.to_value || ""
  }));
  (record.interactions || []).forEach(item=>items.push({at:item.at, type:item.result==="Opportunity Identified"?"opportunity":item.result==="Project Referred"?"project_received":"contact_logged", title:`${item.result || "Activity"} • ${item.channel || ""}`, detail:item.summary || item.objective || ""}));
  (record.sent_contents || []).forEach(item=>items.push({at:item.sent_at, type:"content_sent", title:`Content sent • ${item.title || "Content"}`, detail:item.notes || item.channel || ""}));
  normalizeAppointments(record).forEach(item=>items.push({at:item.completed_at || item.starts_at, type:item.status==="completed"?"appointment_completed":"followup_scheduled", title:`${item.status==="completed"?"Appointment completed":"Appointment"} • ${item.kind}`, detail:item.details || ""}));
  return items.filter(item=>item.at).sort((a,b)=>new Date(b.at)-new Date(a.at));
}
function partnerRenderTimeline(record){
  if(!$("partnerTimeline")) return;
  const filter = $("timelineFilter").value;
  const groups = {contacts:["contact_logged"],appointments:["followup_scheduled","appointment_completed"],contents:["content_sent"],stages:["stage_changed"],opportunities:["opportunity","project_received"]};
  const items = partnerTimelineItems(record).filter(item=>filter==="all" || (groups[filter] || []).includes(item.type));
  $("partnerTimeline").innerHTML = items.length ? items.slice(0,100).map(item=>`<div class="timelineItem"><time>${escapeHtml(fmtBRDateTime(item.at))}</time><div><b>${escapeHtml(item.title)}</b>${item.detail?`<p>${escapeHtml(item.detail)}</p>`:""}</div></div>`).join("") : `<div class="empty">The timeline will appear as relationship activity is logged.</div>`;
}

const baseNormalizeAppointments = normalizeAppointments;
normalizeAppointments = function(record){
  return baseNormalizeAppointments(record).map((item,index)=>partnerNormalizeAppointment({...(Array.isArray(record?.appointments) ? record.appointments[index] : {}), ...item}));
};
const baseOpenModal = openModal;
openModal = function(record=null, options={}){
  baseOpenModal(record, options);
  const specifier = $("recordType").value === "specifier";
  $("partnerFormTabs").hidden = !specifier;
  document.querySelectorAll(".partnerOnly").forEach(section=>section.hidden = true);
  if(specifier){
    $("modalTitle").textContent = record ? "Partner details" : "New partner";
    document.querySelector(".appointmentComposerTitle").textContent = "Relationship schedule";
    partnerPopulateFields(record);
    partnerSelectFormTab(options.focusSchedule ? "relationship" : "basic");
  }else{
    $("form").querySelectorAll("[data-partner-group]:not(.partnerOnly)").forEach(section=>section.hidden=false);
    document.querySelector(".appointmentComposerTitle").textContent = "Customer appointments";
  }
};
const baseUpdateModalMode = updateModalMode;
updateModalMode = function(kind){
  baseUpdateModalMode(kind);
  const specifier = kind === "specifier";
  $("partnerFormTabs").hidden = !specifier;
  if(!specifier){
    document.querySelectorAll(".partnerOnly").forEach(section=>section.hidden=true);
    $("form").querySelectorAll("[data-partner-group]:not(.partnerOnly)").forEach(section=>section.hidden=false);
  }
};
$("stage").addEventListener("change", ()=>partnerUpdateCadenceActivation(records.find(record=>record.id===$("id").value)));

const baseUpsertFromForm = upsertFromForm;
upsertFromForm = async function(){
  if($("recordType").value !== "specifier") return baseUpsertFromForm();
  const existing = records.find(record=>record.id===$("id").value) || null;
  if($("nextAction").value) addAppointmentFromComposer({silent:true});
  const shouldActivate = $("stage").value === "Intro Meeting" && $("activateInitialCadence").checked && !existing?.cadence_active;
  if(shouldActivate){
    const baseDate = $("firstVisitAt").value ? localScheduleIso($("firstVisitAt").value, "12:00") : nowISO();
    appointmentDrafts.push(...partnerCreateInitialCadence({...(existing||{}), appointments:appointmentDrafts}, baseDate, $("partnerClassification").value, $("owner").value));
    $("cadenceActive").value = "true";
    $("cadenceType").value = "Initial 90 Days";
    $("cadenceStartedAt").value = inputDateValue(new Date(baseDate));
  }
  if(!shouldActivate && $("cadenceActive").value === "true" && $("cadenceType").value === "Initial 90 Days" && $("partnerClassification").value === "A — Strategic"){
    const start = $("cadenceStartedAt").value ? localScheduleIso($("cadenceStartedAt").value, "12:00") : (existing?.cadence_started_at || existing?.first_visit_at || nowISO());
    appointmentDrafts.push(...partnerCreateInitialCadence({...(existing||{}),appointments:appointmentDrafts}, start, "A — Strategic", $("owner").value));
  }
  if($("cadenceActive").value === "true" && PERMANENT_CADENCES[$("cadenceType").value] && !appointmentDrafts.some(item=>item.status==="scheduled" && item.starts_at)){
    const cadenceRecord = {...(existing||{}),cadence_type:$("cadenceType").value,owner_id:$("owner").value,cadence_cycle:Number(existing?.cadence_cycle||0)};
    const nextPermanent = partnerNextPermanentAppointment(cadenceRecord, nowISO());
    if(nextPermanent) appointmentDrafts.push(nextPermanent);
  }
  const hasScheduled = appointmentDrafts.some(item=>item.status==="scheduled" && item.starts_at);
  let reason = existing?.no_next_action_reason || null;
  if(partnerNeedsNextAction({stage:$("stage").value}) && !hasScheduled){
    const decision = await partnerAskNoNextAction();
    if(decision.decision === "cancel") return false;
    if(decision.decision === "create"){
      partnerSelectFormTab("relationship");
      $("nextAction").focus();
      return false;
    }
    reason = decision.reason;
  }
  if(!(await baseUpsertFromForm())) return false;
  const id = $("id").value;
  const payload = partnerFormPayload(existing);
  payload.no_next_action_reason = hasScheduled ? null : reason;
  if(shouldActivate){
    payload.cadence_active = true;
    payload.cadence_type = "Initial 90 Days";
    payload.cadence_started_at = payload.first_visit_at || nowISO();
    payload.cadence_cycle = 1;
    payload.cadence_history = [...(existing?.cadence_history || []), {at:nowISO(), action:"activated", type:"Initial 90 Days", actor_id:session.user.id}];
  }
  try{
    const current=records.find(record=>record.id===id) || existing;
    const data=await crmData.updateRecord(current,payload);
    const index=records.findIndex(record=>record.id===id);
    if(index>=0 && data) records[index]=data;
    return true;
  }catch(error){
    console.error("[CRM Professional Partners] Could not save relationship fields.",error);
    toast("The core partner was saved, but some relationship fields could not be updated.");
    return false;
  }
};

const baseDatasetForTab = datasetForTab;
datasetForTab = function(){
  let data = baseDatasetForTab();
  if(currentTab !== "specifiers") return data;
  const legacyStages = {"Primeiro Contato":"Initial Outreach","Partner Ativo":"Active Referral Partner","Pausado":"Dormant"};
  data.forEach(record=>{ if(legacyStages[record.stage]) record.stage = legacyStages[record.stage]; });
  if(filters.partnerClassification!=="All") data=data.filter(r=>(r.partner_classification||"Unclassified")===filters.partnerClassification);
  if(filters.relationshipLevel!=="All") data=data.filter(r=>(r.relationship_level||"New")===filters.relationshipLevel);
  if(filters.cadence!=="All") data=data.filter(r=>Boolean(r.cadence_active)===(filters.cadence==="Active"));
  if(filters.opportunity!=="All") data=data.filter(r=>partnerHasOpportunity(r)===(filters.opportunity==="With opportunity"));
  if(filters.attention==="No next action") data=data.filter(r=>!getNextActionAt(r));
  if(filters.attention==="Overdue contact") data=data.filter(r=>{const d=getNextActionAt(r);return d && d<new Date();});
  if(filters.attention==="Dormant") data=data.filter(r=>r.stage==="Dormant");
  return data;
};

const baseRenderKPIs = renderKPIs;
renderKPIs = function(scope){
  baseRenderKPIs(scope);
  if(currentTab!=="specifiers"){ $("partnerKpis").hidden=true; return; }
  const now = new Date();
  const metrics = [
    ["Total in view",scope.length],
    ["Overdue contacts",scope.filter(r=>{const d=getNextActionAt(r);return d&&d<now;}).length],
    ["Next actions in 7 days",scope.filter(r=>{const d=getNextActionAt(r);return d&&d>=now&&(d-now)<=7*86400000;}).length],
    ["No next action",scope.filter(r=>!getNextActionAt(r)).length],
    ["Qualified partners",scope.filter(r=>r.stage==="Qualified Partner").length],
    ["Active referral partners",scope.filter(r=>r.stage==="Active Referral Partner").length],
    ["Strategic partners",scope.filter(r=>r.stage==="Strategic Partner").length],
    ["Recurring relationships",scope.filter(r=>r.relationship_level==="Recurring").length]
  ];
  $("partnerKpis").hidden=false;
  $("partnerKpis").innerHTML=metrics.map(([label,value])=>`<div class="kpi"><div class="n">${value}</div><div class="t">${escapeHtml(label)}</div></div>`).join("");
};

const baseRenderCard = renderCard;
renderCard = function(record){
  if(!isSpecifier(record)) return baseRenderCard(record);
  const next = getNextActionAt(record);
  const days = partnerDaysWithoutContact(record);
  const classification = record.partner_classification || "Unclassified";
  const level = record.relationship_level || "New";
  const schedule = scheduleStatus(record);
  const opportunity = partnerHasOpportunity(record);
  return `<div class="card partnerCard ${stageClass(record.stage||"Identified")} grab" draggable="${isMobileLayout()?"false":"true"}" data-id="${escapeHtml(record.id)}">
    <div class="cTop"><div><div class="cName">${escapeHtml(fullName(record))}</div><div class="partnerCompany">${escapeHtml(record.company_name||"Company not provided")}</div></div><div class="rightTop"><span class="badge classificationBadge ${classification.startsWith("A")?"classA":classification.startsWith("B")?"classB":classification.startsWith("C")?"classC":""}">${escapeHtml(classification)}</span><button class="dots" type="button" data-menu-btn="${escapeHtml(record.id)}">...</button></div></div>
    <div class="row"><span class="chip">${escapeHtml(record.specifier_type||"Partner")}</span><span class="chip muted">${escapeHtml(record.city||"City —")}</span><span class="chip muted">${escapeHtml(profileNameById(record.owner_id))}</span></div>
    <div class="partnerStatusRow"><span>${escapeHtml(level)}</span><span>${days===null?"No contact logged":`${days} day(s) since contact`}</span></div>
    <div class="meta">Last contact: <b>${escapeHtml(fmtBRDate(record.last_contact_at))}</b>${next?` • Next: <b>${escapeHtml(fmtBRDateTime(next.toISOString()))}</b>`:""}</div>
    <div class="partnerSignals">${record.cadence_active?`<span title="Active cadence">Active cadence</span>`:""}${opportunity?`<span title="Opportunity">${record.stage==="Active Referral Partner"?"Active referral":"Opportunity"}</span>`:""}${!next?`<span class="signalWarn">No next action</span>`:""}${days>14?`<span class="signalWarn">14+ days without contact</span>`:""}</div>
    <div class="scheduleState ${schedule.kind}">${escapeHtml(schedule.label)}</div>
    <div class="menu" data-menu="${escapeHtml(record.id)}"><button type="button" data-act="edit" data-id="${escapeHtml(record.id)}">Open partner</button><button type="button" data-act="logContact" data-id="${escapeHtml(record.id)}">Log activity</button><button type="button" data-act="schedule" data-id="${escapeHtml(record.id)}">Create appointment</button></div>
  </div>`;
};

const baseBuildFilters = buildFilters;
buildFilters = function(){
  baseBuildFilters();
  if($("partnerExtraFilters")) $("partnerExtraFilters").hidden = currentTab!=="specifiers";
};
const baseSetTab = setTab;
setTab = function(tab){
  baseSetTab(tab);
  if($("partnerExtraFilters")) $("partnerExtraFilters").hidden = tab!=="specifiers";
  if(tab==="specifiers"){
    $("btnNew").textContent = "+ New partner";
    $("boardHint").innerHTML = `<div>Every active partner relationship should have a scheduled next action.</div><div></div>`;
  }
};

const baseMoveRecordToStage = moveRecordToStage;
moveRecordToStage = async function(id, stage){
  const record = records.find(item=>item.id===id);
  if(!record || !isSpecifier(record) || stage!=="Intro Meeting" || record.cadence_active) return baseMoveRecordToStage(id, stage);
  const activate = confirm("Activate the initial 90-day relationship cadence?\n\nOK: activate • Cancel: move without activating");
  if(!activate) return baseMoveRecordToStage(id, stage);
  const baseDate = nowISO();
  const appointments = [...normalizeAppointments(record), ...partnerCreateInitialCadence(record, baseDate, record.partner_classification || "Unclassified", record.owner_id)];
  const active = appointments.filter(item=>item.status==="scheduled").sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  const first = active[0] || null;
  const patch = {stage,stage_entered_at:nowISO(),first_visit_at:record.first_visit_at||baseDate,cadence_active:true,cadence_type:"Initial 90 Days",cadence_started_at:baseDate,cadence_cycle:1,appointments,next_action_at:first?.starts_at||null,next_action:first?inputDateValue(new Date(first.starts_at)):null,next_action_kind:first?.kind||null,next_action_details:first?.details||null,cadence_history:[...(record.cadence_history||[]),{at:nowISO(),action:"activated",type:"Initial 90 Days",actor_id:session.user.id}]};
  try{ await crmData.updateRecord(record,patch); }
  catch(error){console.error(error);return toast("Could not activate the local follow-up cadence.");}
  await fetchRecords({reason:"initial cadence",notifyNew:false});
  render();
  toast("Meeting logged and the 90-day cadence activated.");
};

const baseRegisterContactNow = registerContactNow;
registerContactNow = async function(record){
  if(!record || !session?.user) return toast("Not signed in.");
  if(!isSpecifier(record)) return baseRegisterContactNow(record);
  await partnerFetchContents();
  $("contactModal").dataset.recordId = record.id;
  $("contactPartnerName").textContent = fullName(record);
  $("contactAt").value = partnerLocalDateTimeValue();
  $("contactOwner").innerHTML = partnerOwnerOption(record.owner_id || session.user.id);
  $("contactChannel").value = "Email";
  $("contactType").value = ""; $("contactObjective").value = ""; $("contactSummary").value = ""; $("contactProject").value = "";
  $("contactResult").value = "Conversation Completed";
  $("contactNextAction").value = ""; $("contactNextAt").value = "";
  $("contactNextOwner").innerHTML = partnerOwnerOption(record.next_action_owner || record.owner_id || session.user.id);
  const scheduled = scheduledAppointments(record);
  $("relatedAppointment").innerHTML = `<option value="">None</option>` + scheduled.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.kind)} • ${escapeHtml(fmtBRDateTime(item.starts_at))}</option>`).join("");
  const sent = new Set((record.sent_contents||[]).map(item=>item.content_id));
  const options = partnerContents.filter(item=>item.status==="Active");
  $("contactContent").innerHTML = `<option value="">None</option>` + options.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
  const tags = new Set(record.interest_tags || []);
  const suggestions = options.filter(item=>!sent.has(item.id) && (item.tags||[]).some(tag=>tags.has(tag))).slice(0,4);
  $("contentSuggestions").textContent = suggestions.length ? `Suggested unsent content: ${suggestions.map(item=>item.title).join(" • ")}` : "No new suggestions for the selected interests.";
  $("contactModal").showModal();
};

async function partnerSaveContact(){
  const record = records.find(item=>item.id===$("contactModal").dataset.recordId);
  if(!record) return;
  const summary = $("contactSummary").value.trim();
  if(!summary) return toast("Enter an activity summary.");
  const at = new Date($("contactAt").value).toISOString();
  const result = $("contactResult").value;
  let appointments = normalizeAppointments(record);
  const relatedId = $("relatedAppointment").value;
  if(relatedId) appointments = appointments.map(item=>item.id===relatedId?{...item,status:"completed",completed_at:at,completed_by:session.user.id}:item);
  if($("contactNextAt").value){
    appointments.push(partnerNormalizeAppointment({id:crypto.randomUUID(),starts_at:new Date($("contactNextAt").value).toISOString(),kind:$("contactNextAction").value.trim()||"Follow-Up",details:`Created after activity: ${summary}`,owner_id:$("contactNextOwner").value||record.owner_id,status:"scheduled",source:"contact_log"}));
  }else if(relatedId && record.cadence_active && PERMANENT_CADENCES[record.cadence_type]){
    const next = partnerNextPermanentAppointment(record, at);
    if(next) appointments.push(next);
  }
  const scheduled = appointments.filter(item=>item.status==="scheduled"&&item.starts_at).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  let reason = null;
  if(partnerNeedsNextAction(record) && !scheduled.length){
    const decision = await partnerAskNoNextAction();
    if(decision.decision==="cancel") return;
    if(decision.decision==="create"){ $("contactNextAt").focus(); return; }
    reason = decision.reason;
  }
  const interaction = {id:crypto.randomUUID(),at,owner_id:$("contactOwner").value,channel:$("contactChannel").value,type:$("contactType").value.trim()||"Activity",objective:$("contactObjective").value.trim()||null,summary,result,project:$("contactProject").value.trim()||null,content_id:$("contactContent").value||null,next_action:$("contactNextAction").value.trim()||null,next_action_at:$("contactNextAt").value?new Date($("contactNextAt").value).toISOString():null};
  const selectedContent = partnerContents.find(item=>item.id===$("contactContent").value);
  const sentContents = [...(record.sent_contents||[])];
  if(selectedContent) sentContents.push({id:crypto.randomUUID(),content_id:selectedContent.id,title:selectedContent.title,sent_at:at,responsible_id:$("contactOwner").value,channel:$("contactChannel").value,notes:summary});
  const stageSuggestion = {"Meeting Scheduled":"Intro Meeting","Opportunity Identified":"Qualified Partner","Project Referred":"Active Referral Partner"}[result];
  let stage = record.stage;
  if(stageSuggestion && stageSuggestion!==stage && confirm(`This result suggests moving the partner to “${stageSuggestion}.” Change the stage?`)) stage=stageSuggestion;
  const first = scheduled.find(item=>new Date(item.starts_at)>=new Date()) || scheduled[0] || null;
  const payload = {interactions:[...(record.interactions||[]),interaction],sent_contents:sentContents,last_contact_at:at,appointments,stage,stage_entered_at:stage!==record.stage?nowISO():record.stage_entered_at,next_action_at:first?.starts_at||null,next_action:first?inputDateValue(new Date(first.starts_at)):null,next_action_kind:first?.kind||null,next_action_details:first?.details||null,next_action_owner:first?.owner_id||record.owner_id,no_next_action_reason:first?null:reason,owner_id:$("contactOwner").value||record.owner_id};
  if(relatedId && PERMANENT_CADENCES[record.cadence_type]) payload.cadence_cycle=Number(record.cadence_cycle||0)+1;
  try{
    const data=await crmData.updateRecord(record,payload);
    await crmData.createActivity(record,{kind:"phone_call",subject:$('contactType').value.trim()||"Partner activity",details:summary,outcome:result,occurred_at:at});
    records[records.findIndex(item=>item.id===record.id)] = data;
  }catch(error){console.error(error);return toast("Could not log activity.");}
  await fetchRecordEvents();
  $("contactModal").close();
  if($("modal").open) closeModal();
  render();
  toast("Activity logged and follow-up updated.");
}

async function partnerFetchContents(){
  if(!session?.user) return [];
  try{ partnerContents=await crmData.listPartnerContents(); }
  catch(error){ console.warn("[CRM Professional Partners] Content library unavailable.",error);partnerContents=[]; }
  return partnerContents;
}
async function partnerOpenContentBank(){
  await partnerFetchContents();
  partnerClearContentForm(); partnerRenderContents(); $("contentBankModal").showModal();
}
function partnerClearContentForm(){
  $("contentId").value=""; $("contentTitle").value=""; $("contentDescription").value=""; $("contentUrl").value=""; $("contentTags").value=""; $("contentNotes").value=""; $("contentStatus").value="Active"; $("contentPillar").value=CONTENT_PILLARS[0]; $("contentFormat").value=CONTENT_FORMATS[0];
}
function partnerRenderContents(){
  const query=($("contentSearch").value||"").toLowerCase(); const status=$("contentStatusFilter").value;
  const data=partnerContents.filter(item=>(status==="All"||item.status===status)&&[item.title,item.description,...(item.tags||[])].join(" ").toLowerCase().includes(query));
  $("contentList").innerHTML=data.length?data.map(item=>`<article class="contentCard"><div><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.pillar)} • ${escapeHtml(item.format)} • ${escapeHtml(item.status)}</span></div>${item.description?`<p>${escapeHtml(item.description)}</p>`:""}<div class="row">${(item.tags||[]).map(tag=>`<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div><div class="contentCardActions">${item.external_url?`<a class="btn" href="${escapeHtml(item.external_url)}" target="_blank" rel="noopener noreferrer">Open link</a>`:""}<button class="ghost" type="button" data-content-edit="${escapeHtml(item.id)}">Edit</button></div></article>`).join(""):`<div class="empty">No content matches this filter. Apply the current database migration if the library is unavailable.</div>`;
}
function partnerEditContent(id){
  const item=partnerContents.find(content=>content.id===id); if(!item)return;
  $("contentId").value=item.id; $("contentTitle").value=item.title||""; $("contentPillar").value=item.pillar; $("contentFormat").value=item.format; $("contentDescription").value=item.description||""; $("contentUrl").value=item.external_url||""; $("contentTags").value=(item.tags||[]).join(", "); $("contentStatus").value=item.status; $("contentNotes").value=item.notes||"";
}
async function partnerSaveContent(){
  const title=$("contentTitle").value.trim(); if(!title)return toast("Enter a content title.");
  const payload={title,pillar:$("contentPillar").value,format:$("contentFormat").value,description:$("contentDescription").value.trim()||null,external_url:$("contentUrl").value.trim()||null,tags:partnerCsv($("contentTags").value),status:$("contentStatus").value,notes:$("contentNotes").value.trim()||null,created_by:session.user.id};
  payload.id=$("contentId").value||undefined;
  try{ await crmData.savePartnerContent(payload); }
  catch(error){console.warn(error);return toast("Content library editing is outside the Phase 3 normalized adapter.");}
  await partnerFetchContents(); partnerClearContentForm(); partnerRenderContents(); toast("Content saved.");
}

const baseRenderReports = renderReports;
renderReports = function(){
  const base = baseRenderReports();
  const partners = records.filter(isSpecifier);
  const interactions = partners.flatMap(record=>(record.interactions||[]).map(item=>({...item,record})));
  const scheduled = partners.flatMap(record=>normalizeAppointments(record));
  const completed = scheduled.filter(item=>item.status==="completed");
  const sent = partners.flatMap(record=>record.sent_contents||[]);
  const countBy = (values,key)=>Object.entries(values.reduce((acc,item)=>{const label=key(item)||"Not provided";acc[label]=(acc[label]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]);
  const stageRows=countBy(partners,r=>r.stage).map(([label,value])=>`<div class="reportRow"><span>${escapeHtml(label)}</span><b>${value}</b></div>`).join("");
  const classRows=countBy(partners,r=>r.partner_classification||"Unclassified").map(([label,value])=>`<div class="reportRow"><span>${escapeHtml(label)}</span><b>${value}</b></div>`).join("");
  const contentRows=countBy(sent,item=>item.title).slice(0,8).map(([label,value])=>`<div class="reportRow"><span>${escapeHtml(label)}</span><b>${value}</b></div>`).join("")||`<div class="empty">No content activity logged.</div>`;
  const channelRows=countBy(interactions,item=>item.channel).map(([label,value])=>`<div class="reportRow"><span>${escapeHtml(label)}</span><b>${value}</b></div>`).join("")||`<div class="empty">No detailed activity logged.</div>`;
  const metrics=[["Professional partners",partners.length],["No next action",partners.filter(r=>!getNextActionAt(r)).length],["Scheduled actions",scheduled.filter(i=>i.status==="scheduled").length],["Completed actions",completed.length],["Completion rate",scheduled.length?`${Math.round(completed.length/scheduled.length*100)}%`:"—"],["14+ days without contact",partners.filter(r=>partnerDaysWithoutContact(r)>14).length],["30+ days without contact",partners.filter(r=>partnerDaysWithoutContact(r)>30).length],["60+ days without contact",partners.filter(r=>partnerDaysWithoutContact(r)>60).length],["Qualified partners",partners.filter(r=>r.stage==="Qualified Partner").length],["Active referral partners",partners.filter(r=>r.stage==="Active Referral Partner").length],["Strategic partners",partners.filter(r=>r.stage==="Strategic Partner").length],["Recurring relationships",partners.filter(r=>r.relationship_level==="Recurring").length]];
  return `${base}<section class="partnerReports"><div class="sectionHd"><span>Partner relationships</span><span>CRM-calculated data</span></div><div class="summaryGrid">${metrics.map(([label,value])=>`<div class="summaryCard"><div class="t">${escapeHtml(label)}</div><div class="n">${value}</div></div>`).join("")}</div><div class="partnerReportColumns"><section class="sectionCard"><div class="sectionHd"><span>By stage</span></div><div class="sectionBody">${stageRows||`<div class="empty">No partners.</div>`}</div></section><section class="sectionCard"><div class="sectionHd"><span>By classification</span></div><div class="sectionBody">${classRows||`<div class="empty">No partners.</div>`}</div></section><section class="sectionCard"><div class="sectionHd"><span>Most-used content</span></div><div class="sectionBody">${contentRows}</div></section><section class="sectionCard"><div class="sectionHd"><span>Channels used</span></div><div class="sectionBody">${channelRows}</div></section></div></section>`;
};

window.MarelPartners = Object.freeze({
  stages:[...PARTNER_STAGES], initialCadence:[...INITIAL_CADENCE], permanentCadences:PERMANENT_CADENCES,
  adjustedDate:partnerAdjustedDate, createInitialCadence:partnerCreateInitialCadence,
  needsNextAction:partnerNeedsNextAction, daysWithoutContact:partnerDaysWithoutContact
});
partnerInjectInterface();
