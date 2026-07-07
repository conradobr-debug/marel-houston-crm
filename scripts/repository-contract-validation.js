(function initializeRepositoryValidation(global){
  "use strict";

  const output=document.getElementById("output");
  const button=document.getElementById("run");
  const write=value=>{output.textContent=typeof value==="string"?value:JSON.stringify(value,null,2);};

  button.addEventListener("click",async()=>{
    button.disabled=true;
    write("Running synthetic repository contracts…");
    try{
      const api=global.MarelCRMData;
      const mock=api.createMockRepository();
      const supabaseUrl=global.MAREL_RUNTIME?.supabaseUrl||"";
      const publishableKey=global.MAREL_RUNTIME?.supabasePublishableKey||"";
      const parsed=supabaseUrl?new URL(supabaseUrl):null;
      if(parsed && !["127.0.0.1","localhost"].includes(parsed.hostname)) throw new Error("Only local Supabase URLs are allowed.");

      const results=[await api.repositoryContract.runCoreContract(mock,"mock repository")];
      if(parsed && publishableKey){
        const password=document.getElementById("password").value;
        if(!password) throw new Error("Enter the synthetic local password to validate Supabase.");
        const client=global.supabase.createClient(supabaseUrl,publishableKey);
        const repository=api.createSupabaseRepository(client,{workspaceId:global.MAREL_RUNTIME.workspaceId});
        await repository.signIn(document.getElementById("email").value.trim(),password);
        results.push(await api.repositoryContract.runCoreContract(repository,"Supabase repository"));
      }
      write({status:"PASS",results});
    }catch(error){
      console.error("[Repository Contract]",error);
      write({status:"FAIL",message:error.message});
    }finally{
      button.disabled=false;
    }
  });
})(window);
