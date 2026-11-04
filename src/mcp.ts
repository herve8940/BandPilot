import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { StudioDatabase } from "./database.js";

/**
 * Local read-only MCP server.
 * Never opens an OSC socket, never sends XR18 hardware commands.
 * Uses the same SQLite database as BandPilot when XR18_DB_PATH is configured.
 */
const db = new StudioDatabase();
const server = new McpServer({ name: "xr18-studio", version: "0.1.0" });
const result = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }]
});
server.tool("studio_list_songs", "Liste les morceaux enregistrés dans BandPilot.", {}, async () =>
  result({ songs: db.listSongs(), source: "local SQLite" })
);
server.tool("studio_list_setlists", "Liste les setlists et leur ordre de morceaux.", {}, async () =>
  result({ setlists: db.listSetlists(), source: "local SQLite" })
);
server.tool("studio_list_rehearsals", "Liste les répétitions et notes sauvegardées.", {}, async () =>
  result({ rehearsals: db.listRehearsals(), source: "local SQLite" })
);
server.tool("studio_list_ear_profiles", "Consulte les profils in-ear préparés, sans commander la console.", {}, async () =>
  result({ profiles: db.listEarProfiles(), simulationOnly: true, hardwareWrite: false })
);
server.tool(
  "studio_get_setlist",
  "Consulte une setlist par identifiant, avec les morceaux correspondants.",
  { id: z.string().uuid() },
  async ({ id }) => {
    const setlist = db.listSetlists().find(s => s.id === id);
    if (!setlist) return { isError: true, content: [{ type: "text" as const, text: "Setlist introuvable" }] };
    const songs = db.listSongs();
    return result({ ...setlist, songs: setlist.songIds.map(songId => songs.find(s => s.id === songId) ?? { id: songId, missing: true }) });
  }
);

// MCP is an authenticated HTTP client of the unique Studio engine; never a second OSC engine.
const base=process.env.XR18_STUDIO_URL??'http://127.0.0.1:3000';
const endpoint=new URL(base);
if(endpoint.protocol!=='http:'||!['localhost','127.0.0.1'].includes(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw Error('URL HTTP locale BandPilot requise');
let cookie='';
async function bridge(path:string,method='GET',data?:unknown):Promise<any>{
 const request=async()=>fetch(base.replace(/\/$/,'')+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(120000)});
 let response=await request();
 if(response.status===401&&process.env.XR18_STUDIO_USER&&process.env.XR18_STUDIO_PASSWORD){const login=await fetch(base.replace(/\/$/,'')+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:process.env.XR18_STUDIO_USER,password:process.env.XR18_STUDIO_PASSWORD})});if(!login.ok)throw Error('Authentification MCP refusée');cookie=login.headers.get('set-cookie')?.split(';')[0]??'';response=await request();}
 const value=await response.json();if(!response.ok)throw Error(value.error??'API refusée');return value;
}
const confirmed=z.boolean().describe('Doit être true après accord explicite de l’utilisateur');
server.tool('studio_console_status','État de connexion et paramètres autorisés.',{},async()=>result(await bridge('/api/status')));
server.tool('studio_console_parameters','Catalogue et valeurs reçues. Valeurs en unités physiques.',{prefix:z.string().min(3).max(100)},async({prefix})=>result(await bridge('/api/console/parameters?prefix='+encodeURIComponent(prefix))));
server.tool('studio_refresh_parameters','Lire un groupe de paramètres depuis la console.',{prefix:z.string().min(3).max(100)},async({prefix})=>result(await bridge('/api/console/refresh','POST',{prefix})));
server.tool('studio_preview_parameters','Prévisualiser des changements typés, en dB, Hz, ms ou options. Aucun réglage modifié.',{values:z.record(z.string(),z.union([z.number(),z.string()]))},async({values})=>result(await bridge('/api/console/preview','POST',{values})));
server.tool('studio_apply_parameters','Appliquer une prévisualisation après accord explicite, sauvegarde et comparaison OSC.',{token:z.string().uuid(),confirm:confirmed,allowPhantom:z.boolean().default(false)},async({token,confirm,allowPhantom})=>{if(!confirm)throw Error('Confirmation requise');return result(await bridge('/api/console/apply','POST',{token,confirm,allowPhantom}));});
server.tool('studio_save_complete_scene','Capturer tous les paramètres et FX dans une scène persistante.',{name:z.string().min(1).max(120),excludePhantom:z.boolean().default(false)},async({name,excludePhantom})=>result(await bridge('/api/library','POST',{kind:'scene',name,complete:true,excludePhantom})));
server.tool('studio_list_presets','Scènes, FX et associations ReaCue sauvegardés.',{},async()=>result(await bridge('/api/library')));
server.tool('studio_preview_preset','Comparer une scène ou un FX avant rappel.',{id:z.string().uuid()},async({id})=>result(await bridge('/api/library/'+id+'/preview','POST',{})));
server.tool('studio_apply_preset','Rappeler une scène ou un FX après confirmation explicite.',{id:z.string().uuid(),token:z.string().uuid(),confirm:confirmed,allowPhantom:z.boolean().default(false)},async({id,token,confirm,allowPhantom})=>{if(!confirm)throw Error('Confirmation requise');return result(await bridge('/api/library/'+id+'/apply','POST',{token,confirm,allowPhantom}));});
server.tool('studio_monitor_level','Régler un envoi de retour autorisé, plafond 0,75 et variation contrôlée.',{bus:z.number().int().min(1).max(6),channel:z.number().int().min(1).max(16),value:z.number().min(0).max(.75),confirm:confirmed},async({bus,channel,value,confirm})=>{if(!confirm)throw Error('Confirmation requise');return result(await bridge(`/api/monitor/${bus}/channels/${channel}`,'POST',{value}));});
server.tool('studio_stop_reacue','Arrêter immédiatement les automatismes ReaCue.',{},async()=>result(await bridge('/api/reacue/stop','POST',{})));
process.on("SIGINT", () => { db.close(); process.exit(0); });
const transport = new StdioServerTransport();
await server.connect(transport);

