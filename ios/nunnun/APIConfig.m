#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface APIConfig : NSObject <RCTBridgeModule>
@end

@implementation APIConfig

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
  NSArray<NSString *> *keys = @[@"LocalBackendAPIBaseURL", @"APIBaseURL"];

  for (NSString *key in keys) {
    id rawValue = [[NSBundle mainBundle] objectForInfoDictionaryKey:key];
    if ([rawValue isKindOfClass:[NSString class]]) {
      NSString *value = [(NSString *)rawValue
        stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
      if (value.length > 0) {
        return @{ @"apiBaseURL": value };
      }
    }
  }

  return @{ @"apiBaseURL": @"" };
}

@end
