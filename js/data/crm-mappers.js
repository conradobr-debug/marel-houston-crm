(function initializeCrmMappers(global){
  "use strict";

  const WORKSPACE_ID = "10000000-0000-4000-8000-000000000001";

  const leadClassificationToDb = {
    "Unreviewed":"unreviewed", "Hot":"hot", "Warm":"warm", "Cold":"cold", "Unqualified":"unqualified"
  };
  const leadClassificationToUi = Object.fromEntries(Object.entries(leadClassificationToDb).map(([ui, db])=>[db, ui]));
  const partnerClassificationToDb = {
    "Unclassified":"unclassified", "A — Strategic":"strategic", "B — Potential":"potential", "C — Developing":"developing"
  };
  const partnerClassificationToUi = Object.fromEntries(Object.entries(partnerClassificationToDb).map(([ui, db])=>[db, ui]));
  const relationshipToDb = {"New":"new", "Developing":"developing", "Active":"active", "Recurring":"recurring", "Inactive":"inactive"};
  const relationshipToUi = Object.fromEntries(Object.entries(relationshipToDb).map(([ui, db])=>[db, ui]));

  function compact(object){
    return Object.fromEntries(Object.entries(object).filter(([, value])=>value !== undefined));
  }

  function latestFor(items, keys){
    return items
      .filter(item=>keys.some(([key, value])=>value && item[key] === value))
      .sort((a,b)=>new Date(b.updated_at || b.created_at || 0)-new Date(a.updated_at || a.created_at || 0))[0] || null;
  }

  function nextTaskFor(items, keys){
    return items
      .filter(item=>item.status !== "completed" && keys.some(([key, value])=>value && item[key] === value))
      .sort((a,b)=>new Date(a.due_at || "9999-12-31")-new Date(b.due_at || "9999-12-31"))[0] || null;
  }

  function taskFields(task){
    if(!task) return {appointments:[], next_action:null, next_action_at:null, next_action_kind:null, next_action_details:null};
    const appointment = task.due_at ? [{
      id:task.id,
      starts_at:task.due_at,
      kind:task.title || "Follow-Up",
      details:task.details || null,
      duration_minutes:30,
      reminder_minutes:30,
      status:"scheduled",
      owner_id:task.assigned_to || null
    }] : [];
    return {
      appointments:appointment,
      next_action:task.due_at ? task.due_at.slice(0,10) : null,
      next_action_at:task.due_at || null,
      next_action_kind:task.title || null,
      next_action_details:task.details || null,
      next_action_owner:task.assigned_to || null,
      _task_id:task.id
    };
  }

  function leadBase(lead, note, task){
    return {
      first_name:lead.first_name,
      last_name:lead.last_name,
      phone:lead.phone || "",
      email:lead.email || null,
      city:lead.city || "",
      source:lead.source || null,
      owner_id:lead.owner_id || null,
      preferred_contact:lead.preferred_contact || "Email",
      lead_quality:leadClassificationToUi[lead.classification] || "Unreviewed",
      property_status:lead.property_status || "Not provided",
      professional_name:lead.professional_name || null,
      has_floor_plan:lead.has_floor_plan,
      investment_profile:lead.investment_profile || "To be determined",
      decision_due_at:lead.decision_due_on || null,
      notes:note?.body || null,
      lost_reason:null,
      created_at:lead.created_at,
      updated_at:lead.updated_at,
      _lead_id:lead.id,
      _note_id:note?.id || null,
      ...taskFields(task)
    };
  }

  function mapLeadOnly(lead, note, task){
    return {
      id:lead.id,
      ...leadBase(lead, note, task),
      record_type:"lead",
      pipeline:"lead",
      stage:lead.stage,
      stage_entered_at:lead.updated_at || lead.created_at,
      rooms:"Opportunity details pending",
      estimate:lead.estimated_value_usd == null ? null : Number(lead.estimated_value_usd),
      _entity_type:"lead"
    };
  }

  function mapOpportunity(opportunity, lead, note, task){
    return {
      id:opportunity.id,
      ...leadBase(lead, note, task),
      record_type:"lead",
      pipeline:"lead",
      stage:opportunity.status === "lost" ? "Lost" : opportunity.stage,
      stage_entered_at:opportunity.updated_at || opportunity.created_at,
      rooms:opportunity.title,
      estimate:opportunity.estimated_value_usd == null ? null : Number(opportunity.estimated_value_usd),
      owner_id:opportunity.owner_id || lead.owner_id || null,
      lost_reason:opportunity.lost_reason || null,
      created_at:opportunity.created_at,
      updated_at:opportunity.updated_at,
      _entity_type:"opportunity",
      _opportunity_id:opportunity.id
    };
  }

  function mapProject(project, opportunity, lead, note, task){
    return {
      id:project.id,
      ...leadBase(lead, note, task),
      record_type:"lead",
      pipeline:"closed",
      stage:project.stage,
      stage_entered_at:project.updated_at || project.created_at,
      rooms:project.name || opportunity.title,
      estimate:opportunity.estimated_value_usd == null ? null : Number(opportunity.estimated_value_usd),
      owner_id:project.project_manager_id || opportunity.owner_id || lead.owner_id || null,
      lost_reason:opportunity.lost_reason || null,
      created_at:project.created_at,
      updated_at:project.updated_at,
      _entity_type:"project",
      _opportunity_id:opportunity.id,
      _project_id:project.id
    };
  }

  function mapPartner(partner, note, task){
    return {
      id:partner.id,
      record_type:"specifier",
      pipeline:"lead",
      stage:partner.stage,
      stage_entered_at:partner.updated_at || partner.created_at,
      first_name:partner.first_name,
      last_name:partner.last_name,
      phone:partner.phone || "",
      email:partner.email || null,
      city:partner.city || "",
      rooms:partner.company_name || partner.partner_type,
      notes:note?.body || null,
      owner_id:partner.owner_id || null,
      specifier_type:partner.partner_type,
      company_name:partner.company_name || null,
      partner_classification:partnerClassificationToUi[partner.classification] || "Unclassified",
      relationship_level:relationshipToUi[partner.relationship_level] || "New",
      first_visit_at:partner.first_visit_on || null,
      region:partner.service_area || null,
      project_profile:partner.project_profile || null,
      client_profile:partner.client_profile || null,
      preferred_styles:partner.preferred_styles || [],
      preferred_environments:partner.preferred_spaces || [],
      current_suppliers:partner.current_suppliers || null,
      valued_differentials:partner.valued_differentials || null,
      objections:partner.objections || null,
      mentioned_projects:partner.mentioned_projects || null,
      interest_tags:partner.interest_tags || [],
      partner_origin:partner.source || null,
      created_at:partner.created_at,
      updated_at:partner.updated_at,
      _entity_type:"partner",
      _partner_id:partner.id,
      _note_id:note?.id || null,
      ...taskFields(task)
    };
  }

  function composeRecords(dataset){
    const leads = dataset.leads || [];
    const partners = dataset.partners || [];
    const opportunities = dataset.opportunities || [];
    const projects = dataset.projects || [];
    const notes = dataset.notes || [];
    const tasks = dataset.tasks || [];
    const leadMap = new Map(leads.map(item=>[item.id,item]));
    const opportunityMap = new Map(opportunities.map(item=>[item.id,item]));
    const projectByOpportunity = new Map(projects.map(item=>[item.opportunity_id,item]));
    const representedLeadIds = new Set();
    const records = [];

    opportunities.forEach(opportunity=>{
      const lead = leadMap.get(opportunity.lead_id);
      if(!lead) return;
      representedLeadIds.add(lead.id);
      const project = projectByOpportunity.get(opportunity.id);
      const keys = [["lead_id",lead.id],["opportunity_id",opportunity.id],["project_id",project?.id]];
      const note = latestFor(notes, keys);
      const task = nextTaskFor(tasks, keys);
      records.push(project ? mapProject(project, opportunity, lead, note, task) : mapOpportunity(opportunity, lead, note, task));
    });

    leads.filter(lead=>!representedLeadIds.has(lead.id)).forEach(lead=>{
      const keys = [["lead_id",lead.id]];
      records.push(mapLeadOnly(lead, latestFor(notes,keys), nextTaskFor(tasks,keys)));
    });

    partners.forEach(partner=>{
      const keys = [["partner_id",partner.id]];
      records.push(mapPartner(partner, latestFor(notes,keys), nextTaskFor(tasks,keys)));
    });

    return records.sort((a,b)=>new Date(b.updated_at || b.created_at)-new Date(a.updated_at || a.created_at));
  }

  function leadPayload(record, userId, workspaceId=WORKSPACE_ID){
    return compact({
      workspace_id:workspaceId,
      first_name:record.first_name,
      last_name:record.last_name,
      phone:record.phone || null,
      email:record.email || null,
      city:record.city || null,
      source:record.source || null,
      classification:leadClassificationToDb[record.lead_quality] || "unreviewed",
      stage:record._entity_type === "lead" ? record.stage : undefined,
      owner_id:record.owner_id || null,
      preferred_contact:record.preferred_contact || null,
      estimated_value_usd:record.estimate == null ? null : Number(record.estimate),
      property_status:record.property_status || null,
      professional_name:record.professional_name || null,
      has_floor_plan:record.has_floor_plan == null ? null : Boolean(record.has_floor_plan),
      investment_profile:record.investment_profile || null,
      decision_due_on:record.decision_due_at || null,
      created_by:userId
    });
  }

  function partnerPayload(record, userId, workspaceId=WORKSPACE_ID){
    return compact({
      workspace_id:workspaceId,
      first_name:record.first_name,
      last_name:record.last_name,
      company_name:record.company_name || null,
      partner_type:record.specifier_type || "Other",
      phone:record.phone || null,
      email:record.email || null,
      city:record.city || null,
      service_area:record.region || null,
      classification:partnerClassificationToDb[record.partner_classification] || "unclassified",
      relationship_level:relationshipToDb[record.relationship_level] || "new",
      stage:record.stage || "Identified",
      owner_id:record.owner_id || null,
      source:record.partner_origin || null,
      first_visit_on:record.first_visit_at ? record.first_visit_at.slice(0,10) : null,
      client_profile:record.client_profile || null,
      project_profile:record.project_profile || null,
      preferred_styles:record.preferred_styles || [],
      preferred_spaces:record.preferred_environments || [],
      current_suppliers:record.current_suppliers || null,
      valued_differentials:record.valued_differentials || null,
      objections:record.objections || null,
      mentioned_projects:record.mentioned_projects || null,
      interest_tags:record.interest_tags || [],
      created_by:userId
    });
  }

  function opportunityPayload(record, leadId, userId, workspaceId=WORKSPACE_ID){
    const lost = record.stage === "Lost";
    return compact({
      workspace_id:workspaceId,
      lead_id:leadId,
      title:record.rooms || `${record.first_name || ""} ${record.last_name || ""}`.trim() || "New Opportunity",
      stage:record.stage || "Qualified",
      status:lost ? "lost" : (record.stage === "Won" ? "won" : (record.stage === "On Hold" ? "on_hold" : "open")),
      owner_id:record.owner_id || null,
      estimated_value_usd:record.estimate == null ? null : Number(record.estimate),
      lost_reason:lost ? (record.lost_reason || "Other") : null,
      created_by:userId
    });
  }

  function projectPayload(record, opportunityId, userId, workspaceId=WORKSPACE_ID){
    return compact({
      workspace_id:workspaceId,
      opportunity_id:opportunityId,
      name:record.rooms || `${record.first_name || ""} ${record.last_name || ""}`.trim() || "Marel Project",
      stage:record.stage || "Deposit Received",
      project_manager_id:record.owner_id || null,
      city:record.city || null,
      created_by:userId
    });
  }

  function relatedPayload(record){
    const type = record._entity_type;
    if(type === "partner") return {partner_id:record._partner_id || record.id};
    if(type === "project") return {project_id:record._project_id || record.id};
    if(type === "opportunity") return {opportunity_id:record._opportunity_id || record.id};
    return {lead_id:record._lead_id || record.id};
  }

  global.MarelCRMData = global.MarelCRMData || {};
  global.MarelCRMData.mappers = {
    WORKSPACE_ID,
    composeRecords,
    leadPayload,
    partnerPayload,
    opportunityPayload,
    projectPayload,
    relatedPayload,
    compact
  };
})(window);
