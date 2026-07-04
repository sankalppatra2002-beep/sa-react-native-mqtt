#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RCTMqtt, RCTEventEmitter)

RCT_EXTERN_METHOD(createClient:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(removeClient:(NSString *)clientRef)

RCT_EXTERN_METHOD(connect:(NSString *)clientRef)

RCT_EXTERN_METHOD(disconnect:(NSString *)clientRef)

RCT_EXTERN_METHOD(disconnectAll)

RCT_EXTERN_METHOD(subscribe:(NSString *)clientRef
                  topic:(NSString *)topic
                  qos:(NSNumber *)qos)

RCT_EXTERN_METHOD(unsubscribe:(NSString *)clientRef
                  topic:(NSString *)topic)

RCT_EXTERN_METHOD(publish:(NSString *)clientRef
                  topic:(NSString *)topic
                  data:(NSString *)data
                  qos:(NSNumber *)qos
                  retain:(BOOL)retain)

RCT_EXTERN_METHOD(isConnected:(NSString *)clientRef
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isSubbed:(NSString *)clientRef
                  topic:(NSString *)topic
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getTopics:(NSString *)clientRef
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
