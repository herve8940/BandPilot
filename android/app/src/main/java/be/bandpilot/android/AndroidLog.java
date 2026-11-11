package be.bandpilot.android;
import android.content.Context;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

/** Event codes and non-personal platform versions only; never log credentials or raw exceptions. */
final class AndroidLog {
 static synchronized void event(Context context,String event){try{
  File file=new File(context.getFilesDir(),"bandpilot/data/logs/android.log");file.getParentFile().mkdirs();
  if(file.length()>262144){File previous=new File(file.getPath()+".1");previous.delete();file.renameTo(previous);}
  SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT);format.setTimeZone(TimeZone.getTimeZone("UTC"));
  JSONObject line=new JSONObject().put("time",format.format(new Date())).put("event","android."+event).put("api",android.os.Build.VERSION.SDK_INT).put("version",BuildConfig.VERSION_NAME);
  try(FileOutputStream out=new FileOutputStream(file,true)){out.write((line+"\n").getBytes(StandardCharsets.UTF_8));}
 }catch(Exception ignored){}}
}
