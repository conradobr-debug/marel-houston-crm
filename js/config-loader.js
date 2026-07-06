(function loadMarelConfiguration(){
  const config = window.MAREL_CONFIG || {};
  const runtime = window.MAREL_RUNTIME || {};
  window.APP_CONFIG = Object.freeze({
    ...config,
    runtime: Object.freeze({...runtime})
  });
})();

