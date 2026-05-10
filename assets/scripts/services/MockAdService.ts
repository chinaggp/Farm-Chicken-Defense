export type MockAdPlacement = 'win_next_level' | 'retry_boost';

export interface MockAdResult {
  placement: MockAdPlacement;
  watched: boolean;
  rewardGranted: boolean;
}

export class MockAdService {
  private static readonly simulatedDelayMs = 220;

  public static init(): void {
    // M1 local prototype does not require a platform AppID.
  }

  public static showRewardVideo(scene: string): Promise<boolean> {
    return MockAdService.resolveMockResult(scene, true);
  }

  public static showInterstitial(scene: string): Promise<boolean> {
    return MockAdService.resolveMockResult(scene, true);
  }

  public static showRewardedAd(placement: MockAdPlacement): Promise<MockAdResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          placement,
          watched: true,
          rewardGranted: true,
        });
      }, MockAdService.simulatedDelayMs);
    });
  }

  private static resolveMockResult(scene: string, defaultValue: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(scene.length > 0 ? defaultValue : false);
      }, MockAdService.simulatedDelayMs);
    });
  }
}
