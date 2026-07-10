(function initializeSupabaseRepository(global){
  "use strict";

  function createSupabaseRepository(client, options={}){
    if(!client) throw new Error("A Supabase client is required.");
    const mappers = global.MarelCRMData.mappers;
    const workspaceId = options.workspaceId || mappers.WORKSPACE_ID;
    const PHOTO_BUCKET = "marel-client-photos";
    const checked = async promise=>{
      const result = await promise;
      if(result.error) throw result.error;
      return result.data;
    };
    const currentUser = async()=>{
      const {data,error}=await client.auth.getUser();
      if(error) throw error;
      if(!data.user) throw new Error("An authenticated local user is required.");
      return data.user;
    };
    const updatePayload = payload=>{
      const {workspace_id,created_by,...rest}=payload;
      return rest;
    };

    async function loadNormalized(){
      const queries = await Promise.all([
        checked(client.from("leads").select("*").order("updated_at",{ascending:false})),
        checked(client.from("partners").select("*").order("updated_at",{ascending:false})),
        checked(client.from("opportunities").select("*").order("updated_at",{ascending:false})),
        checked(client.from("projects").select("*").order("updated_at",{ascending:false})),
        checked(client.from("notes").select("*").order("updated_at",{ascending:false})),
        checked(client.from("tasks").select("*").order("due_at",{ascending:true}))
      ]);
      return {leads:queries[0]||[],partners:queries[1]||[],opportunities:queries[2]||[],projects:queries[3]||[],notes:queries[4]||[],tasks:queries[5]||[]};
    }

    async function listRecords(){
      const records=mappers.composeRecords(await loadNormalized());
      await Promise.all(records.filter(record=>record.client_photo_path).map(async record=>{
        try{
          const data=await checked(client.storage.from(PHOTO_BUCKET).createSignedUrl(record.client_photo_path, 900));
          record.client_photo_url=data?.signedUrl || null;
        }catch(error){
          console.warn("[CRM Data] Could not create a signed client-photo URL.",error);
          record.client_photo_url=null;
        }
      }));
      return records;
    }

    async function syncNote(record,userId){
      const body=(record.notes||"").trim();
      if(!body) return;
      if(record._note_id){
        await checked(client.from("notes").update({body}).eq("id",record._note_id).select("id").single());
      }else{
        const data=await checked(client.from("notes").insert({workspace_id:workspaceId,...mappers.relatedPayload(record),body,created_by:userId}).select("id").single());
        record._note_id=data.id;
      }
    }

    async function syncTask(record,userId){
      const scheduled=(record.appointments||[]).filter(item=>item.status!=="completed"&&item.starts_at).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))[0];
      const dueAt=scheduled?.starts_at || record.next_action_at || null;
      if(!dueAt){
        if(record._task_id){
          if(record.external_calendar_event_id) await syncCalendar(record,"delete");
          await checked(client.from("tasks").update({status:"canceled",due_at:null}).eq("id",record._task_id).select("id").single());
        }
        return;
      }
      const payload={
        title:scheduled?.kind || record.next_action_kind || "Follow-Up",
        details:scheduled?.details || record.next_action_details || null,
        due_at:dueAt,
        assigned_to:scheduled?.owner_id || record.next_action_owner || record.owner_id || userId,
        appointment_location:scheduled?.location || record.appointment_location || null,
        appointment_duration_minutes:Number(scheduled?.duration_minutes || record.next_action_duration_minutes || 30),
        priority:"normal"
      };
      if(record._task_id){
        await checked(client.from("tasks").update(payload).eq("id",record._task_id).select("id").single());
        if(record.calendar_sync_status === "synced") await syncCalendar(record,"sync");
      }else{
        const data=await checked(client.from("tasks").insert({workspace_id:workspaceId,...mappers.relatedPayload(record),...payload,created_by:userId}).select("id").single());
        record._task_id=data.id;
      }
    }

    async function syncCalendar(record,operation="sync"){
      if(!record?._task_id) throw new Error("Save an appointment before syncing it to the shared calendar.");
      const {data,error}=await client.functions.invoke("calendar-sync",{body:{task_id:record._task_id,operation}});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
      return hydrateByIdentity(record.id);
    }

    async function hydrateByIdentity(identity){
      const records=await listRecords();
      return records.find(record=>
        record.id===identity || record._lead_id===identity || record._partner_id===identity ||
        record._opportunity_id===identity || record._project_id===identity
      ) || null;
    }

    async function createRecord(record){
      const user=await currentUser();
      if(record.record_type==="specifier"){
        const partner=await checked(client.from("partners").insert(mappers.partnerPayload(record,user.id,workspaceId)).select("*").single());
        const mapped={...record,id:partner.id,_entity_type:"partner",_partner_id:partner.id};
        await Promise.all([syncNote(mapped,user.id),syncTask(mapped,user.id)]);
        return hydrateByIdentity(partner.id);
      }

      const lead=await checked(client.from("leads").insert(mappers.leadPayload({...record,_entity_type:"lead"},user.id,workspaceId)).select("*").single());
      let identity=lead.id;
      try{
        const opportunity=await checked(client.from("opportunities").insert(mappers.opportunityPayload(record,lead.id,user.id,workspaceId)).select("*").single());
        identity=opportunity.id;
        const mapped={...record,id:opportunity.id,_entity_type:"opportunity",_lead_id:lead.id,_opportunity_id:opportunity.id};
        await Promise.all([syncNote(mapped,user.id),syncTask(mapped,user.id)]);
      }catch(error){
        console.warn("[CRM Data] Lead was created but its opportunity could not be created.",error);
      }
      return hydrateByIdentity(identity);
    }

    async function updateRecord(existing,patch){
      const user=await currentUser();
      const record={...existing,...patch};
      if(existing._entity_type==="partner"){
        await checked(client.from("partners").update(updatePayload(mappers.partnerPayload(record,user.id,workspaceId))).eq("id",existing._partner_id||existing.id).select("id").single());
      }else{
        await checked(client.from("leads").update(updatePayload(mappers.leadPayload(record,user.id,workspaceId))).eq("id",existing._lead_id||existing.id).select("id").single());
        if(existing._opportunity_id && existing._entity_type!=="project"){
          await checked(client.from("opportunities").update(updatePayload(mappers.opportunityPayload(record,existing._lead_id,user.id,workspaceId))).eq("id",existing._opportunity_id).select("id").single());
        }
        if(existing._opportunity_id && existing._entity_type==="project"){
          await checked(client.from("opportunities").update({
            title:record.rooms,
            owner_id:record.owner_id||null,
            estimated_value_usd:record.estimate==null?null:Number(record.estimate)
          }).eq("id",existing._opportunity_id).select("id").single());
        }
        if(existing._project_id){
          await checked(client.from("projects").update(updatePayload(mappers.projectPayload(record,existing._opportunity_id,user.id,workspaceId))).eq("id",existing._project_id).select("id").single());
        }
      }
      await Promise.all([syncNote(record,user.id),syncTask(record,user.id)]);
      return hydrateByIdentity(existing.id);
    }

    async function updateStage(record,stage){
      if(record._entity_type==="partner") await checked(client.from("partners").update({stage}).eq("id",record._partner_id||record.id).select("id").single());
      else if(record._entity_type==="project") await checked(client.from("projects").update({stage}).eq("id",record._project_id||record.id).select("id").single());
      else if(record._entity_type==="opportunity") await checked(client.from("opportunities").update({stage,status:stage==="Won"?"won":stage==="Lost"?"lost":stage==="On Hold"?"on_hold":"open",...(stage==="Lost"?{lost_reason:record.lost_reason||"Other"}:{lost_reason:null})}).eq("id",record._opportunity_id||record.id).select("id").single());
      else await checked(client.from("leads").update({stage}).eq("id",record._lead_id||record.id).select("id").single());
      return hydrateByIdentity(record.id);
    }

    async function ensureOpportunity(record,userId){
      if(record._opportunity_id) return record._opportunity_id;
      const opportunity=await checked(client.from("opportunities").insert(mappers.opportunityPayload({...record,stage:"Won"},record._lead_id||record.id,userId,workspaceId)).select("id").single());
      return opportunity.id;
    }

    async function markClosed(record){
      const user=await currentUser();
      if(record._entity_type==="project") return updateStage(record,record.stage||"Deposit Received");
      const opportunityId=await ensureOpportunity(record,user.id);
      await checked(client.from("opportunities").update({stage:"Won",status:"won",lost_reason:null}).eq("id",opportunityId).select("id").single());
      const project=await checked(client.from("projects").insert(mappers.projectPayload({...record,stage:"Deposit Received"},opportunityId,user.id,workspaceId)).select("id").single());
      return hydrateByIdentity(project.id);
    }

    async function markLost(record,reason){
      if(record._opportunity_id){
        await checked(client.from("opportunities").update({stage:"Lost",status:"lost",lost_reason:reason||"Other"}).eq("id",record._opportunity_id).select("id").single());
      }else{
        await checked(client.from("leads").update({stage:"Lost"}).eq("id",record._lead_id||record.id).select("id").single());
      }
      return hydrateByIdentity(record.id);
    }

    async function deleteRecord(record){
      if(record._project_id) await checked(client.from("projects").delete().eq("id",record._project_id));
      if(record._opportunity_id) await checked(client.from("opportunities").delete().eq("id",record._opportunity_id));
      if(record._partner_id) await checked(client.from("partners").delete().eq("id",record._partner_id));
      else if(record._lead_id) await checked(client.from("leads").delete().eq("id",record._lead_id));
      return true;
    }

    async function createActivity(record,details={}){
      const user=await currentUser();
      const payload={
        workspace_id:workspaceId,
        ...mappers.relatedPayload(record),
        kind:details.kind||"phone_call",
        subject:details.subject||"Activity logged",
        details:details.details||null,
        outcome:details.outcome||null,
        occurred_at:details.occurred_at||new Date().toISOString(),
        created_by:user.id
      };
      return checked(client.from("activities").insert(payload).select("id").single());
    }

    function leadIdFor(record){
      const leadId=record?._lead_id || (record?._entity_type === "lead" ? record.id : null);
      if(!leadId) throw new Error("Client photos are available for lead and customer records only.");
      return leadId;
    }

    async function uploadClientPhoto(record,file){
      await currentUser();
      if(!(file instanceof Blob)) throw new Error("Choose a valid image file.");
      const leadId=leadIdFor(record);
      const extension=file.type === "image/webp" ? "webp" : (file.type === "image/png" ? "png" : "jpg");
      const objectPath=`${workspaceId}/leads/${leadId}/photo.${extension}`;
      await checked(client.storage.from(PHOTO_BUCKET).upload(objectPath,file,{upsert:true,contentType:file.type,cacheControl:"3600"}));
      try{
        await checked(client.from("leads").update({
          client_photo_path:objectPath,
          client_photo_mime_type:file.type,
          client_photo_size_bytes:file.size
        }).eq("id",leadId).select("id").single());
      }catch(error){
        await client.storage.from(PHOTO_BUCKET).remove([objectPath]);
        throw error;
      }
      if(record.client_photo_path && record.client_photo_path !== objectPath){
        try{ await checked(client.storage.from(PHOTO_BUCKET).remove([record.client_photo_path])); }
        catch(error){ console.warn("[CRM Data] The previous client photo could not be removed.",error); }
      }
      return hydrateByIdentity(record.id);
    }

    async function removeClientPhoto(record){
      await currentUser();
      const leadId=leadIdFor(record);
      const existingPath=record.client_photo_path;
      await checked(client.from("leads").update({
        client_photo_path:null,
        client_photo_mime_type:null,
        client_photo_size_bytes:null
      }).eq("id",leadId).select("id").single());
      if(existingPath) await checked(client.storage.from(PHOTO_BUCKET).remove([existingPath]));
      return hydrateByIdentity(record.id);
    }

    async function listEvents(){
      const [history,activities]=await Promise.all([
        checked(client.from("status_history").select("*").order("changed_at",{ascending:false}).limit(1500)),
        checked(client.from("activities").select("*").order("occurred_at",{ascending:false}).limit(1500))
      ]);
      const statusEvents=(history||[]).map(item=>({
        id:item.id,
        record_id:item.project_id||item.opportunity_id||item.partner_id||item.lead_id||item.proposal_id||item.contract_id,
        event_type:"stage_changed",
        actor_id:item.changed_by,
        from_value:item.from_status,
        to_value:item.to_status,
        metadata:{area:item.area,reason:item.reason},
        occurred_at:item.changed_at
      }));
      const activityEvents=(activities||[]).map(item=>({
        id:item.id,
        record_id:item.project_id||item.opportunity_id||item.partner_id||item.lead_id,
        event_type:"contact_logged",
        actor_id:item.created_by,
        metadata:{kind:item.kind,subject:item.subject,details:item.details,outcome:item.outcome},
        occurred_at:item.occurred_at
      }));
      return [...statusEvents,...activityEvents].sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at));
    }

    async function subscribe(onChange,onStatus){
      const channel=client.channel(`marel_crm_normalized_${Date.now()}`);
      ["leads","partners","opportunities","projects","tasks","activities"].forEach(table=>{
        channel.on("postgres_changes",{event:"*",schema:"public",table},payload=>onChange?.({...payload,table}));
      });
      channel.subscribe((status,error)=>onStatus?.(status,error));
      return async()=>{ await client.removeChannel(channel); };
    }

    return {
      mode:"supabase",
      async getSession(){ const {data,error}=await client.auth.getSession();if(error) throw error;return data.session; },
      onAuthStateChange(callback){ const {data}=client.auth.onAuthStateChange((event,session)=>setTimeout(()=>callback(event,session),0));return ()=>data.subscription.unsubscribe(); },
      async signIn(email,password){ const {data,error}=await client.auth.signInWithPassword({email,password});if(error) throw error;return data.session; },
      async signOut(){ const {error}=await client.auth.signOut();if(error) throw error;return true; },
      async listProfiles(){ return checked(client.from("profiles").select("id,display_name,role,is_active").order("display_name",{ascending:true})); },
      async getSettings(){ const data=await checked(client.from("crm_settings").select("lead_sources,lost_reasons").eq("workspace_id",workspaceId).maybeSingle());return {sources:data?.lead_sources||[],lost_reasons:data?.lost_reasons||[]}; },
      async saveSettings(settings){ await checked(client.from("crm_settings").update({lead_sources:settings.sources,lost_reasons:settings.lost_reasons}).eq("workspace_id",workspaceId));return settings; },
      listRecords,listEvents,createRecord,updateRecord,updateStage,markClosed,markLost,deleteRecord,createActivity,uploadClientPhoto,removeClientPhoto,syncCalendar,subscribe,
      async listPartnerContents(){ return []; },
      async savePartnerContent(){ throw new Error("Partner content library is not part of the normalized Phase 3 schema."); }
    };
  }

  global.MarelCRMData = global.MarelCRMData || {};
  global.MarelCRMData.createSupabaseRepository = createSupabaseRepository;
})(window);
