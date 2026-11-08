#import "BPViewController.h"
#import "BPNodeEngine.h"
#import <Network/Network.h>

@interface BPPageRenderer : UIPrintPageRenderer
@end
@implementation BPPageRenderer
- (CGRect)paperRect {return CGRectMake(0,0,595.28,841.89);}
- (CGRect)printableRect {return CGRectInset(self.paperRect,24,24);}
@end

@interface BPViewController () <WKNavigationDelegate,WKUIDelegate,WKScriptMessageHandler>
@property(nonatomic,strong,readwrite) WKWebView *web;
@property(nonatomic,strong) UILabel *status;
@property(nonatomic,strong) UIButton *retry;
@property(nonatomic,strong) WKWebView *printWeb;
@property(nonatomic,copy) NSString *printID;
@property(nonatomic,copy) NSString *printName;
@property(nonatomic,strong) NSURL *storeURL;
@property(nonatomic,strong) nw_path_monitor_t monitor;
@property(nonatomic) BOOL receivedNetworkPath;
@property(nonatomic) BOOL loaded;
@property(nonatomic) BOOL loading;
@property(nonatomic) BOOL locked;
@property(nonatomic) NSUInteger resumeGeneration;
@end
@implementation BPViewController
- (void)viewDidLoad {
 [super viewDidLoad];self.view.backgroundColor=[UIColor colorWithRed:0.06 green:0.10 blue:0.17 alpha:1];
 self.status=[UILabel new];self.status.textColor=UIColor.whiteColor;self.status.numberOfLines=0;self.status.textAlignment=NSTextAlignmentCenter;self.status.font=[UIFont preferredFontForTextStyle:UIFontTextStyleTitle2];self.status.text=@"BandPilot\nDémarrage sur cet iPad…";
 self.retry=[UIButton buttonWithType:UIButtonTypeSystem];[self.retry setTitle:@"Réessayer" forState:UIControlStateNormal];[self.retry addTarget:self action:@selector(resumeSafely) forControlEvents:UIControlEventTouchUpInside];self.retry.hidden=YES;
 WKWebViewConfiguration *config=[WKWebViewConfiguration new];config.preferences.javaScriptCanOpenWindowsAutomatically=NO;
 config.defaultWebpagePreferences.allowsContentJavaScript=YES;config.websiteDataStore=WKWebsiteDataStore.defaultDataStore;
 [config.userContentController addScriptMessageHandler:self name:@"bandpilot"];
 NSString *language=[NSUserDefaults.standardUserDefaults stringForKey:@"language"]?:@"fr";
 if(![@[@"fr",@"en",@"it",@"es",@"de"] containsObject:language])language=@"fr";
 NSString *script=[NSString stringWithFormat:@"(()=>{let language='%@';window.BandPilotIOS={getLanguage:()=>language,setLanguage:v=>{if(!['fr','en','it','es','de'].includes(v))return false;language=v;window.webkit.messageHandlers.bandpilot.postMessage({action:'language',id:'language',json:JSON.stringify({language:v})});return true;},invoke:(action,id,json)=>window.webkit.messageHandlers.bandpilot.postMessage({action,id,json})};})();",language];
 [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:script injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
 self.web=[[WKWebView alloc] initWithFrame:CGRectZero configuration:config];self.web.navigationDelegate=self;self.web.UIDelegate=self;self.web.opaque=NO;self.web.backgroundColor=self.view.backgroundColor;self.web.hidden=YES;self.web.accessibilityIdentifier=@"BandPilotWeb";
 for(UIView *v in @[self.web,self.status,self.retry]){v.translatesAutoresizingMaskIntoConstraints=NO;[self.view addSubview:v];}
 UILayoutGuide *g=self.view.safeAreaLayoutGuide;
 [NSLayoutConstraint activateConstraints:@[[self.web.leadingAnchor constraintEqualToAnchor:g.leadingAnchor],[self.web.trailingAnchor constraintEqualToAnchor:g.trailingAnchor],[self.web.topAnchor constraintEqualToAnchor:g.topAnchor],[self.web.bottomAnchor constraintEqualToAnchor:g.bottomAnchor],[self.status.centerYAnchor constraintEqualToAnchor:g.centerYAnchor],[self.status.leadingAnchor constraintEqualToAnchor:g.leadingAnchor constant:24],[self.status.trailingAnchor constraintEqualToAnchor:g.trailingAnchor constant:-24],[self.retry.centerXAnchor constraintEqualToAnchor:g.centerXAnchor],[self.retry.topAnchor constraintEqualToAnchor:self.status.bottomAnchor constant:20]]];
 [[BPNodeEngine shared] start];[self poll:[NSDate dateWithTimeIntervalSinceNow:60]];
 self.monitor=nw_path_monitor_create();__weak BPViewController *weak=self;
 nw_path_monitor_set_update_handler(self.monitor,^(nw_path_t path){
  // Wi-Fi can change while the interface name and reachability stay identical.
  dispatch_async(dispatch_get_main_queue(),^{BPViewController *s=weak;if(!s)return;BOOL changed=s.receivedNetworkPath;s.receivedNetworkPath=YES;if(changed)[s lockInterface];if(changed&&s.loaded&&UIApplication.sharedApplication.applicationState==UIApplicationStateActive)[s resumeSafely];});
 });nw_path_monitor_set_queue(self.monitor,dispatch_get_global_queue(QOS_CLASS_UTILITY,0));nw_path_monitor_start(self.monitor);
}
- (void)failure:(NSString *)text {self.loading=NO;self.status.text=text;self.status.hidden=NO;self.web.hidden=YES;self.retry.hidden=NO;self.web.userInteractionEnabled=NO;}
- (void)poll:(NSDate *)deadline {
 self.loading=YES;
 BPNodeEngine *engine=BPNodeEngine.shared;
 NSString *error=[NSString stringWithContentsOfFile:[engine.root stringByAppendingPathComponent:@"startup-error.txt"] encoding:NSUTF8StringEncoding error:nil];
 if(engine.failure||error.length){[self failure:engine.failure?:[NSString stringWithFormat:@"Démarrage impossible.\n%@",[error substringToIndex:MIN(error.length,800)]]];return;}
 NSURL *origin=engine.origin;
 if(origin){
  self.loading=YES;NSHTTPCookie *cookie=[NSHTTPCookie cookieWithProperties:@{NSHTTPCookieName:@"bandpilot_native",NSHTTPCookieValue:engine.token,NSHTTPCookieDomain:@"127.0.0.1",NSHTTPCookiePath:@"/",@"HttpOnly":@"TRUE",@"SameSite":@"Strict"}];
  [self.web.configuration.websiteDataStore.httpCookieStore setCookie:cookie completionHandler:^{[self.web loadRequest:[NSURLRequest requestWithURL:origin]];}];return;
 }
 if(deadline.timeIntervalSinceNow<0){[self failure:@"Le démarrage prend trop de temps. Ferme puis rouvre BandPilot."];return;}
 dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(0.2*NSEC_PER_SEC)),dispatch_get_main_queue(),^{[self poll:deadline];});
}
- (BOOL)trustedURL:(NSURL *)url {NSURL *origin=BPNodeEngine.shared.origin;return origin&&[url.scheme isEqual:@"http"]&&[url.host isEqual:origin.host]&&[url.port isEqual:origin.port];}
- (void)lockInterface {self.resumeGeneration++;self.locked=YES;self.web.userInteractionEnabled=NO;}
- (void)resumeSafely {
 if(!self.loaded){if(!self.loading)[self poll:[NSDate dateWithTimeIntervalSinceNow:60]];return;}[self lockInterface];
 NSUInteger generation=self.resumeGeneration;self.status.text=@"Reconnexion…";self.status.hidden=NO;self.retry.hidden=YES;
 [BPNodeEngine.shared suspend:^(BOOL ok){if(generation!=self.resumeGeneration)return;if(!ok){[self failure:@"Le moteur ne répond pas. Réessaie ou ferme puis rouvre BandPilot."];return;}
  self.locked=NO;self.loading=YES;self.web.hidden=YES;
  // Reload avoids replaying a stale preview after iOS suspended the WebView.
  [self.web reload];
 }];
}
- (void)webView:(WKWebView *)web decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))decision {
 if(web==self.printWeb){decision([action.request.URL.scheme isEqual:@"about"]?WKNavigationActionPolicyAllow:WKNavigationActionPolicyCancel);return;}
 if([self trustedURL:action.request.URL]){decision(WKNavigationActionPolicyAllow);return;}
 if(action.navigationType==WKNavigationTypeLinkActivated&&[action.request.URL.scheme isEqual:@"https"])[UIApplication.sharedApplication openURL:action.request.URL options:@{} completionHandler:nil];
 decision(WKNavigationActionPolicyCancel);
}
- (void)webView:(WKWebView *)web didFinishNavigation:(WKNavigation *)navigation {
 if(web==self.printWeb){[self finishPDF];return;}
 BOOL firstLoad=!self.loaded;
 self.loaded=YES;self.loading=NO;self.status.hidden=YES;self.retry.hidden=YES;self.web.hidden=NO;self.web.userInteractionEnabled=!self.locked;
 if(firstLoad&&self.locked&&UIApplication.sharedApplication.applicationState==UIApplicationStateActive)[self resumeSafely];
}
- (void)webView:(WKWebView *)web didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
 if(web==self.printWeb){[self answer:self.printID result:@{@"error":@"Le document PDF n’a pas pu être préparé."}];[self clearPrint];return;}
 self.loading=NO;[self failure:@"L’interface n’a pas pu démarrer. Réessaie ou ferme puis rouvre BandPilot."];
}
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)web {[self resumeSafely];}
- (void)answer:(NSString *)identifier result:(NSDictionary *)result {
 if(!identifier||![self trustedURL:self.web.URL])return;
 NSData *json=[NSJSONSerialization dataWithJSONObject:@[identifier,result] options:0 error:nil];
 NSString *script=[NSString stringWithFormat:@"window.__bandpilotIOSResult?.(...%@)",[[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding]];
 [self.web evaluateJavaScript:script completionHandler:nil];
}
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
 NSURL *origin=BPNodeEngine.shared.origin;WKSecurityOrigin *source=message.frameInfo.securityOrigin;
 if(!message.frameInfo.mainFrame||![source.protocol isEqual:@"http"]||![source.host isEqual:@"127.0.0.1"]||source.port!=origin.port.integerValue||![self trustedURL:self.web.URL]||![message.body isKindOfClass:NSDictionary.class])return;
 NSDictionary *m=message.body;NSString *action=m[@"action"],*identifier=m[@"id"],*json=m[@"json"];
 if(![action isKindOfClass:NSString.class]||![identifier isKindOfClass:NSString.class]||identifier.length>100||![json isKindOfClass:NSString.class]||json.length>16000000)return;
 NSDictionary *input=[NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
 if(![input isKindOfClass:NSDictionary.class]){[self answer:identifier result:@{@"error":@"Demande invalide."}];return;}
 NSString *(^value)(NSString *)=^NSString *(NSString *key){return [input[key] isKindOfClass:NSString.class]?input[key]:nil;};
 if([action isEqual:@"language"]){NSString *v=value(@"language");if([@[@"fr",@"en",@"it",@"es",@"de"] containsObject:v])[NSUserDefaults.standardUserDefaults setObject:v forKey:@"language"];return;}
 if([action isEqual:@"open"]){NSURL *url=[NSURL URLWithString:value(@"url")?:@""];if(![url.scheme isEqual:@"https"]){[self answer:identifier result:@{@"error":@"Lien non autorisé."}];return;}[UIApplication.sharedApplication openURL:url options:@{} completionHandler:^(BOOL ok){[self answer:identifier result:ok?@{@"opened":@YES}:@{@"error":@"Le lien n’a pas pu être ouvert."}];}];return;}
 if([action isEqual:@"clipboard"]){NSString *text=value(@"text");if(text&&text.length<=2000000){UIPasteboard.generalPasteboard.string=text;[self answer:identifier result:@{@"copied":@YES}];}else [self answer:identifier result:@{@"error":@"Rapport invalide."}];return;}
 if([action isEqual:@"save"]){NSData *data=[[NSData alloc] initWithBase64EncodedString:value(@"base64")?:@"" options:0];if(!data||data.length>10000000){[self answer:identifier result:@{@"error":@"Fichier invalide ou trop volumineux."}];return;}[self share:data name:value(@"name")?:@"BandPilot.json" identifier:identifier];return;}
 if([action isEqual:@"print"]){NSString *html=value(@"html");if(!html||html.length>2000000||self.printWeb||self.presentedViewController){[self answer:identifier result:@{@"error":@"Un export est déjà ouvert ou le document est trop volumineux."}];return;}
  self.printID=identifier;self.printName=value(@"name")?:@"BandPilot.pdf";WKWebViewConfiguration *c=[WKWebViewConfiguration new];c.defaultWebpagePreferences.allowsContentJavaScript=NO;
  self.printWeb=[[WKWebView alloc] initWithFrame:CGRectMake(0,0,595.28,841.89) configuration:c];self.printWeb.navigationDelegate=self;
  [self.printWeb loadHTMLString:[@"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:\">" stringByAppendingString:html] baseURL:nil];return;
 }
 if([action isEqual:@"checkUpdate"]){[self checkUpdate:identifier];return;}
 if([action isEqual:@"openUpdate"]){if(self.storeURL)[UIApplication.sharedApplication openURL:self.storeURL options:@{} completionHandler:^(BOOL ok){[self answer:identifier result:@{@"opened":@(ok)}];}];else [self answer:identifier result:@{@"error":@"Aucune mise à jour App Store disponible."}];return;}
 [self answer:identifier result:@{@"error":@"Commande iPad inconnue."}];
}
- (void)share:(NSData *)data name:(NSString *)name identifier:(NSString *)identifier {
 if(self.presentedViewController){[self answer:identifier result:@{@"error":@"Ferme le partage en cours avant de recommencer."}];return;}
 NSString *safe=[[name.lastPathComponent componentsSeparatedByCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/\\:*?\"<>|\n\r"]] componentsJoinedByString:@"-"];
 if(!safe.length)safe=@"BandPilot.json";safe=[safe substringToIndex:MIN(safe.length,140)];
 NSURL *dir=[NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString] isDirectory:YES];
 NSError *error=nil;[NSFileManager.defaultManager createDirectoryAtURL:dir withIntermediateDirectories:YES attributes:nil error:&error];NSURL *file=[dir URLByAppendingPathComponent:safe];
 if(error||![data writeToURL:file options:NSDataWritingAtomic error:&error]){[self answer:identifier result:@{@"error":error.localizedDescription?:@"Export impossible."}];return;}
 UIActivityViewController *sheet=[[UIActivityViewController alloc] initWithActivityItems:@[file] applicationActivities:nil];sheet.popoverPresentationController.sourceView=self.view;sheet.popoverPresentationController.sourceRect=CGRectMake(self.view.bounds.size.width/2,self.view.bounds.size.height/2,1,1);
 sheet.completionWithItemsHandler=^(UIActivityType type,BOOL completed,NSArray *items,NSError *error){[self answer:identifier result:error?@{@"error":error.localizedDescription}:completed?@{@"saved":@YES}:@{@"cancelled":@YES}];[NSFileManager.defaultManager removeItemAtURL:dir error:nil];};
 [self presentViewController:sheet animated:YES completion:nil];
}
- (void)finishPDF {
 BPPageRenderer *renderer=[BPPageRenderer new];[renderer addPrintFormatter:self.printWeb.viewPrintFormatter startingAtPageAtIndex:0];
 NSInteger pages=renderer.numberOfPages;if(pages<1||pages>100){[self answer:self.printID result:@{@"error":@"Le document contient trop de pages ou est vide."}];[self clearPrint];return;}
 NSMutableData *pdf=[NSMutableData new];UIGraphicsBeginPDFContextToData(pdf,renderer.paperRect,nil);
 for(NSInteger page=0;page<pages;page++){UIGraphicsBeginPDFPage();[renderer drawPageAtIndex:page inRect:renderer.paperRect];}UIGraphicsEndPDFContext();
 NSString *name=self.printName,*identifier=self.printID;[self clearPrint];[self share:pdf name:[name.pathExtension.lowercaseString isEqual:@"pdf"]?name:[name stringByAppendingString:@".pdf"] identifier:identifier];
}
- (void)clearPrint {self.printWeb.navigationDelegate=nil;[self.printWeb stopLoading];self.printWeb=nil;self.printID=nil;self.printName=nil;}
- (void)checkUpdate:(NSString *)identifier {
 // App Store updates only: never fetch/install executable code or arbitrary IPAs.
 NSString *bundle=NSBundle.mainBundle.bundleIdentifier;
 NSURL *url=[NSURL URLWithString:[NSString stringWithFormat:@"https://itunes.apple.com/lookup?bundleId=%@",bundle]];
 NSMutableURLRequest *r=[NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:8];
 [[[NSURLSession sharedSession] dataTaskWithRequest:r completionHandler:^(NSData *data,NSURLResponse *response,NSError *error){
  NSDictionary *json=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;NSArray *results=[json[@"results"] isKindOfClass:NSArray.class]?json[@"results"]:nil;
  NSDictionary *app=results.count&&[results.firstObject isKindOfClass:NSDictionary.class]?results.firstObject:nil;
  NSString *version=[app[@"version"] isKindOfClass:NSString.class]?app[@"version"]:nil;
  NSNumber *track=[app[@"trackId"] isKindOfClass:NSNumber.class]?app[@"trackId"]:nil;
  BOOL valid=[app[@"bundleId"] isEqual:bundle]&&version.length&&track.longLongValue>0;
  NSString *current=[NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  BOOL available=valid&&[version compare:current options:NSNumericSearch]==NSOrderedDescending;
  dispatch_async(dispatch_get_main_queue(),^{
   if(error||[(NSHTTPURLResponse *)response statusCode]!=200||!json){[self answer:identifier result:@{@"error":@"Recherche App Store indisponible. Tu peux continuer ta session hors ligne."}];return;}
   self.storeURL=available?[NSURL URLWithString:[NSString stringWithFormat:@"https://apps.apple.com/app/id%@",track]]:nil;
   [self answer:identifier result:@{@"available":@(available),@"version":version?:current,@"message":valid?@"Les mises à jour iPad sont distribuées par l’App Store.":@"Cette version iPad n’est pas encore publiée sur l’App Store."}];
  });
 }] resume];
}
- (void)webView:(WKWebView *)web runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completion {
 if(self.presentedViewController){completion();return;}UIAlertController *alert=[UIAlertController alertControllerWithTitle:@"BandPilot" message:message preferredStyle:UIAlertControllerStyleAlert];[alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){completion();}]];[self presentViewController:alert animated:YES completion:nil];
}
- (void)webView:(WKWebView *)web runJavaScriptConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL))completion {
 if(self.presentedViewController){completion(NO);return;}UIAlertController *alert=[UIAlertController alertControllerWithTitle:@"BandPilot" message:message preferredStyle:UIAlertControllerStyleAlert];[alert addAction:[UIAlertAction actionWithTitle:@"Annuler" style:UIAlertActionStyleCancel handler:^(UIAlertAction *a){completion(NO);}]];[alert addAction:[UIAlertAction actionWithTitle:@"Confirmer" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){completion(YES);}]];[self presentViewController:alert animated:YES completion:nil];
}
@end
