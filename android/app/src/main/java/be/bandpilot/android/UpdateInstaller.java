package be.bandpilot.android;
import android.app.Activity;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import org.json.JSONObject;
import java.io.*;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;

final class UpdateInstaller {
 static void verify(Context context,String version)throws Exception{
  File apk=UpdateProvider.apk(context),metadata=new File(apk.getParentFile(),"ready.json");
  JSONObject ready=new JSONObject(new String(Files.readAllBytes(metadata.toPath()),StandardCharsets.UTF_8));
  if(!version.equals(ready.getString("version"))||apk.length()!=ready.getLong("size"))throw new IOException("APK invalide.");
  MessageDigest hash=MessageDigest.getInstance("SHA-256");try(InputStream input=new FileInputStream(apk)){byte[] buffer=new byte[65536];int n;while((n=input.read(buffer))!=-1)hash.update(buffer,0,n);}
  StringBuilder hex=new StringBuilder();for(byte b:hash.digest())hex.append(String.format(Locale.ROOT,"%02x",b));
  if(!hex.toString().equals(ready.getString("sha256")))throw new IOException("Vérification APK échouée.");
  PackageManager pm=context.getPackageManager();
  PackageInfo installed=pm.getPackageInfo(context.getPackageName(),PackageManager.GET_SIGNATURES),next=pm.getPackageArchiveInfo(apk.getAbsolutePath(),PackageManager.GET_SIGNATURES);
  if(next==null||!installed.packageName.equals(next.packageName)||!version.equals(next.versionName)||(Build.VERSION.SDK_INT>=28?next.getLongVersionCode()<=installed.getLongVersionCode():next.versionCode<=installed.versionCode))throw new IOException("Version APK incompatible.");
  if(installed.signatures==null||next.signatures==null||installed.signatures.length==0||!new HashSet<>(Arrays.asList(installed.signatures)).equals(new HashSet<>(Arrays.asList(next.signatures))))throw new IOException("Signature APK incompatible.");
 }
 static void suspend()throws Exception{
  int port=EngineService.readyPort();if(port==0)throw new IOException("Moteur indisponible.");
  HttpURLConnection connection=(HttpURLConnection)new URL("http://127.0.0.1:"+port+"/api/android/suspend").openConnection();
  try{connection.setRequestMethod("POST");connection.setRequestProperty("X-BandPilot-Native-Token",EngineService.token);connection.setConnectTimeout(2000);connection.setReadTimeout(5000);if(connection.getResponseCode()!=200)throw new IOException("Suspension impossible.");}finally{connection.disconnect();}
 }
 static boolean needsPermission(Activity activity){
  if(activity.getPackageManager().canRequestPackageInstalls())return false;
  activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));return true;
 }
 static void launch(Activity activity){
  Uri uri=Uri.parse("content://"+activity.getPackageName()+".updates/update.apk");
  Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
  intent.setClipData(ClipData.newRawUri("BandPilot update",uri));activity.startActivity(intent);AndroidLog.event(activity,"update_installer_opened");
 }
}
