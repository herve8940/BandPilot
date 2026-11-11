package be.bandpilot.android;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.print.*;
import android.util.Base64;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.nio.file.Files;

public final class MainActivity extends Activity {
 private WebView web;
 private LinearLayout root;
 private TextView status;
 private final Handler ui=new Handler(Looper.getMainLooper());
 private String origin;
 private byte[] exportBytes;
 private String exportId;
 private ValueCallback<Uri[]> fileCallback;
 private boolean waiting=true;
 private boolean installing;
 @Override public void onCreate(Bundle state){
  super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(16,26,44));
  root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  status=new TextView(this);status.setTextColor(Color.WHITE);status.setTextSize(20);status.setPadding(24,40,24,24);status.setText("BandPilot\nDémarrage sur cette tablette…");root.addView(status);
  web=new WebView(this);web.setBackgroundColor(Color.rgb(16,26,44));web.setVisibility(View.GONE);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
  android.content.pm.PackageInfo provider=WebView.getCurrentWebViewPackage();
  try{if(provider==null||Integer.parseInt(provider.versionName.split("\\.")[0])<111){showFailure("Mets à jour Android System WebView (version 111 ou plus), puis rouvre BandPilot.");return;}}catch(Exception ignored){}
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setMediaPlaybackRequiresUserGesture(true);
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
  web.addJavascriptInterface(new NativeBridge(),"BandPilotAndroid");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){String url=request.getUrl().toString();if(origin!=null&&url.startsWith(origin+"/"))return false;if(request.isForMainFrame()&&request.hasGesture())openExternal(url);return true;}
   @Override public void onPageFinished(WebView view,String url){if(origin!=null&&url.startsWith(origin+"/")){status.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);}}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())showFailure("L’interface n’a pas pu démarrer. Ferme puis rouvre BandPilot.\n"+error.getDescription());}
   @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){AndroidLog.event(MainActivity.this,"renderer_stopped");showFailure("L’affichage Android s’est arrêté. Ferme puis rouvre BandPilot.");return true;}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setTitle("BandPilot").setMessage(message).setPositiveButton("OK",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setTitle("BandPilot").setMessage(message).setNegativeButton("Annuler",(d,w)->result.cancel()).setPositiveButton("Confirmer",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);try{startActivityForResult(intent,42);return true;}catch(Exception e){callback.onReceiveValue(null);fileCallback=null;return false;}}
   @Override public boolean onConsoleMessage(ConsoleMessage message){if(BuildConfig.DEBUG)android.util.Log.d("BandPilotWeb",message.message());return true;}
  });
  startForegroundService(new Intent(this,EngineService.class));
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},3);
  pollEngine(System.currentTimeMillis()+60000);
 }
 private void pollEngine(long deadline){
  if(isFinishing()||!waiting)return;
  if(EngineService.failure!=null){showFailure(EngineService.failure);return;}
  File error=EngineService.root==null?null:new File(EngineService.root,"startup-error.txt");
  if(error!=null&&error.exists()){try{showFailure("Le moteur n’a pas démarré :\n"+new String(Files.readAllBytes(error.toPath()), java.nio.charset.StandardCharsets.UTF_8).substring(0,(int)Math.min(error.length(),1500)));}catch(Exception e){showFailure("Démarrage impossible.");}return;}
  int port=EngineService.readyPort();
  if(port>0&&port<65536&&EngineService.token!=null){waiting=false;origin="http://127.0.0.1:"+port;CookieManager.getInstance().setCookie(origin,"bandpilot_native="+EngineService.token+"; Path=/; HttpOnly; SameSite=Strict",ok->web.loadUrl(origin+"/"));return;}
  if(System.currentTimeMillis()>deadline){showFailure("Le démarrage prend trop de temps. Ferme puis rouvre BandPilot.");return;}
  ui.postDelayed(()->pollEngine(deadline),250);
 }
 private void showFailure(String message){waiting=false;status.setText(message);status.setVisibility(View.VISIBLE);web.setVisibility(View.GONE);Button close=new Button(this);close.setText("Fermer BandPilot");close.setOnClickListener(v->quit());root.addView(close);}
 private void quit(){finishAndRemoveTask();startService(new Intent(this,EngineService.class).setAction("quit"));}
 private boolean trusted(){return origin!=null&&web.getUrl()!=null&&web.getUrl().startsWith(origin+"/");}
 private void answer(String id,JSONObject result){if(trusted())web.evaluateJavascript("window.__bandpilotAndroidResult?.("+JSONObject.quote(id)+","+result+")",null);}
 private JSONObject result(String key,Object value){JSONObject r=new JSONObject();try{r.put(key,value);}catch(Exception ignored){}return r;}
 private void openExternal(String url){try{Uri uri=Uri.parse(url);if("https".equals(uri.getScheme()))startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){new AlertDialog.Builder(this).setMessage("Aucun navigateur disponible.").setPositiveButton("OK",null).show();}}
 private final class NativeBridge {
  @JavascriptInterface public String getLanguage(){return getPreferences(MODE_PRIVATE).getString("language","fr");}
  @JavascriptInterface public boolean setLanguage(String language){if(!java.util.Arrays.asList("fr","en","it","es","de").contains(language))return false;return getPreferences(MODE_PRIVATE).edit().putString("language",language).commit();}
  @JavascriptInterface public void invoke(String action,String id,String json){
   if(id==null||id.length()>100||json==null||json.length()>16000000)return;
   ui.post(()->{if(!trusted())return;try{JSONObject input=new JSONObject(json);
    switch(action){
     case "save":
      if(exportId!=null)throw new IOException("Un enregistrement est déjà ouvert.");
      byte[] bytes=Base64.decode(input.getString("base64"),Base64.DEFAULT);if(bytes.length>10000000)throw new IOException("Fichier trop volumineux.");
      exportBytes=bytes;exportId=id;String name=input.optString("name","BandPilot.json").replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","-");
      Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(input.optString("mime","application/octet-stream")).putExtra(Intent.EXTRA_TITLE,name.substring(0,Math.min(name.length(),140)));startActivityForResult(save,41);break;
     case "installUpdate":
      if(installing)throw new IOException("Installation déjà en cours.");
      if(UpdateInstaller.needsPermission(MainActivity.this)){answer(id,result("permissionRequired",true));break;}
      installing=true;String version=input.getString("version");
      new Thread(()->{try{UpdateInstaller.verify(MainActivity.this,version);UpdateInstaller.suspend();ui.post(()->{installing=false;if(isDestroyed())return;try{UpdateInstaller.launch(MainActivity.this);answer(id,result("opened",true));}catch(Exception e){answer(id,result("error","Installation Android indisponible."));}});}catch(Exception e){AndroidLog.event(MainActivity.this,"update_install_error");ui.post(()->{installing=false;answer(id,result("error",String.valueOf(e.getMessage())));});}},"BandPilot-update").start();break;
     case "open":openExternal(input.getString("url"));answer(id,result("opened",true));break;
     case "clipboard":getSystemService(android.content.ClipboardManager.class).setPrimaryClip(ClipData.newPlainText("BandPilot",input.getString("text")));answer(id,result("copied",true));break;
     case "print":printDocument(id,input.getString("html"),input.optString("name","BandPilot"));break;
     default:throw new IOException("Commande Android inconnue.");
    }
   }catch(Exception e){exportId=null;exportBytes=null;answer(id,result("error",String.valueOf(e.getMessage())));}});
  }
 }
 private void printDocument(String id,String html,String name){
  if(html.length()>2000000){answer(id,result("error","Document trop volumineux."));return;}
  WebView document=new WebView(this);document.getSettings().setJavaScriptEnabled(false);document.getSettings().setAllowFileAccess(false);document.getSettings().setAllowContentAccess(false);
  document.setWebViewClient(new WebViewClient(){boolean printed;
   @Override public void onPageFinished(WebView view,String url){if(printed)return;printed=true;
    PrintJob job=getSystemService(PrintManager.class).print(name,document.createPrintDocumentAdapter(name),new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
    ui.postDelayed(new Runnable(){public void run(){if(job.isCompleted()||job.isCancelled()||job.isFailed()){answer(id,job.isCompleted()?result("saved",true):job.isFailed()?result("error","Impression impossible."):result("cancelled",true));document.destroy();}else ui.postDelayed(this,500);}},500);
   }
  });document.loadDataWithBaseURL(null,html,"text/html","UTF-8",null);
 }
 @Override protected void onActivityResult(int code,int resultCode,Intent data){super.onActivityResult(code,resultCode,data);
  if(code==42&&fileCallback!=null){fileCallback.onReceiveValue(resultCode==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
  if(code==41&&exportId!=null){String id=exportId;try{if(resultCode==RESULT_OK&&data!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData(),"wt")){if(out==null)throw new IOException("Fichier indisponible.");out.write(exportBytes);}answer(id,result("saved",true));}else answer(id,result("cancelled",true));}catch(Exception e){answer(id,result("error",String.valueOf(e.getMessage())));}finally{exportId=null;exportBytes=null;}}
 }
 @Override public void onBackPressed(){
  if(!trusted()){quit();return;}
  web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(!d)return false;if(d.dispatchEvent(new Event('cancel',{cancelable:true})))d.close();return true;})()",value->{if(!"true".equals(value))new AlertDialog.Builder(this).setTitle("Fermer BandPilot ?").setMessage("La console garde ses réglages. La connexion de cette tablette sera arrêtée.").setNegativeButton("Rester",null).setPositiveButton("Fermer",(d,w)->quit()).show();});
 }
 @Override protected void onDestroy(){ui.removeCallbacksAndMessages(null);if(fileCallback!=null)fileCallback.onReceiveValue(null);web.removeJavascriptInterface("BandPilotAndroid");web.destroy();super.onDestroy();}
}
