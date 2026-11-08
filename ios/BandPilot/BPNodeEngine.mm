#import "BPNodeEngine.h"
#import <NodeMobile/NodeMobile.h>
#import <Security/Security.h>
#include <vector>
@interface BPNodeEngine ()
@property(nonatomic,copy,readwrite) NSString *root;
@property(nonatomic,copy,readwrite) NSString *token;
@property(nonatomic,copy,readwrite) NSString *failure;
@end
@implementation BPNodeEngine
+ (instancetype)shared {static BPNodeEngine *engine;static dispatch_once_t once;dispatch_once(&once,^{engine=[BPNodeEngine new];});return engine;}
- (void)start {
 static dispatch_once_t once;
 dispatch_once(&once,^{
  NSFileManager *fm=NSFileManager.defaultManager;
  self.root=[NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory,NSUserDomainMask,YES).firstObject stringByAppendingPathComponent:@"BandPilot"];
  NSError *error=nil;
  if(![fm createDirectoryAtPath:self.root withIntermediateDirectories:YES attributes:@{NSFileProtectionKey:NSFileProtectionCompleteUntilFirstUserAuthentication} error:&error]){self.failure=error.localizedDescription;return;}
  for(NSString *name in @[@"ready.json",@"startup-error.txt"])[fm removeItemAtPath:[self.root stringByAppendingPathComponent:name] error:nil];
  uint8_t bytes[32];if(SecRandomCopyBytes(kSecRandomDefault,sizeof(bytes),bytes)!=errSecSuccess){self.failure=@"Impossible de démarrer la session locale.";return;}
  NSMutableString *token=[NSMutableString new];for(int i=0;i<32;i++)[token appendFormat:@"%02x",bytes[i]];self.token=token;
  NSString *bootstrap=[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"Runtime/bootstrap.cjs"];
  if(![fm fileExistsAtPath:bootstrap]){self.failure=@"Le moteur embarqué manque dans cette installation.";return;}
  NSArray<NSString *> *args=@[@"node",@"--jitless",bootstrap,self.root,self.token];
  // Node starts exactly once in this process and owns this dedicated thread.
  NSThread *thread=[[NSThread alloc] initWithBlock:^{
   size_t length=0;for(NSString *arg in args)length+=[arg lengthOfBytesUsingEncoding:NSUTF8StringEncoding]+1;
   std::vector<char> storage(length);std::vector<char *> argv;char *p=storage.data();
   for(NSString *arg in args){size_t n=strlen(arg.UTF8String)+1;memcpy(p,arg.UTF8String,n);argv.push_back(p);p+=n;}
   int code=node_start((int)argv.size(),argv.data());
   dispatch_async(dispatch_get_main_queue(),^{self.failure=[NSString stringWithFormat:@"Le moteur s’est arrêté (%d). Ferme puis rouvre BandPilot.",code];});
  }];thread.name=@"BandPilot OSC";[thread start];
 });
}
- (NSURL *)origin {
 if(!self.root)return nil;
 NSData *data=[NSData dataWithContentsOfFile:[self.root stringByAppendingPathComponent:@"ready.json"]];
 NSDictionary *ready=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;
 NSInteger port=[ready[@"port"] integerValue];
 return port>1024&&port<65536?[NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld",(long)port]]:nil;
}
- (void)suspend:(void (^)(BOOL))completion {
 NSURL *origin=self.origin;if(!origin){completion(NO);return;}
 NSMutableURLRequest *r=[NSMutableURLRequest requestWithURL:[NSURL URLWithString:@"/api/native/suspend" relativeToURL:origin] cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:5];
 r.HTTPMethod=@"POST";r.HTTPBody=[@"{}" dataUsingEncoding:NSUTF8StringEncoding];
 [r setValue:self.token forHTTPHeaderField:@"X-BandPilot-Native-Token"];
 [[[NSURLSession sharedSession] dataTaskWithRequest:r completionHandler:^(NSData *data,NSURLResponse *response,NSError *error){
  BOOL ok=!error&&[(NSHTTPURLResponse *)response statusCode]==200;
  dispatch_async(dispatch_get_main_queue(),^{completion(ok);});
 }] resume];
}
@end
