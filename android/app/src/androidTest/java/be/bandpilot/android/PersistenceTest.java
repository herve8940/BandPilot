package be.bandpilot.android;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.webkit.WebView;
import android.view.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class PersistenceTest {
 private WebView web;
 private WebView find(View v){if(v instanceof WebView)return (WebView)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){WebView w=find(g.getChildAt(i));if(w!=null)return w;}}return null;}
 private String js(String script)throws Exception{CountDownLatch latch=new CountDownLatch(1);String[] result={null};InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.evaluateJavascript(script,s->{result[0]=s;latch.countDown();}));assertTrue(latch.await(20,TimeUnit.SECONDS));return result[0];}
 private void waitFor(String expression)throws Exception{for(int i=0;i<180;i++){if("true".equals(js(expression)))return;Thread.sleep(150);}fail("UI not ready: "+expression);}
 @Test public void survivesProcessRestartAndFitsTablet()throws Exception{
  Activity activity=InstrumentationRegistry.getInstrumentation().startActivitySync(new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web=find(activity.getWindow().getDecorView()));
  waitFor("!!document.querySelector('.studio')");
  js("document.querySelector('button[title=\"Régler le son\"]').click()");waitFor("!!document.querySelector('.coach-journey')");
  js("[...document.querySelectorAll('.coach-journey button')].find(b=>b.textContent.trim().endsWith('Dire qui est branché où')).click()");waitFor("[...document.querySelectorAll('.coach-input2 input')].some(i=>i.value==='Basse Éric')");
  assertEquals("true",js("document.documentElement.scrollWidth <= window.innerWidth+2"));
  CountDownLatch drawn=new CountDownLatch(1);
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.postVisualStateCallback(1,new WebView.VisualStateCallback(){@Override public void onComplete(long requestId){drawn.countDown();}}));
  assertTrue("WebView frame was not rendered",drawn.await(10,TimeUnit.SECONDS));
  InstrumentationRegistry.getInstrumentation().waitForIdleSync();Thread.sleep(500);
  File folder=activity.getExternalFilesDir("qa");folder.mkdirs();Bitmap screenshot=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
  try(FileOutputStream out=new FileOutputStream(new File(folder,"tablet-"+js("window.innerWidth")+".png"))){screenshot.compress(Bitmap.CompressFormat.PNG,100,out);}screenshot.recycle();
 }
}
