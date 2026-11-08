package be.bandpilot.android;

import android.app.*;
import android.content.*;
import android.content.res.AssetManager;
import android.net.*;
import android.net.wifi.WifiManager;
import android.os.*;
import android.util.Log;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.concurrent.*;

public final class EngineService extends Service {
 public static volatile File root;
 public static volatile String token;
 public static volatile String failure;
 private static boolean started;
 private ConnectivityManager connectivity;
 private ConnectivityManager.NetworkCallback callback;
 private Network activeNetwork;
 private final ExecutorService networkWorker=Executors.newSingleThreadExecutor();
 private WifiManager.WifiLock wifiLock;
 private WifiManager.MulticastLock multicastLock;
 private PowerManager.WakeLock wakeLock;
 static { System.loadLibrary("node"); System.loadLibrary("bandpilot"); }
 private static native int startNode(String[] arguments);
 @Override public IBinder onBind(Intent intent){return null;}
 @Override public void onCreate(){
  super.onCreate();root=new File(getFilesDir(),"bandpilot");root.mkdirs();
  // Clear the previous process's ready marker before the Activity can read it.
  if(!started)new File(root,"ready.json").delete();
  byte[] random=new byte[32];new SecureRandom().nextBytes(random);StringBuilder hex=new StringBuilder();for(byte b:random)hex.append(String.format("%02x",b));token=hex.toString();
  NotificationManager nm=getSystemService(NotificationManager.class);
  nm.createNotificationChannel(new NotificationChannel("console","Connexion à la console",NotificationManager.IMPORTANCE_LOW));
  PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  PendingIntent quit=PendingIntent.getService(this,1,new Intent(this,EngineService.class).setAction("quit"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  startForeground(1,new Notification.Builder(this,"console").setSmallIcon(be.bandpilot.android.R.drawable.ic_bandpilot).setContentTitle("BandPilot")
   .setContentText("Application autonome active sur cette tablette").setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"Fermer",quit).build()).build());
  WifiManager wifi=(WifiManager)getApplicationContext().getSystemService(WIFI_SERVICE);
  wifiLock=wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF,"BandPilot:console");wifiLock.acquire();
  multicastLock=wifi.createMulticastLock("BandPilot:discovery");multicastLock.acquire();
  wakeLock=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"BandPilot:engine");wakeLock.acquire();
  connectivity=getSystemService(ConnectivityManager.class);
  callback=new ConnectivityManager.NetworkCallback(){
   @Override public void onAvailable(Network n){refreshNetwork();}
   @Override public void onLost(Network n){refreshNetwork();}
   @Override public void onLinkPropertiesChanged(Network n,LinkProperties properties){refreshNetwork();}
  };
  connectivity.registerNetworkCallback(new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build(),callback);
  refreshNetwork();
  synchronized(EngineService.class){if(!started){started=true;new Thread(this::runEngine,"BandPilot-engine").start();}}
 }
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(intent!=null&&"quit".equals(intent.getAction())){
   networkWorker.execute(()->{suspendControl();new Handler(Looper.getMainLooper()).post(()->{stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();android.os.Process.killProcess(android.os.Process.myPid());});});
  }
  return START_NOT_STICKY;
 }
 private void refreshNetwork(){
  if(networkWorker.isShutdown())return;
  networkWorker.execute(()->{
   try{
    Network chosen=null;JSONObject interfaces=new JSONObject();
    for(Network n:connectivity.getAllNetworks()){
     NetworkCapabilities cap=connectivity.getNetworkCapabilities(n);
     if(cap!=null&&cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)){chosen=n;break;}
    }
    if(!java.util.Objects.equals(activeNetwork,chosen)&&readyPort()>0)suspendControl();
    if(chosen!=null){
     LinkProperties props=connectivity.getLinkProperties(chosen);JSONArray addresses=new JSONArray();
     if(props!=null)for(LinkAddress link:props.getLinkAddresses())if(link.getAddress() instanceof Inet4Address){
      int bits=link.getPrefixLength();long mask=bits==0?0:(0xffffffffL<<(32-bits))&0xffffffffL;
      String netmask=((mask>>>24)&255)+"."+((mask>>>16)&255)+"."+((mask>>>8)&255)+"."+(mask&255);
      addresses.put(new JSONObject().put("address",link.getAddress().getHostAddress()).put("netmask",netmask).put("family","IPv4").put("internal",false).put("cidr",link.toString()).put("mac","00:00:00:00:00:00"));
     }
     interfaces.put("wifi",addresses);
    }
    writeAtomic(new File(root,"network.json"),new JSONObject().put("interfaces",interfaces).toString());
    connectivity.bindProcessToNetwork(chosen);activeNetwork=chosen;
   }catch(Exception e){Log.w("BandPilot","Wi-Fi state unavailable",e);}
  });
 }
 private void suspendControl(){
  try{int port=readyPort();if(port==0)return;HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+port+"/api/android/suspend").openConnection();
   c.setRequestMethod("POST");c.setRequestProperty("X-BandPilot-Native-Token",token);c.setConnectTimeout(1500);c.setReadTimeout(3000);c.getInputStream().close();c.disconnect();
  }catch(Exception e){Log.w("BandPilot","Could not confirm engine suspension",e);}
 }
 public static int readyPort(){try{return new JSONObject(new String(Files.readAllBytes(new File(root,"ready.json").toPath()), java.nio.charset.StandardCharsets.UTF_8)).getInt("port");}catch(Exception e){return 0;}}
 private void runEngine(){
  try{
   new File(root,"ready.json").delete();new File(root,"startup-error.txt").delete();
   File runtime=new File(root,"runtime"),marker=new File(runtime,"revision.txt");
   String expected=BuildConfig.VERSION_NAME+"/"+BuildConfig.RUNTIME_REV;
   if(!marker.exists()||!new String(Files.readAllBytes(marker.toPath()), java.nio.charset.StandardCharsets.UTF_8).equals(expected)){
    File next=new File(root,"runtime-next");remove(next);copyAssets(getAssets(),"runtime",next);
    writeAtomic(new File(next,"revision.txt"),expected);remove(runtime);
    if(!next.renameTo(runtime))throw new IOException("Installation interne impossible");
   }
   int exit=startNode(new String[]{"node",new File(runtime,"bootstrap.cjs").getAbsolutePath(),root.getAbsolutePath(),token});
   failure="Le moteur BandPilot s’est arrêté ("+exit+"). Ferme puis rouvre l’application.";
  }catch(Throwable e){failure="Démarrage impossible : "+e.getMessage();Log.e("BandPilot","Engine startup failed",e);}
 }
 private static void copyAssets(AssetManager assets,String source,File target)throws IOException{
  String[] children=assets.list(source);if(children!=null&&children.length>0){target.mkdirs();for(String child:children)copyAssets(assets,source+"/"+child,new File(target,child));}
  else{target.getParentFile().mkdirs();try(InputStream input=assets.open(source);OutputStream output=new FileOutputStream(target)){byte[] buf=new byte[32768];int n;while((n=input.read(buf))!=-1)output.write(buf,0,n);}}
 }
 private static void remove(File f){File[] children=f.listFiles();if(children!=null)for(File c:children)remove(c);f.delete();}
 private static void writeAtomic(File file,String data)throws IOException{
  File temp=new File(file.getPath()+".tmp");try(FileOutputStream out=new FileOutputStream(temp)){out.write(data.getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
  if(!temp.renameTo(file))throw new IOException("Enregistrement impossible");
 }
 @Override public void onDestroy(){
  if(callback!=null)connectivity.unregisterNetworkCallback(callback);
  if(wifiLock!=null&&wifiLock.isHeld())wifiLock.release();if(multicastLock!=null&&multicastLock.isHeld())multicastLock.release();
  if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();networkWorker.shutdown();super.onDestroy();
 }
}
