#import <XCTest/XCTest.h>
#import <UIKit/UIKit.h>
#import "BPNodeEngine.h"
#import "BPViewController.h"
#import "BPOSCPeer.h"

@interface AutonomousTests : XCTestCase
@property(nonatomic,strong) BPViewController *controller;
@end
@implementation AutonomousTests
- (void)setUp {
 [super setUp];self.continueAfterFailure=NO;
 self.controller=(BPViewController *)UIApplication.sharedApplication.delegate.window.rootViewController;
 NSDate *end=[NSDate dateWithTimeIntervalSinceNow:60];
 while(!BPNodeEngine.shared.origin&&end.timeIntervalSinceNow>0)[NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.1]];
 XCTAssertNotNil(BPNodeEngine.shared.origin,@"Engine startup failed: %@",BPNodeEngine.shared.failure);
 [self waitJS:@"!!document.querySelector('.studio')"];
 [self api:@"/api/connection" body:@{@"mode":@"simulation",@"host":@"127.0.0.1",@"enableWrites":@NO} expected:200 authorized:YES];
 // Every scenario starts with a voice and its suggested monitor, independent of test order.
 [self api:@"/api/coach/profile" body:@{@"profile":@{@"version":@1,@"completed":@[],@"inputs":@[@{@"channel":@1,@"source":@"lead-rock",@"name":@"Voix test"}]}} expected:200 authorized:YES];
}
- (id)js:(NSString *)script {
 XCTestExpectation *done=[self expectationWithDescription:@"JavaScript"];__block id result=nil;
 [self.controller.web evaluateJavaScript:script completionHandler:^(id value,NSError *error){XCTAssertNil(error,@"%@",script);result=value;[done fulfill];}];
 [self waitForExpectations:@[done] timeout:20];return result;
}
- (void)waitJS:(NSString *)expression {
 NSDate *end=[NSDate dateWithTimeIntervalSinceNow:35];
 while(end.timeIntervalSinceNow>0){if([[self js:expression] boolValue])return;[NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.2]];}
 XCTFail(@"UI not ready: %@; %@",expression,[self js:@"document.body.innerText.slice(-2500)"]);
}
- (NSDictionary *)api:(NSString *)path body:(NSDictionary *)body expected:(NSInteger)status authorized:(BOOL)authorized {
 NSMutableURLRequest *request=[NSMutableURLRequest requestWithURL:[NSURL URLWithString:path relativeToURL:BPNodeEngine.shared.origin]];
 if(authorized)[request setValue:BPNodeEngine.shared.token forHTTPHeaderField:@"X-BandPilot-Native-Token"];
 if(body){request.HTTPMethod=@"POST";request.HTTPBody=[NSJSONSerialization dataWithJSONObject:body options:0 error:nil];[request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];}
 XCTestExpectation *done=[self expectationWithDescription:path];__block NSDictionary *result=nil;
 NSURLSessionConfiguration *config=NSURLSessionConfiguration.ephemeralSessionConfiguration;config.HTTPCookieStorage=nil;config.HTTPShouldSetCookies=NO;
 NSURLSession *session=[NSURLSession sessionWithConfiguration:config];
 [[session dataTaskWithRequest:request completionHandler:^(NSData *data,NSURLResponse *response,NSError *error){
  XCTAssertNil(error);XCTAssertEqual([(NSHTTPURLResponse *)response statusCode],status,@"%@ : %@",path,[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
  result=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;[done fulfill];
 }] resume];[self waitForExpectations:@[done] timeout:35];[session finishTasksAndInvalidate];return result;
}
- (void)testEmbeddedEngineAndPrivateAccess {
 XCTAssertTrue([[self js:@"!!window.BandPilotIOS && document.documentElement.dataset.platform==='ios'"] boolValue]);
 [self api:@"/api/status" body:nil expected:403 authorized:NO];
 [self api:@"/api/reaper/state" body:nil expected:501 authorized:YES];
 NSDictionary *report=[self api:@"/api/diagnostics/report" body:nil expected:200 authorized:YES];
 XCTAssertTrue([report[@"app"][@"version"] containsString:@"ios"]);
 XCTAssertFalse([[self js:@"[...document.querySelectorAll('.rail-space-btn')].some(b=>b.textContent.includes('Enregistrer et réécouter'))"] boolValue]);
 UIGraphicsImageRenderer *renderer=[[UIGraphicsImageRenderer alloc] initWithBounds:self.controller.view.window.bounds];
 UIImage *image=[renderer imageWithActions:^(UIGraphicsImageRendererContext *context){[self.controller.view.window drawViewHierarchyInRect:self.controller.view.window.bounds afterScreenUpdates:YES];}];
 XCTAttachment *capture=[XCTAttachment attachmentWithImage:image];capture.name=@"BandPilot-iPad";capture.lifetime=XCTAttachmentLifetimeKeepAlways;[self addAttachment:capture];
}
- (void)testDirectUDPAndSuspend {
 BPOSCPeer *peer=[BPOSCPeer new];XCTAssertTrue([peer start]);
 @try {
  [self api:@"/api/coach/profile" body:@{@"profile":@{@"version":@1,@"completed":@[],@"inputs":@[@{@"channel":@1,@"source":@"bass-di",@"name":@"Basse Éric"}]}} expected:200 authorized:YES];
  [self api:@"/api/connection" body:@{@"mode":@"real",@"host":@"127.0.0.1",@"port":@(peer.port),@"enableWrites":@YES} expected:200 authorized:YES];
  NSDictionary *preview=[self api:@"/api/coach/prepare" body:@{@"channel":@1} expected:200 authorized:YES];
  [self api:@"/api/coach/apply" body:@{@"token":preview[@"token"],@"confirm":@YES} expected:200 authorized:YES];
  XCTAssertEqualObjects([peer value:@"/ch/01/config/name"],@"Basse Eric");
  [self api:@"/api/native/suspend" body:@{} expected:200 authorized:YES];
  NSDictionary *status=[self api:@"/api/status" body:nil expected:200 authorized:YES];XCTAssertFalse([status[@"writesEnabled"] boolValue]);
  [self api:@"/api/connection" body:@{@"mode":@"simulation",@"host":@"127.0.0.1",@"enableWrites":@NO} expected:200 authorized:YES];
 } @finally {[peer stop];}
}
- (void)testInstrumentValidationAmbienceAndReload {
 [self js:@"document.querySelector('button[title=\"Régler le son\"]').click()"];[self waitJS:@"!!document.querySelector('.coach-journey')"];
 [self js:@"[...document.querySelectorAll('.coach-journey button')].find(b=>b.textContent.trim().endsWith('Dire qui est branché où')).click()"];[self waitJS:@"!!document.querySelector('.coach-inputs')"];
 NSInteger before=[[self js:@"document.querySelectorAll('.coach-input2').length"] integerValue];
 [self js:@"[...document.querySelectorAll('.coach-actions button')].find(b=>b.textContent.trim()==='Ajouter un instrument').click()"];
 [self waitJS:[NSString stringWithFormat:@"document.querySelectorAll('.coach-input2').length===%ld",(long)before+1]];
 [self js:@"(()=>{const row=[...document.querySelectorAll('.coach-input2')].at(-1),s=row.querySelectorAll('select')[1];s.value='bass-di';s.dispatchEvent(new Event('change',{bubbles:true}));})()"];
 [self js:@"(()=>{const i=[...document.querySelectorAll('.coach-input2 input')].at(-1);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Basse Éric');i.dispatchEvent(new Event('input',{bubbles:true}));})()"];
 [self waitJS:@"[...document.querySelectorAll('.coach-input2 input')].at(-1)?.value==='Basse Éric'"];
 [self js:@"[...document.querySelectorAll('.coach-input2 .apply')].at(-1).click()"];[self waitJS:@"!!document.querySelector('.coach-dialog[open]')"];
 [self js:@"[...document.querySelectorAll('.coach-dialog button')].find(b=>b.textContent.trim()==='Essayer en simulation').click()"];
 [self waitJS:@"!document.querySelector('.coach-dialog')&&!!document.querySelector('.coach-toast [role=status]')"];
 NSDictionary *coach=[self api:@"/api/coach" body:nil expected:200 authorized:YES];XCTAssertEqualObjects([coach[@"profile"][@"inputs"] lastObject][@"name"],@"Basse Éric");
 [self js:@"[...document.querySelectorAll('.coach-shortcuts button')].find(b=>b.textContent.trim()==='Ambiances des sources').click()"];[self waitJS:@"!!document.querySelector('.vocal-kit fieldset')"];
 [self js:@"[...document.querySelectorAll('.vocal-kit button')].find(b=>b.textContent.trim()==='Préparer mon ambiance').click()"];[self waitJS:@"!!document.querySelector('.vocal-preview')"];
 [self js:@"location.reload()"];[self waitJS:@"!!document.querySelector('.studio')"];
 coach=[self api:@"/api/coach" body:nil expected:200 authorized:YES];XCTAssertEqualObjects([coach[@"profile"][@"inputs"] lastObject][@"name"],@"Basse Éric");
 XCTAssertTrue([NSFileManager.defaultManager fileExistsAtPath:[BPNodeEngine.shared.root stringByAppendingPathComponent:@"data/bandpilot.db"]]);
}
- (void)testResumeAndPDFExport {
 [self js:@"window.permissionDialogPage=true"];
 [UIApplication.sharedApplication.delegate applicationDidBecomeActive:UIApplication.sharedApplication];
 [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.4]];
 XCTAssertTrue([[self js:@"window.permissionDialogPage===true"] boolValue],@"Accepting a permission dialog must not reload the connection form");
 XCTestExpectation *paused=[self expectationWithDescription:@"Suspend"];
 [BPNodeEngine.shared suspend:^(BOOL ok){XCTAssertTrue(ok);[paused fulfill];}];[self waitForExpectations:@[paused] timeout:10];
 NSDictionary *state=[self api:@"/api/status" body:nil expected:200 authorized:YES];XCTAssertFalse([state[@"writesEnabled"] boolValue]);
 [self js:@"window.beforeNativeResume=true"];
 [self.controller resumeSafely];[self waitJS:@"!window.beforeNativeResume&&!!document.querySelector('.studio')"];
 NSString *pdfName=[NSString stringWithFormat:@"BandPilot-test-%@.pdf",NSUUID.UUID.UUIDString];
 [self js:[NSString stringWithFormat:@"window.BandPilotIOS.invoke('print','test-pdf',JSON.stringify({html:'<!doctype html><html><body><h1>Fiche technique — Éric</h1><p>BandPilot iPad</p></body></html>',name:'%@'}));true",pdfName]];
 NSDate *end=[NSDate dateWithTimeIntervalSinceNow:20];while(!self.controller.presentedViewController&&end.timeIntervalSinceNow>0)[NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.2]];
 XCTAssertTrue([self.controller.presentedViewController isKindOfClass:UIActivityViewController.class]);
 NSURL *pdfURL=nil;
 for(NSURL *file in [NSFileManager.defaultManager enumeratorAtURL:[NSURL fileURLWithPath:NSTemporaryDirectory()] includingPropertiesForKeys:nil options:0 errorHandler:nil])if([file.lastPathComponent isEqual:pdfName]){pdfURL=file;break;}
 XCTAssertNotNil(pdfURL);CGPDFDocumentRef pdf=CGPDFDocumentCreateWithURL((__bridge CFURLRef)pdfURL);
 XCTAssertNotEqual(pdf,NULL);if(pdf){XCTAssertGreaterThan(CGPDFDocumentGetNumberOfPages(pdf),0);CGPDFDocumentRelease(pdf);}
 [self.controller dismissViewControllerAnimated:NO completion:nil];
}
@end
