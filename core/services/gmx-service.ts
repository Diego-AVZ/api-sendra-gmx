import type { GMXConfig } from '../types';

export interface FundingFeeResult {
  market: string;
  long: string;
  short: string;
  longRaw: string;
  shortRaw: string;
}

const ARBITRUM_CONFIG = {
  chainId: 42161,
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  oracleUrl: 'https://arbitrum-api.gmxinfra.io',
  subsquidUrl: 'https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql',
};

const AVALANCHE_CONFIG = {
  chainId: 43114,
  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  oracleUrl: 'https://avalanche-api.gmxinfra.io',
  subsquidUrl: 'https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql',
};

export class GMXService {
  private config: GMXConfig;
  private sdk: any = null;

  constructor(config: GMXConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const { createRequire } = await import('module');
    const path = await import('path');
    
    const sdkPath = path.resolve(process.cwd(), 'node_modules/@gmx-io/sdk');
    const cjsIndexPath = path.join(sdkPath, 'build/cjs/src/index.js');
    const requireSDK = createRequire(cjsIndexPath);
    
    const { GmxSdk } = requireSDK(cjsIndexPath);
    const baseConfig = this.config.chainId === 43114 ? AVALANCHE_CONFIG : ARBITRUM_CONFIG;
    
    this.sdk = new GmxSdk({
      chainId: this.config.chainId as 42161 | 43114,
      rpcUrl: this.config.rpcUrl || baseConfig.rpcUrl,
      oracleUrl: baseConfig.oracleUrl,
      subsquidUrl: baseConfig.subsquidUrl,
    });
  }

  async getFundingFees(): Promise<FundingFeeResult[]> {
    if (!this.sdk) {
      await this.initialize();
    }

    if (!this.sdk) {
      throw new Error('GMX SDK not initialized');
    }

    const { createRequire } = await import('module');
    const path = await import('path');
    
    const sdkPath = path.resolve(process.cwd(), 'node_modules/@gmx-io/sdk');
    const cjsIndexPath = path.join(sdkPath, 'build/cjs/src/index.js');
    const requireSDK = createRequire(cjsIndexPath);
    
    const feesModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/fees/index.js'));
    const marketsModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/markets.js'));
    const numbersModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/numbers.js'));
    
    const getFundingFactorPerPeriod = feesModule.getFundingFactorPerPeriod;
    const getMarketFullName = marketsModule.getMarketFullName;
    const formatRatePercentage = numbersModule.formatRatePercentage;

    const { marketsInfoData } = await this.sdk.markets.getMarketsInfo();

    const result = Object.values(marketsInfoData ?? {}).map((m: any) => {
      const longHourly = getFundingFactorPerPeriod(m, true, 3600);
      const shortHourly = getFundingFactorPerPeriod(m, false, 3600);

      return {
        market: getMarketFullName(m),
        long: formatRatePercentage(longHourly, { displayDecimals: 4 }),
        short: formatRatePercentage(shortHourly, { displayDecimals: 4 }),
        longRaw: longHourly.toString(),
        shortRaw: shortHourly.toString(),
      };
    });

    return result;
  }

  getConfig(): GMXConfig {
    return this.config;
  }
}

