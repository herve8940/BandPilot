// Test fixture only: actual UDP sockets on the simulator, no physical mixer.
#import "BPOSCPeer.h"
#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>
static NSString *readString(NSData *data,NSUInteger *offset) {
 const char *bytes=data.bytes;NSUInteger start=*offset;
 while(*offset<data.length&&bytes[*offset])(*offset)++;
 if(*offset==data.length)return nil;
 NSString *s=[[NSString alloc] initWithBytes:bytes+start length:*offset-start encoding:NSUTF8StringEncoding];
 *offset=(*offset+4)&~3;return s;
}
static void putString(NSMutableData *data,NSString *string) {
 [data appendData:[string dataUsingEncoding:NSUTF8StringEncoding]];uint8_t zero=0;do{[data appendBytes:&zero length:1];}while(data.length%4);
}
static NSData *message(NSString *address,NSArray *args) {
 NSMutableData *out=[NSMutableData new];putString(out,address);NSMutableString *tags=[NSMutableString stringWithString:@","];
 for(id arg in args)[tags appendString:[arg isKindOfClass:NSString.class]?@"s":@"f"];putString(out,tags);
 for(id arg in args){if([arg isKindOfClass:NSString.class])putString(out,arg);else{float f=[arg floatValue];uint32_t bits;memcpy(&bits,&f,4);bits=htonl(bits);[out appendBytes:&bits length:4];}}
 return out;
}
@interface BPOSCPeer ()
@property(nonatomic) int socketFD;
@property(nonatomic,readwrite) NSInteger port;
@property(nonatomic,strong) NSMutableDictionary *values;
@property(nonatomic,strong) dispatch_source_t source;
@end
@implementation BPOSCPeer
- (BOOL)start {
 self.socketFD=socket(AF_INET,SOCK_DGRAM,0);if(self.socketFD<0)return NO;
 struct sockaddr_in local={0};local.sin_family=AF_INET;local.sin_addr.s_addr=htonl(INADDR_LOOPBACK);local.sin_port=0;
 if(bind(self.socketFD,(struct sockaddr *)&local,sizeof(local))!=0){close(self.socketFD);return NO;}
 socklen_t size=sizeof(local);getsockname(self.socketFD,(struct sockaddr *)&local,&size);self.port=ntohs(local.sin_port);self.values=[NSMutableDictionary new];
 self.source=dispatch_source_create(DISPATCH_SOURCE_TYPE_READ,self.socketFD,0,dispatch_get_global_queue(QOS_CLASS_UTILITY,0));
 __weak BPOSCPeer *weak=self;int fd=self.socketFD;
 dispatch_source_set_event_handler(self.source,^{
  BPOSCPeer *s=weak;if(!s)return;uint8_t buffer[8192];struct sockaddr_in from;socklen_t length=sizeof(from);ssize_t n=recvfrom(fd,buffer,sizeof(buffer),0,(struct sockaddr *)&from,&length);if(n<=0)return;
  NSData *packet=[NSData dataWithBytes:buffer length:(NSUInteger)n];NSUInteger offset=0;NSString *address=readString(packet,&offset),*tags=readString(packet,&offset);if(!address||!tags)return;
  id value=nil;if(tags.length>1){unichar t=[tags characterAtIndex:1];if(t=='s')value=readString(packet,&offset);else if(offset+4<=packet.length){uint32_t bits;memcpy(&bits,buffer+offset,4);bits=ntohl(bits);if(t=='f'){float f;memcpy(&f,&bits,4);value=@(f);}else if(t=='i')value=@((int32_t)bits);}}
  NSData *reply;
  if([address isEqual:@"/info"]||[address isEqual:@"/xinfo"])reply=message(address,@[@"127.0.0.1",@"iPad fixture",@"XR18",@"1.18"]);
  else if([address isEqual:@"/xremote"]||[address hasPrefix:@"/subscribe"]||[address hasPrefix:@"/meters"])return;
  else {@synchronized(s){if(value)s.values[address]=value;reply=message(address,@[s.values[address]?:([address hasSuffix:@"/config/name"]?@"":@0)]);}}
  sendto(fd,reply.bytes,reply.length,0,(struct sockaddr *)&from,length);
 });dispatch_source_set_cancel_handler(self.source,^{close(fd);});dispatch_resume(self.source);return YES;
}
- (id)value:(NSString *)address {@synchronized(self){return self.values[address];}}
- (void)stop {if(self.source){dispatch_source_cancel(self.source);self.source=nil;}}
- (void)dealloc {[self stop];}
@end
