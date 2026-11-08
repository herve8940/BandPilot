#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
@interface BPViewController : UIViewController
@property(nonatomic,strong,readonly) WKWebView *web;
- (void)resumeSafely;
- (void)lockInterface;
@end
