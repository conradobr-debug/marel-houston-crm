(function initializeMockRepository(global){
  "use strict";

  const STORAGE_KEY = "marel_crm_mock_repository_v1";
  const ADMIN_ID = "20000000-0000-4000-8000-000000000001";
  const now = ()=>new Date().toISOString();
  const clone = value=>JSON.parse(JSON.stringify(value));
  const uuid = ()=>global.crypto?.randomUUID?.() || `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  function applyCompatibilityFields(record){
    const next=(record.appointments||[]).filter(item=>item.status!=="completed"&&item.starts_at).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))[0]||null;
    record.next_action_at=next?.starts_at||record.next_action_at||null;
    record.next_action=record.next_action_at?.slice(0,10)||null;
    record.next_action_kind=next?.kind||record.next_action_kind||null;
    record.next_action_details=next?.details||record.next_action_details||null;
    return record;
  }

  function initialState(){
    const created = now();
    return {
      profiles:[{id:ADMIN_ID,display_name:"Offline Demo Admin",role:"admin",is_active:true}],
      settings:{sources:["Showroom Visit","Referral","Website Form","Other"],lost_reasons:["Price","Timeline","Changed plans","Other"]},
      records:[
        {id:"mock-lead-1",_entity_type:"opportunity",_lead_id:"mock-source-lead-1",_opportunity_id:"mock-lead-1",record_type:"lead",pipeline:"lead",first_name:"Jordan",last_name:"Example",phone:"+1 713-555-0191",email:"jordan@example.test",city:"Houston",rooms:"Synthetic Kitchen Opportunity",source:"Showroom Visit",owner_id:ADMIN_ID,created_by:ADMIN_ID,stage:"Design in Progress",stage_entered_at:created,lead_quality:"Warm",estimate:125000,notes:"Synthetic offline demonstration record.",appointments:[],created_at:created,updated_at:created},
        {id:"mock-partner-1",_entity_type:"partner",_partner_id:"mock-partner-1",record_type:"specifier",pipeline:"lead",first_name:"Taylor",last_name:"Sample",phone:"+1 713-555-0192",email:"taylor@example.test",city:"Houston",rooms:"Example Design Studio",company_name:"Example Design Studio",specifier_type:"Interior Designer",owner_id:ADMIN_ID,created_by:ADMIN_ID,stage:"Relationship Development",stage_entered_at:created,partner_classification:"B — Potential",relationship_level:"Developing",appointments:[],created_at:created,updated_at:created},
        {id:"mock-project-1",_entity_type:"project",_lead_id:"mock-source-lead-2",_opportunity_id:"mock-source-opportunity-2",_project_id:"mock-project-1",record_type:"lead",pipeline:"closed",first_name:"Morgan",last_name:"Demo",phone:"+1 713-555-0193",city:"Bellaire",rooms:"Synthetic Residence",source:"Referral",owner_id:ADMIN_ID,created_by:ADMIN_ID,stage:"Technical Review",stage_entered_at:created,lead_quality:"Hot",estimate:210000,appointments:[],created_at:created,updated_at:created}
      ],
      events:[]
    };
  }

  function readState(){
    try{
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if(parsed?.records && parsed?.profiles) return parsed;
    }catch(error){ console.warn("[CRM Mock] Resetting invalid local data.", error); }
    const state = initialState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function createMockRepository(){
    let state = readState();
    let authListener = null;
    const session = {user:{id:ADMIN_ID,email:"offline.admin@marel-houston.local"}};
    const save = ()=>localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const find = id=>state.records.find(record=>record.id===id);

    return {
      mode:"mock",
      async getSession(){ return session; },
      onAuthStateChange(callback){ authListener=callback; return ()=>{authListener=null;}; },
      async signIn(){ authListener?.("SIGNED_IN",session); return session; },
      async signOut(){ return true; },
      async listProfiles(){ return clone(state.profiles); },
      async getSettings(){ return clone(state.settings); },
      async saveSettings(settings){ state.settings=clone(settings); save(); return clone(state.settings); },
      async listRecords(){ return clone(state.records); },
      async listEvents(){ return clone(state.events); },
      async createRecord(payload){
        const created=now();
        const id=uuid();
        const type=payload.record_type==="specifier" ? "partner" : (payload.pipeline==="closed" ? "project" : "opportunity");
        const record={...payload,id,_entity_type:type,record_type:type==="partner"?"specifier":"lead",pipeline:type==="project"?"closed":"lead",created_by:ADMIN_ID,stage_entered_at:created,created_at:created,updated_at:created};
        if(type==="partner") record._partner_id=id;
        if(type==="opportunity"){record._lead_id=id;record._opportunity_id=id;}
        if(type==="project"){record._lead_id=id;record._opportunity_id=id;record._project_id=id;}
        applyCompatibilityFields(record);state.records.unshift(record); save(); return clone(record);
      },
      async updateRecord(existing,payload){
        const record=find(existing?.id||existing); if(!record) throw new Error("Record not found.");
        Object.assign(record,payload,{updated_at:now()});applyCompatibilityFields(record); save(); return clone(record);
      },
      async updateStage(existing,stage){
        const id=existing?.id||existing;
        const record=find(id); if(!record) throw new Error("Record not found.");
        const previous=record.stage; Object.assign(record,{stage,stage_entered_at:now(),updated_at:now()});
        state.events.unshift({id:uuid(),record_id:id,event_type:"stage_changed",from_value:previous,to_value:stage,occurred_at:now()});
        save(); return clone(record);
      },
      async markClosed(existing){ const id=existing?.id||existing;const record=find(id); if(!record) throw new Error("Record not found."); record.pipeline="closed";record._entity_type="project";record._project_id=id;record.stage="Deposit Received";record.updated_at=now();save();return clone(record); },
      async markLost(existing,reason){ const id=existing?.id||existing;const record=find(id);if(!record) throw new Error("Record not found.");record.pipeline="lead";record.stage="Lost";record.lost_reason=reason||"Other";record.updated_at=now();save();return clone(record); },
      async deleteRecord(existing){ const id=existing?.id||existing;state.records=state.records.filter(record=>record.id!==id);save();return true; },
      async createActivity(record,details={}){ state.events.unshift({id:uuid(),record_id:record.id,event_type:"contact_logged",metadata:details,occurred_at:now()});save();return true; },
      async subscribe(){ return async()=>{}; },
      async listPartnerContents(){ return []; },
      async savePartnerContent(){ throw new Error("Content library is unavailable in offline mode."); }
    };
  }

  global.MarelCRMData = global.MarelCRMData || {};
  global.MarelCRMData.createMockRepository = createMockRepository;
})(window);
