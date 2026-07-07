(function initializeCrmDataService(global){
  "use strict";

  const api = global.MarelCRMData = global.MarelCRMData || {};
  let repository = null;
  let fallbackReason = null;

  function useMock(reason){
    repository = api.createMockRepository();
    api.repositoryContract.assertRepositoryContract(repository,"mock repository");
    fallbackReason = reason || "Local Supabase is not configured.";
    console.info("[CRM Data] Using synthetic offline fallback.",{reason:fallbackReason});
    return repository;
  }

  function configure(options={}){
    const configured=Boolean(options.supabaseClient && options.supabaseUrl?.startsWith("http://127.0.0.1"));
    repository=configured
      ? api.createSupabaseRepository(options.supabaseClient,{workspaceId:options.workspaceId})
      : api.createMockRepository();
    api.repositoryContract.assertRepositoryContract(repository,`${repository.mode} repository`);
    fallbackReason=configured?null:"Local Supabase is not configured.";
    return repository.mode;
  }

  async function withFallback(method,args=[],allowFallback=true){
    if(!repository) useMock("The data service was not configured.");
    const activeRepository=repository;
    try{
      return await activeRepository[method](...args);
    }catch(error){
      const networkFailure=error instanceof TypeError || /fetch|network|connection|failed to connect/i.test(error?.message||"");
      if(activeRepository.mode==="supabase" && allowFallback && networkFailure){
        useMock("Local Supabase is unavailable.");
        return repository[method](...args);
      }
      throw error;
    }
  }

  api.service = {
    configure,
    useMock,
    get mode(){return repository?.mode||"mock";},
    get fallbackReason(){return fallbackReason;},
    getSession:()=>withFallback("getSession"),
    onAuthStateChange(callback){ return repository?.onAuthStateChange(callback)||(()=>{}); },
    signIn:(email,password)=>withFallback("signIn",[email,password],false),
    signOut:()=>withFallback("signOut",[],false),
    listProfiles:()=>withFallback("listProfiles"),
    getSettings:()=>withFallback("getSettings"),
    saveSettings:settings=>withFallback("saveSettings",[settings],false),
    listRecords:()=>withFallback("listRecords"),
    listEvents:()=>withFallback("listEvents"),
    createRecord:record=>withFallback("createRecord",[record],false),
    updateRecord:(existing,patch)=>withFallback("updateRecord",[existing,patch],false),
    updateStage:(record,stage)=>withFallback("updateStage",[record,stage],false),
    markClosed:record=>withFallback("markClosed",[record],false),
    markLost:(record,reason)=>withFallback("markLost",[record,reason],false),
    deleteRecord:record=>withFallback("deleteRecord",[record],false),
    createActivity:(record,details)=>withFallback("createActivity",[record,details],false),
    subscribe:(onChange,onStatus)=>withFallback("subscribe",[onChange,onStatus]),
    listPartnerContents:()=>withFallback("listPartnerContents"),
    savePartnerContent:content=>withFallback("savePartnerContent",[content],false)
  };
})(window);
