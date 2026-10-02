// One registration path. A waiting update never replaces code during an open form.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', async () => {
    const announce = registration => {
      if (!registration.waiting || !navigator.serviceWorker.controller || document.querySelector('#update-notice')) return;
      const notice=document.createElement('aside');notice.id='update-notice';notice.className='update-notice';notice.setAttribute('role','status');
      notice.textContent='Hay una actualización de TallerOS lista. Guarda lo que estés haciendo, cierra todas las pestañas de TallerOS y vuelve a abrir la aplicación. Tus datos se conservan.';
      document.body.prepend(notice);
    };
    try {
      const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
      announce(registration);
      registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',()=>announce(registration)));
      // Revalidate the worker without interrupting an open form or forcing a schema change.
      if(navigator.onLine)await registration.update();
    }catch(error){console.warn('TallerOS offline:',error.message);}
  });
}
