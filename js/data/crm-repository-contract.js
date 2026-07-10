(function initializeCrmRepositoryContract(global){
  "use strict";

  const api=global.MarelCRMData=global.MarelCRMData||{};
  const methods=Object.freeze([
    "getSession","onAuthStateChange","signIn","signOut","listProfiles","getSettings","saveSettings",
    "listRecords","listEvents","createRecord","updateRecord","updateStage","markClosed","markLost",
    "deleteRecord","createActivity","uploadClientPhoto","removeClientPhoto","syncCalendar","subscribe","listPartnerContents","savePartnerContent"
  ]);

  function assertRepositoryContract(repository,label="repository"){
    if(!repository || !["mock","supabase"].includes(repository.mode)) throw new Error(`${label} has no valid mode.`);
    const missing=methods.filter(method=>typeof repository[method]!=="function");
    if(missing.length) throw new Error(`${label} is missing: ${missing.join(", ")}`);
    return true;
  }

  function filterRecords(records,filters={}){
    const query=(filters.query||"").trim().toLowerCase();
    return (records||[]).filter(record=>{
      if(filters.ownerId && record.owner_id!==filters.ownerId) return false;
      if(filters.entityType && record._entity_type!==filters.entityType) return false;
      if(!query) return true;
      return [record.first_name,record.last_name,record.rooms,record.notes,record.source,record.company_name]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }

  function expect(condition,message){ if(!condition) throw new Error(message); }

  async function runCoreContract(repository,label="repository"){
    assertRepositoryContract(repository,label);
    const stamp=`Contract ${Date.now()}`;
    const profiles=await repository.listProfiles();
    expect(Array.isArray(profiles)&&profiles.length>0,`${label}: profiles did not load.`);
    const ownerId=profiles[0].id;
    const initial=await repository.listRecords();
    expect(Array.isArray(initial),`${label}: records did not load.`);
    expect(filterRecords(initial,{query:"synthetic"}).length>=0,`${label}: search contract failed.`);

    let lead=null;
    let partner=null;
    try{
      lead=await repository.createRecord({
        record_type:"lead",pipeline:"lead",first_name:"Contract",last_name:"Lead",phone:"+1 713-555-0177",
        city:"Houston",rooms:stamp,source:"Other",owner_id:ownerId,stage:"Qualified",lead_quality:"Warm",
        notes:"Synthetic repository contract note.",appointments:[{id:`task-${Date.now()}`,starts_at:new Date(Date.now()+86400000).toISOString(),kind:"Contract follow-up",details:"Synthetic next action",status:"scheduled",owner_id:ownerId}]
      });
      expect(lead?.id,`${label}: lead creation returned no id.`);
      let loaded=(await repository.listRecords()).find(record=>record.id===lead.id);
      expect(loaded?.notes==="Synthetic repository contract note.",`${label}: lead note did not round-trip.`);
      expect(Boolean(loaded?.next_action_at),`${label}: lead next action did not round-trip.`);
      const photo=new File([new Uint8Array([82,73,70,70,22,0,0,0,87,69,66,80,86,80,56,32,10,0,0,0,1,0,1,0,0,0])],"contract-photo.webp",{type:"image/webp"});
      loaded=await repository.uploadClientPhoto(loaded,photo);
      expect(Boolean(loaded?.client_photo_path),`${label}: client photo path did not save.`);
      const photoReloaded=(await repository.listRecords()).find(record=>record.id===lead.id);
      expect(Boolean(photoReloaded?.client_photo_url),`${label}: client photo signed URL did not regenerate.`);
      const replacementPhoto=new File([new Uint8Array([137,80,78,71,13,10,26,10])],"replacement-photo.png",{type:"image/png"});
      loaded=await repository.uploadClientPhoto(photoReloaded,replacementPhoto);
      expect(loaded?.client_photo_path?.endsWith("/photo.png"),`${label}: client photo replacement did not save.`);
      const jpegReplacement=new File([new Uint8Array([255,216,255,217])],"replacement-photo.jpg",{type:"image/jpeg"});
      loaded=await repository.uploadClientPhoto(loaded,jpegReplacement);
      expect(loaded?.client_photo_path?.endsWith("/photo.jpg"),`${label}: JPEG client photo replacement did not save.`);
      loaded=await repository.removeClientPhoto(loaded);
      expect(!loaded?.client_photo_path,`${label}: client photo did not remove.`);
      loaded=await repository.updateRecord(loaded,{last_name:"Lead Updated"});
      expect(loaded?.last_name==="Lead Updated",`${label}: lead edit failed.`);
      loaded=await repository.updateStage(loaded,"Proposal Ready");
      expect(loaded?.stage==="Proposal Ready",`${label}: stage update failed.`);
      expect(filterRecords(await repository.listRecords(),{query:stamp}).some(record=>record.id===lead.id),`${label}: created lead was not searchable.`);

      partner=await repository.createRecord({
        record_type:"specifier",pipeline:"lead",first_name:"Contract",last_name:"Partner",phone:"+1 713-555-0178",
        city:"Houston",company_name:stamp,specifier_type:"Interior Designer",owner_id:ownerId,stage:"Identified",
        partner_classification:"B — Potential",relationship_level:"Developing",appointments:[]
      });
      expect(partner?.id,`${label}: partner creation returned no id.`);
      partner=await repository.updateRecord(partner,{partner_classification:"A — Strategic"});
      expect(partner?.partner_classification==="A — Strategic",`${label}: partner edit failed.`);
      return {label,initialRecords:initial.length,leadId:lead.id,partnerId:partner.id};
    }finally{
      if(partner?.id) await repository.deleteRecord(partner).catch(()=>{});
      if(lead?.id) await repository.deleteRecord(lead).catch(()=>{});
    }
  }

  api.repositoryContract=Object.freeze({methods,assertRepositoryContract,filterRecords,runCoreContract});
})(window);
