const languageCodes=['fr','en','it','es','de'];
const normalizeLanguage=value=>languageCodes.includes(value)?value:'fr';
const labels={
 it:{Connection:'Connessione','Detect and connect my mixer':'Rileva e collega il mio mixer','About BandPilot':'Informazioni su BandPilot',Quit:'Esci',View:'Visualizza',Reload:'Ricarica','Toggle full screen':'Schermo intero',Cancel:'Annulla',Confirm:'Conferma','BandPilot — unable to start':'BandPilot — avvio non riuscito','The local BandPilot server did not start.':'Il server locale di BandPilot non si è avviato.'},
 es:{Connection:'Conexión','Detect and connect my mixer':'Detectar y conectar mi mesa','About BandPilot':'Acerca de BandPilot',Quit:'Salir',View:'Ver',Reload:'Recargar','Toggle full screen':'Pantalla completa',Cancel:'Cancelar',Confirm:'Confirmar','BandPilot — unable to start':'BandPilot — no se puede iniciar','The local BandPilot server did not start.':'El servidor local de BandPilot no se ha iniciado.'},
 de:{Connection:'Verbindung','Detect and connect my mixer':'Mein Mischpult suchen und verbinden','About BandPilot':'Über BandPilot',Quit:'Beenden',View:'Ansicht',Reload:'Neu laden','Toggle full screen':'Vollbild',Cancel:'Abbrechen',Confirm:'Bestätigen','BandPilot — unable to start':'BandPilot — Start fehlgeschlagen','The local BandPilot server did not start.':'Der lokale BandPilot-Server wurde nicht gestartet.'}
};
const label=(language,fr,en)=>language==='fr'?fr:labels[language]?.[en]??en;
module.exports={languageCodes,normalizeLanguage,label,labels};
