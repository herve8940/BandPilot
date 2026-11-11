package be.bandpilot.android;
import android.content.Context;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class UpdateSafetyTest {
 @Test public void installerRejectsReinstallAndCorruptionAndProviderIsReadOnly()throws Exception{
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();File apk=UpdateProvider.apk(context),metadata=new File(apk.getParentFile(),"ready.json");apk.getParentFile().mkdirs();
  try{
   Files.copy(new File(context.getApplicationInfo().sourceDir).toPath(),apk.toPath(),StandardCopyOption.REPLACE_EXISTING);
   MessageDigest hash=MessageDigest.getInstance("SHA-256");try(InputStream input=new FileInputStream(apk)){byte[] b=new byte[65536];int n;while((n=input.read(b))!=-1)hash.update(b,0,n);}
   StringBuilder hex=new StringBuilder();for(byte b:hash.digest())hex.append(String.format(Locale.ROOT,"%02x",b));
   JSONObject ready=new JSONObject().put("version",BuildConfig.VERSION_NAME).put("size",apk.length()).put("sha256",hex.toString());Files.write(metadata.toPath(),ready.toString().getBytes(StandardCharsets.UTF_8));
   try{UpdateInstaller.verify(context,BuildConfig.VERSION_NAME);fail("Reinstallation accepted");}catch(IOException expected){assertTrue(expected.getMessage(),expected.getMessage().contains("incompatible"));}
   ready.put("sha256",new String(new char[64]).replace('\0','0'));Files.write(metadata.toPath(),ready.toString().getBytes(StandardCharsets.UTF_8));
   try{UpdateInstaller.verify(context,BuildConfig.VERSION_NAME);fail("Corrupted APK accepted");}catch(IOException expected){assertTrue(expected.getMessage(),expected.getMessage().contains("échouée"));}
   Uri uri=Uri.parse("content://"+context.getPackageName()+".updates/update.apk");
   assertEquals("application/vnd.android.package-archive",context.getContentResolver().getType(uri));
   try{context.getContentResolver().openFileDescriptor(uri,"w");fail("Writable provider");}catch(SecurityException expected){}
   try{context.getContentResolver().openFileDescriptor(Uri.parse("content://"+context.getPackageName()+".updates/../preferences.json"),"r");fail("Arbitrary file exposed");}catch(SecurityException expected){}
  }finally{apk.delete();metadata.delete();}
 }
}
