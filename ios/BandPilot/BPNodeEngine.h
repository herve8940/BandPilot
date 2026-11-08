#import <Foundation/Foundation.h>
@interface BPNodeEngine : NSObject
@property(nonatomic,copy,readonly) NSString *root;
@property(nonatomic,copy,readonly) NSString *token;
@property(nonatomic,strong,readonly) NSURL *origin;
@property(nonatomic,copy,readonly) NSString *failure;
+ (instancetype)shared;
- (void)start;
- (void)suspend:(void (^)(BOOL))completion;
@end
