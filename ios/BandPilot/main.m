#import <UIKit/UIKit.h>
#import "BPViewController.h"
#import "BPNodeEngine.h"
@interface BPAppDelegate : UIResponder <UIApplicationDelegate>
@property(nonatomic,strong) UIWindow *window;
@property(nonatomic,strong) BPViewController *controller;
@end
@implementation BPAppDelegate
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)options {
 self.window=[[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];self.controller=[BPViewController new];self.window.rootViewController=self.controller;[self.window makeKeyAndVisible];return YES;
}
- (void)applicationDidBecomeActive:(UIApplication *)app {app.idleTimerDisabled=YES;[self.controller resumeSafely];}
- (void)applicationDidEnterBackground:(UIApplication *)app {
 app.idleTimerDisabled=NO;[self.controller lockInterface];
 __block UIBackgroundTaskIdentifier task=UIBackgroundTaskInvalid;
 void (^finish)(void)=^{if(task!=UIBackgroundTaskInvalid){[app endBackgroundTask:task];task=UIBackgroundTaskInvalid;}};
 task=[app beginBackgroundTaskWithExpirationHandler:finish];[BPNodeEngine.shared suspend:^(BOOL ok){finish();}];
}
@end
int main(int argc,char *argv[]) {@autoreleasepool{return UIApplicationMain(argc,argv,nil,NSStringFromClass(BPAppDelegate.class));}}
