// Replaceable voice adapter. Browser support varies; the text input is always available.
export function createVoiceAdapter({onText,onStatus,onError}){
  const Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;let recognition;
  return {supported:!!Recognition,start(){
    if(!Recognition){onError('Este navegador no ofrece dictado. Usa el micrófono del teclado o escribe tu mensaje.');return;}
    recognition?.abort();recognition=new Recognition();recognition.lang='es-DO';recognition.continuous=false;recognition.interimResults=false;
    recognition.onstart=()=>onStatus(true);recognition.onend=()=>onStatus(false);
    recognition.onresult=e=>onText(Array.from(e.results).map(r=>r[0].transcript).join(' '));
    recognition.onerror=e=>{onStatus(false);onError(e.error==='not-allowed'?'Permite el micrófono en el navegador para dictar.':'No pude escuchar el mensaje. Puedes escribirlo o intentar otra vez.');};
    try{recognition.start();}catch{onError('El micrófono no está disponible.');}
  },stop(){recognition?.abort();onStatus(false);}};
}
