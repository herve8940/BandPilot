package be.bandpilot.android;
import android.app.Activity;
import android.content.Intent;
import android.webkit.WebView;
import android.view.ViewGroup;
import android.view.View;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AutonomousTest {
 private Activity activity;private WebView web;
 private WebView find(View v){if(v instanceof WebView)return (WebView)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){WebView w=find(g.getChildAt(i));if(w!=null)return w;}}return null;}
 private String js(String script)throws Exception{CountDownLatch latch=new CountDownLatch(1);String[] result={null};InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.evaluateJavascript(script,s->{result[0]=s;latch.countDown();}));assertTrue("JavaScript timeout",latch.await(15,TimeUnit.SECONDS));return result[0];}
 private void waitFor(String expression)throws Exception{for(int i=0;i<180;i++){if("true".equals(js(expression)))return;Thread.sleep(150);}fail("UI not ready: "+expression+"\n"+js("document.body.innerText.slice(-2500)"));}
 private JSONObject api(String endpoint,JSONObject body)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+EngineService.readyPort()+endpoint).openConnection();c.setRequestProperty("X-BandPilot-Native-Token",EngineService.token);c.setReadTimeout(30000);
  if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");c.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));}
  int code=c.getResponseCode();InputStream in=code<400?c.getInputStream():c.getErrorStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1)bytes.write(buffer,0,n);String text=bytes.toString("UTF-8");c.disconnect();assertTrue(endpoint+": "+text,code<400);return new JSONObject(text);
 }
 @Test public void offlineAppAndDirectUdp()throws Exception{
  Intent launch=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
  activity=InstrumentationRegistry.getInstrumentation().startActivitySync(launch);
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web=find(activity.getWindow().getDecorView()));
  waitFor("!!document.querySelector('.studio')");
  api("/api/connection",new JSONObject().put("mode","simulation").put("host","127.0.0.1").put("enableWrites",false));
  assertEquals("true",js("!!window.BandPilotAndroid && document.documentElement.dataset.platform==='android'"));
  assertEquals("false",js("[...document.querySelectorAll('.rail-space-btn')].some(b=>b.textContent.includes('Enregistrer et réécouter'))"));
  HttpURLConnection unauth=(HttpURLConnection)new URL("http://127.0.0.1:"+EngineService.readyPort()+"/api/status").openConnection();assertEquals(403,unauth.getResponseCode());unauth.disconnect();
  js("document.querySelector('button[title=\"Régler le son\"]').click()");waitFor("!!document.querySelector('.coach-journey')");
  js("[...document.querySelectorAll('.coach-journey button')].find(b=>b.textContent.trim().endsWith('Dire qui est branché où')).click()");waitFor("!!document.querySelector('.coach-inputs')");
  int before=Integer.parseInt(js("document.querySelectorAll('.coach-input2').length"));
  js("[...document.querySelectorAll('.coach-actions button')].find(b=>b.textContent.trim()==='Ajouter un instrument').click()");waitFor("document.querySelectorAll('.coach-input2').length==="+(before+1));
  js("(()=>{const row=[...document.querySelectorAll('.coach-input2')].at(-1),s=row.querySelectorAll('select')[1];s.value='bass-di';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  js("(()=>{const i=[...document.querySelectorAll('.coach-input2 input')].at(-1);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Basse Éric');i.dispatchEvent(new Event('input',{bubbles:true}));})()");
  waitFor("[...document.querySelectorAll('.coach-input2 input')].at(-1)?.value==='Basse Éric'");
  js("[...document.querySelectorAll('.coach-input2 .apply')].at(-1).click()");waitFor("!!document.querySelector('.coach-dialog[open]')");
  js("[...document.querySelectorAll('.coach-dialog button')].find(b=>b.textContent.trim()==='Essayer en simulation').click()");waitFor("!document.querySelector('.coach-dialog')&&!!document.querySelector('.coach-toast [role=status]')");
  JSONObject profile=api("/api/coach",null).getJSONObject("profile");JSONArray inputs=profile.getJSONArray("inputs");int channel=inputs.getJSONObject(inputs.length()-1).getInt("channel");assertEquals("Basse Éric",inputs.getJSONObject(inputs.length()-1).getString("name"));
  js("[...document.querySelectorAll('.coach-shortcuts button')].find(b=>b.textContent.trim()==='Ambiances des sources').click()");waitFor("!!document.querySelector('.vocal-kit fieldset')");
  js("[...document.querySelectorAll('.vocal-kit button')].find(b=>b.textContent.trim()==='Préparer mon ambiance').click()");waitFor("!!document.querySelector('.vocal-preview')");
  try(Mixer mixer=new Mixer()){
   JSONObject config=new JSONObject().put("mode","real").put("host","127.0.0.1").put("port",10024).put("enableWrites",true);
   api("/api/connection",config);JSONObject preview=api("/api/coach/prepare",new JSONObject().put("channel",channel));
   api("/api/coach/apply",new JSONObject().put("token",preview.getString("token")).put("confirm",true));
   assertEquals("Basse Eric",mixer.values.get(String.format(java.util.Locale.US,"/ch/%02d/config/name",channel)));
   assertTrue("No UDP writes",mixer.writes>5);
   api("/api/android/suspend",new JSONObject());assertFalse(api("/api/status",null).getBoolean("writesEnabled"));
   api("/api/connection",new JSONObject().put("mode","simulation").put("host","127.0.0.1").put("enableWrites",false));
  }
  assertTrue(api("/api/diagnostics/report",null).getJSONObject("app").getString("version").contains("android"));
  assertEquals("true",js("typeof window.bandpilotSupport.installUpdate==='function' && typeof window.bandpilotSupport.exportLogs==='function'"));
  js("document.querySelector('.support-open').click()");waitFor("!!document.querySelector('.support-dialog[open]')");
  js("[...document.querySelectorAll('.support-dialog button')].find(b=>b.textContent.trim()==='Afficher les logs').click()");waitFor("!!document.querySelector('.support-dialog pre')");
  assertTrue(js("document.querySelector('.support-dialog pre').textContent").contains("android.engine_start"));
  assertTrue(api("/api/android/update/status",null).has("automaticEnabled"));
  js("location.reload()");waitFor("!!document.querySelector('.studio')");
  assertEquals("Basse Éric",api("/api/coach",null).getJSONObject("profile").getJSONArray("inputs").getJSONObject(inputs.length()-1).getString("name"));
 }
 // Actual UDP sockets inside Android. No PC or physical mixer participates.
 static final class Mixer implements AutoCloseable{
  final DatagramSocket socket;final Thread worker;volatile boolean running=true;volatile int writes;final Map<String,Object> values=new ConcurrentHashMap<>();
  Mixer()throws Exception{socket=new DatagramSocket(10024,InetAddress.getByName("127.0.0.1"));worker=new Thread(()->{while(running)try{byte[] data=new byte[8192];DatagramPacket packet=new DatagramPacket(data,data.length);socket.receive(packet);ByteBuffer b=ByteBuffer.wrap(data,0,packet.getLength()).order(ByteOrder.BIG_ENDIAN);String address=string(b),tags=string(b);Object value=null;if(tags.length()>1){char t=tags.charAt(1);if(t=='s')value=string(b);else if(t=='f')value=b.getFloat();else if(t=='i')value=b.getInt();}
   byte[] reply;
   if(address.equals("/info")||address.equals("/xinfo"))reply=message(address,"127.0.0.1","Android fixture","XR18","1.18");
   else if(address.equals("/xremote")||address.startsWith("/subscribe"))continue;
   else{if(value!=null){values.put(address,value);writes++;}Object current=values.getOrDefault(address,address.endsWith("/config/name")?"":0f);reply=message(address,current);}
   socket.send(new DatagramPacket(reply,reply.length,packet.getAddress(),packet.getPort()));
  }catch(Exception e){if(running)throw new RuntimeException(e);}},"Android-OSC-fixture");worker.start();}
  static String string(ByteBuffer b){ByteArrayOutputStream out=new ByteArrayOutputStream();byte c;while((c=b.get())!=0)out.write(c);while(b.position()%4!=0)b.get();return new String(out.toByteArray(),StandardCharsets.UTF_8);}
  static void str(ByteArrayOutputStream b,String s)throws Exception{b.write(s.getBytes(StandardCharsets.UTF_8));b.write(0);while(b.size()%4!=0)b.write(0);}
  static byte[] message(String address,Object...args)throws Exception{ByteArrayOutputStream out=new ByteArrayOutputStream();str(out,address);String tags=",";for(Object value:args)tags+=value instanceof String?"s":value instanceof Integer?"i":"f";str(out,tags);for(Object value:args){if(value instanceof String)str(out,(String)value);else out.write(ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(value instanceof Integer?(Integer)value:Float.floatToIntBits(((Number)value).floatValue())).array());}return out.toByteArray();}
  public void close()throws Exception{running=false;socket.close();worker.join(2000);}
 }
}
