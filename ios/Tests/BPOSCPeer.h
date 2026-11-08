#import <Foundation/Foundation.h>
@interface BPOSCPeer : NSObject
@property(nonatomic,readonly) NSInteger port;
- (BOOL)start;
- (id)value:(NSString *)address;
- (void)stop;
@end
