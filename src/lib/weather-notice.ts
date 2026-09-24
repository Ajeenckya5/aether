/** Shows a saved-weather line when the page reloads with no network. */
export const WEATHER_BOOT =
  '(function(){function show(){try{if(navigator.onLine)return;if(!localStorage.getItem("aether-env-cache-v1"))return;if(document.getElementById("aether-saved-weather"))return;var p=document.createElement("p");p.id="aether-saved-weather";p.textContent="Saved weather from this phone.";document.body.appendChild(p);}catch(e){}}if(document.body)show();else document.addEventListener("DOMContentLoaded",show);window.addEventListener("offline",show);})();';
