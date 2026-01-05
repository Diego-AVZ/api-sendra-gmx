import type { GMXConfig } from '../types';

export interface FundingFeeResult {
  market: string;
  long: string;
  short: string;
  longRaw: string;
  shortRaw: string;
}

export interface PositionFundingFeeResult {
  positionKey: string;
  market: string;
  account: string;
  sizeInUsd: string;
  isLong: boolean;
  claimableFundingFeeUsd: string;
  claimableFundingFeeFormatted: string;
  lastFundingFeeUpdate: string;
}

export interface SinglePositionFundingFeeResult {
  positionKey: string;
  market: string;
  account: string;
  sizeInUsd: string;
  isLong: boolean;
  claimableFundingFeeUsd: string;
  claimableFundingFeeFormatted: string;
  fundingFeeRateHourly: string;
  fundingFeeRateHourlyRaw: string;
  lastFundingFeeUpdate: string;
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

// Helper function to find SDK path (works in both local and Vercel environments)
async function findSDKPath(): Promise<string> {
  const path = await import('path');
  const fs = await import('fs/promises');
  
  // Try multiple possible paths
  const possiblePaths = [
    path.resolve(process.cwd(), 'node_modules/@gmx-io/sdk'),
    path.resolve('/var/task', 'node_modules/@gmx-io/sdk'), // Vercel
    path.resolve(__dirname, '../../node_modules/@gmx-io/sdk'),
    path.resolve(__dirname, '../../../node_modules/@gmx-io/sdk'),
  ];
  
  for (const sdkPath of possiblePaths) {
    const cjsIndexPath = path.join(sdkPath, 'build/cjs/src/index.js');
    try {
      await fs.access(cjsIndexPath);
      return sdkPath;
    } catch {
      // Path doesn't exist, try next one
      continue;
    }
  }
  
  throw new Error('Could not find @gmx-io/sdk module. Tried paths: ' + possiblePaths.join(', '));
}

export class GMXService {
  private config: GMXConfig;
  private sdk: any = null;

  constructor(config: GMXConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const { createRequire } = await import('module');
    const path = await import('path');
    
    const sdkPath = await findSDKPath();
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
    
    console.log('GMX SDK initialized for chainId:', this.config.chainId, 'Network:', this.config.chainId === 42161 ? 'Arbitrum' : 'Avalanche');
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
    
    const sdkPath = await findSDKPath();
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

  async getPositionFundingFees(account: string, marketAddress?: string): Promise<PositionFundingFeeResult[]> {
    if (!this.sdk) {
      await this.initialize();
    }

    if (!this.sdk) {
      throw new Error('GMX SDK not initialized');
    }

    this.sdk.setAccount(account);
    console.log('Getting positions for account:', account, 'on chainId:', this.config.chainId);

    const { createRequire } = await import('module');
    const path = await import('path');
    
    const sdkPath = await findSDKPath();
    const cjsIndexPath = path.join(sdkPath, 'build/cjs/src/index.js');
    const requireSDK = createRequire(cjsIndexPath);
    
    const marketsModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/markets.js'));
    const numbersModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/numbers.js'));
    
    const getMarketFullName = marketsModule.getMarketFullName;
    const formatUsd = numbersModule.formatUsd;

    const { marketsInfoData, tokensData } = await this.sdk.markets.getMarketsInfo();
    
    if (!marketsInfoData || !tokensData) {
      throw new Error('Failed to get markets info');
    }
    
    let positionsData;
    
    try {
      positionsData = await this.sdk.positions.getPositions({
        marketsInfoData,
        tokensData,
        start: 0,
        end: 1000,
      });
      
      if (positionsData && typeof positionsData === 'object') {
        const readerPositions = positionsData.reader?.positions;
        if (readerPositions) {
          const isError = readerPositions instanceof Error || 
                         (typeof readerPositions === 'object' && readerPositions !== null && 'message' in readerPositions);
          
          if (isError) {
            const error = readerPositions as any;
            const errorMessage = error?.message || error?.shortMessage || '';
            if (errorMessage.includes('EmptyMarketPrice')) {
              console.warn('EmptyMarketPrice error in reader.positions - SDK limitation');
              console.warn('The SDK passes empty markets array [] causing contract revert');
              return [];
            }
            throw error;
          }
        }
      }
      
      console.log('getPositions call completed, checking result structure...');
      console.log('positionsData type:', typeof positionsData);
      console.log('positionsData is array:', Array.isArray(positionsData));
      if (positionsData && typeof positionsData === 'object') {
        console.log('positionsData keys:', Object.keys(positionsData));
        if (positionsData.reader) {
          console.log('reader keys:', Object.keys(positionsData.reader));
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.shortMessage || '';
      const errorDetails = error?.details || '';
      const errorCause = error?.cause?.message || '';
      const fullErrorText = `${errorMessage} ${errorDetails} ${errorCause}`;
      
      if (fullErrorText.includes('EmptyMarketPrice')) {
        console.warn('EmptyMarketPrice error detected');
        console.warn('The SDK is passing empty markets array [] to the contract');
        console.warn('This causes the contract to query all markets and fail');
        console.warn('Returning empty array - this is a known SDK limitation');
        
        return [];
      }
      
      console.error('Error getting positions:', {
        message: errorMessage,
        details: errorDetails,
        cause: errorCause,
        account,
        chainId: this.config.chainId
      });
      throw new Error(`Failed to get positions: ${errorMessage || 'Unknown error'}`);
    }

    let positions: any[] = [];
    
    if (Array.isArray(positionsData)) {
      positions = positionsData;
      console.log(`Found ${positions.length} positions in array`);
    } else if (positionsData && typeof positionsData === 'object') {
      const positionsDataValue = positionsData.positionsData;
      
      if (Array.isArray(positionsDataValue)) {
        positions = positionsDataValue;
        console.log(`Found ${positions.length} positions in positionsData.positionsData`);
      } else if (positionsDataValue && typeof positionsDataValue === 'object') {
        if (Array.isArray(positionsDataValue.positions)) {
          positions = positionsDataValue.positions;
          console.log(`Found ${positions.length} positions in positionsData.positionsData.positions`);
        } else if (Array.isArray(positionsDataValue.data)) {
          positions = positionsDataValue.data;
          console.log(`Found ${positions.length} positions in positionsData.positionsData.data`);
        } else {
          const allValues = Object.values(positionsDataValue);
          for (const val of allValues) {
            if (Array.isArray(val)) {
              positions = val as any[];
              console.log(`Found ${positions.length} positions in positionsData.positionsData nested`);
              break;
            }
          }
        }
      }
      
      if (positions.length === 0 && positionsDataValue) {
        console.error('Could not extract positions from positionsData.positionsData');
        console.error('positionsData.positionsData type:', typeof positionsDataValue);
        if (positionsDataValue && typeof positionsDataValue === 'object') {
          console.error('positionsData.positionsData keys:', Object.keys(positionsDataValue));
          const firstKey = Object.keys(positionsDataValue)[0];
          if (firstKey) {
            const firstValue = (positionsDataValue as any)[firstKey];
            console.error(`First key "${firstKey}" type:`, typeof firstValue, 'isArray:', Array.isArray(firstValue));
            if (Array.isArray(firstValue)) {
              console.error(`First key "${firstKey}" has ${firstValue.length} items`);
              positions = firstValue;
            }
          }
        }
      }
    }

    if (!Array.isArray(positions)) {
      console.error('Positions data structure is not an array:', typeof positionsData);
      return [];
    }
    
    console.log(`Processing ${positions.length} positions`);

    const result: PositionFundingFeeResult[] = [];

    for (const position of positions) {
      if (marketAddress && position.marketAddress?.toLowerCase() !== marketAddress.toLowerCase()) {
        continue;
      }

      const marketInfo = marketsInfoData?.[position.marketAddress || ''];
      if (!marketInfo) {
        continue;
      }

      const isLong = position.isLong;
      const sizeInUsd = position.sizeInUsd || 0n;
      const claimableFundingFeeUsd = position.claimableFundingAmount?.total || 0n;
      
      result.push({
        positionKey: position.key || '',
        market: getMarketFullName(marketInfo),
        account: account,
        sizeInUsd: sizeInUsd.toString(),
        isLong: isLong,
        claimableFundingFeeUsd: claimableFundingFeeUsd.toString(),
        claimableFundingFeeFormatted: formatUsd(claimableFundingFeeUsd, { displayDecimals: 2 }),
        lastFundingFeeUpdate: position.lastIncreasedAt?.toString() || '0',
      });
    }

    return result;
  }

  async getPositionFundingFeeByKey(account: string, positionKey: string, marketAddress?: string): Promise<SinglePositionFundingFeeResult | null> {
    if (!this.sdk) {
      await this.initialize();
    }

    if (!this.sdk) {
      throw new Error('GMX SDK not initialized');
    }

    this.sdk.setAccount(account);

    const { createRequire } = await import('module');
    const path = await import('path');
    
    const sdkPath = await findSDKPath();
    const cjsIndexPath = path.join(sdkPath, 'build/cjs/src/index.js');
    const requireSDK = createRequire(cjsIndexPath);
    
    const marketsModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/markets.js'));
    const numbersModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/numbers.js'));
    const feesModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/fees/index.js'));
    const contractsModule = requireSDK(path.join(sdkPath, 'build/cjs/src/configs/contracts.js'));
    
    const getMarketFullName = marketsModule.getMarketFullName;
    const formatUsd = numbersModule.formatUsd;
    const formatRatePercentage = numbersModule.formatRatePercentage;
    const getFundingFactorPerPeriod = feesModule.getFundingFactorPerPeriod;
    const getContract = contractsModule.getContract;
    const getContractMarketPrices = marketsModule.getContractMarketPrices;

    const { marketsInfoData, tokensData } = await this.sdk.markets.getMarketsInfo();
    
    if (!marketsInfoData || !tokensData) {
      throw new Error('Failed to get markets info');
    }

    const marketsToQuery = marketAddress 
      ? [marketAddress.toLowerCase()]
      : Object.keys(marketsInfoData).filter(addr => {
          const market = marketsInfoData[addr];
          return market && !market.isSpotOnly;
        });

    if (marketsToQuery.length === 0) {
      throw new Error('No markets available');
    }

    try {
      const viem = await import('viem');
      const chains = await import('viem/chains');
      
      const publicClient = viem.createPublicClient({
        chain: this.config.chainId === 43114 ? undefined : chains.arbitrum,
        transport: viem.http(this.config.rpcUrl || ARBITRUM_CONFIG.rpcUrl),
      });

      const readerAddress = getContract(this.config.chainId, 'SyntheticsReader') as `0x${string}`;
      const dataStoreAddress = getContract(this.config.chainId, 'DataStore') as `0x${string}`;
      const referralStorageAddress = getContract(this.config.chainId, 'ReferralStorage') as `0x${string}`;

      const readerAbiModule = requireSDK(path.join(sdkPath, 'build/cjs/src/abis/SyntheticsReader.js'));
      const readerAbi = readerAbiModule.default || readerAbiModule;

      const markets: `0x${string}`[] = [];
      const marketsPrices: Array<{
        indexTokenPrice: { min: bigint; max: bigint };
        longTokenPrice: { min: bigint; max: bigint };
        shortTokenPrice: { min: bigint; max: bigint };
      }> = [];

      for (const marketAddr of marketsToQuery) {
        const market = marketsInfoData[marketAddr];
        if (!market || market.isSpotOnly) {
          continue;
        }
        
        const marketPrices = getContractMarketPrices(tokensData, market);
        if (!marketPrices || !marketPrices.indexTokenPrice || !marketPrices.longTokenPrice || !marketPrices.shortTokenPrice) {
          continue;
        }
        
        markets.push(marketAddr as `0x${string}`);
        marketsPrices.push({
          indexTokenPrice: marketPrices.indexTokenPrice,
          longTokenPrice: marketPrices.longTokenPrice,
          shortTokenPrice: marketPrices.shortTokenPrice,
        });
      }

      if (markets.length === 0) {
        return null;
      }

      const result = await publicClient.readContract({
        address: readerAddress,
        abi: readerAbi,
        functionName: 'getAccountPositionInfoList',
        args: [
          dataStoreAddress,
          referralStorageAddress,
          account as `0x${string}`,
          markets,
          marketsPrices,
          '0x0000000000000000000000000000000000000000' as `0x${string}`,
          0n,
          1000n,
        ],
      });

      if (!result || !Array.isArray(result) || result.length === 0) {
        console.log('No positions returned from contract');
        return null;
      }

      console.log(`Found ${result.length} positions from contract`);
      console.log('Looking for positionKey:', positionKey);
      
      const position = result.find((p: any) => {
        const contractKey = p.positionKey || p.key;
        
        if (contractKey === undefined || contractKey === null) {
          return false;
        }
        
        let contractKeyStr: string;
        if (typeof contractKey === 'string') {
          contractKeyStr = contractKey;
        } else if (typeof contractKey === 'bigint') {
          contractKeyStr = `0x${contractKey.toString(16).padStart(64, '0')}`;
        } else {
          contractKeyStr = String(contractKey);
        }
        
        const searchKey = positionKey.toLowerCase();
        const contractKeyLower = contractKeyStr.toLowerCase();
        
        const exactMatch = contractKeyLower === searchKey;
        const startsWithMatch = contractKeyLower.startsWith(searchKey) || searchKey.startsWith(contractKeyLower);
        const includesMatch = contractKeyLower.includes(searchKey) || searchKey.includes(contractKeyLower);
        
        const match = exactMatch || startsWithMatch || includesMatch;
        
        if (match) {
          console.log('Found matching position:', {
            contractKey: contractKeyStr,
            searchKey: searchKey,
            exactMatch,
            startsWithMatch,
            includesMatch,
            market: p.addresses?.market || p.market,
          });
        }
        
        return match;
      });

      if (!position) {
        return null;
      }

      const positionMarketAddress = (position.addresses?.market || position.market || '').toLowerCase();
      const marketInfo = marketsInfoData[positionMarketAddress];
      
      if (!marketInfo) {
        return null;
      }

      const isLong = position.flags?.isLong ?? position.isLong ?? false;
      const sizeInUsd = position.numbers?.sizeInUsd || position.sizeInUsd || 0n;
      const claimableFundingFeeUsd = position.funding?.claimableFundingAmount?.total || 
                                     position.claimableFundingAmount?.total || 
                                     position.fundingFeeAmount || 0n;
      
      const fundingFactorHourly = getFundingFactorPerPeriod(marketInfo, isLong, 3600);
      const fundingRateFormatted = formatRatePercentage(fundingFactorHourly, { displayDecimals: 4 });

      return {
        positionKey: position.positionKey || positionKey,
        market: getMarketFullName(marketInfo),
        account: account,
        sizeInUsd: sizeInUsd.toString(),
        isLong: isLong,
        claimableFundingFeeUsd: claimableFundingFeeUsd.toString(),
        claimableFundingFeeFormatted: formatUsd(claimableFundingFeeUsd, { displayDecimals: 2 }),
        fundingFeeRateHourly: fundingRateFormatted,
        fundingFeeRateHourlyRaw: fundingFactorHourly.toString(),
        lastFundingFeeUpdate: position.numbers?.lastIncreasedAt?.toString() || 
                             position.lastIncreasedAt?.toString() || 
                             '0',
      };
    } catch (error: any) {
      const errorMessage = error?.message || error?.shortMessage || '';
      if (errorMessage.includes('EmptyMarketPrice')) {
        console.warn('EmptyMarketPrice error when getting position by key');
        return null;
      }
      console.error('Error getting position by key:', error);
      throw error;
    }
  }

  async getAllPositions(account: string, marketAddress?: string): Promise<any[]> {
    if (!this.sdk) {
      await this.initialize();
    }

    if (!this.sdk) {
      throw new Error('GMX SDK not initialized');
    }

    this.sdk.setAccount(account);

    const { createRequire } = await import('module');
    const path = await import('path');
    
    const sdkPath = await findSDKPath();
    const cjsIndexPath = path.join(sdkPath, 'build/cjs/src/index.js');
    const requireSDK = createRequire(cjsIndexPath);
    
    const marketsModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/markets.js'));
    const numbersModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/numbers.js'));
    const contractsModule = requireSDK(path.join(sdkPath, 'build/cjs/src/configs/contracts.js'));
    const tokensModule = requireSDK(path.join(sdkPath, 'build/cjs/src/utils/tokens.js'));
    
    const getMarketFullName = marketsModule.getMarketFullName;
    const getContract = contractsModule.getContract;
    const getContractMarketPrices = marketsModule.getContractMarketPrices;
    const convertToUsd = tokensModule.convertToUsd;

    const { marketsInfoData, tokensData } = await this.sdk.markets.getMarketsInfo();
    
    if (!marketsInfoData || !tokensData) {
      throw new Error('Failed to get markets info');
    }

    const marketsToQuery = marketAddress 
      ? [marketAddress.toLowerCase()]
      : Object.keys(marketsInfoData).filter(addr => {
          const market = marketsInfoData[addr];
          return market && !market.isSpotOnly;
        });

    if (marketsToQuery.length === 0) {
      throw new Error('No markets available');
    }

    try {
      const viem = await import('viem');
      const chains = await import('viem/chains');
      
      const publicClient = viem.createPublicClient({
        chain: this.config.chainId === 43114 ? undefined : chains.arbitrum,
        transport: viem.http(this.config.rpcUrl || ARBITRUM_CONFIG.rpcUrl),
      });

      const readerAddress = getContract(this.config.chainId, 'SyntheticsReader') as `0x${string}`;
      const dataStoreAddress = getContract(this.config.chainId, 'DataStore') as `0x${string}`;
      const referralStorageAddress = getContract(this.config.chainId, 'ReferralStorage') as `0x${string}`;

      const readerAbiModule = requireSDK(path.join(sdkPath, 'build/cjs/src/abis/SyntheticsReader.js'));
      const readerAbi = readerAbiModule.default || readerAbiModule;

      const markets: `0x${string}`[] = [];
      const marketsPrices: Array<{
        indexTokenPrice: { min: bigint; max: bigint };
        longTokenPrice: { min: bigint; max: bigint };
        shortTokenPrice: { min: bigint; max: bigint };
      }> = [];

      for (const marketAddr of marketsToQuery) {
        const market = marketsInfoData[marketAddr];
        if (!market || market.isSpotOnly) {
          continue;
        }
        
        const marketPrices = getContractMarketPrices(tokensData, market);
        if (!marketPrices || !marketPrices.indexTokenPrice || !marketPrices.longTokenPrice || !marketPrices.shortTokenPrice) {
          continue;
        }
        
        markets.push(marketAddr as `0x${string}`);
        marketsPrices.push({
          indexTokenPrice: marketPrices.indexTokenPrice,
          longTokenPrice: marketPrices.longTokenPrice,
          shortTokenPrice: marketPrices.shortTokenPrice,
        });
      }

      if (markets.length === 0) {
        return [];
      }

      const result = await publicClient.readContract({
        address: readerAddress,
        abi: readerAbi,
        functionName: 'getAccountPositionInfoList',
        args: [
          dataStoreAddress,
          referralStorageAddress,
          account as `0x${string}`,
          markets,
          marketsPrices,
          '0x0000000000000000000000000000000000000000' as `0x${string}`,
          0n,
          1000n,
        ],
      });

      if (!result || !Array.isArray(result) || result.length === 0) {
        return [];
      }

      return result.map((item: any) => {
        const contractKey = item.positionKey || item.key;
        let positionKeyStr = 'N/A';
        if (contractKey !== undefined && contractKey !== null) {
          if (typeof contractKey === 'string') {
            positionKeyStr = contractKey;
          } else if (typeof contractKey === 'bigint') {
            positionKeyStr = `0x${contractKey.toString(16).padStart(64, '0')}`;
          } else {
            positionKeyStr = String(contractKey);
          }
        }

        const position = item.position || item;
        const addresses = position?.addresses || item.addresses || {};
        const numbers = position?.numbers || item.numbers || {};
        const flags = position?.flags || item.flags || {};
        const fees = item.fees || position?.fees || {};
        const funding = fees.funding || position?.funding || item.funding || {};

        const marketAddressRaw = addresses.market || item.market || '';
        const marketAddress = marketAddressRaw ? marketAddressRaw.toLowerCase() : '';
        
        let marketInfo = null;
        if (marketAddress) {
          marketInfo = marketsInfoData[marketAddress];
          if (!marketInfo) {
            const marketAddressUpper = marketAddressRaw.toUpperCase();
            marketInfo = marketsInfoData[marketAddressUpper];
          }
          if (!marketInfo) {
            for (const [key, value] of Object.entries(marketsInfoData)) {
              if (key.toLowerCase() === marketAddress) {
                marketInfo = value;
                break;
              }
            }
          }
        }
        
        const marketName = marketInfo ? getMarketFullName(marketInfo) : (marketAddress || 'N/A');

        const sizeInUsd = numbers.sizeInUsd || item.sizeInUsd || 0n;
        const collateralAmount = numbers.collateralAmount || item.collateralAmount || 0n;
        const isLong = flags.isLong ?? item.isLong ?? false;
        const collateralToken = addresses.collateralToken || item.collateralToken || 'N/A';
        
        const claimableLongTokenAmount = funding.claimableLongTokenAmount || fees.claimableLongTokenAmount || item.claimableLongTokenAmount || 0n;
        const claimableShortTokenAmount = funding.claimableShortTokenAmount || fees.claimableShortTokenAmount || item.claimableShortTokenAmount || 0n;
        
        let claimableFundingAmountUsd = 0n;
        let claimableFundingFeeFormatted = 'N/A';
        
        if (marketInfo && tokensData) {
          try {
            const longToken = tokensData[marketInfo.longTokenAddress];
            const shortToken = tokensData[marketInfo.shortTokenAddress];
            
            let longTokenUsd = 0n;
            let shortTokenUsd = 0n;
            
            if (claimableLongTokenAmount > 0n && longToken && longToken.prices && longToken.prices.minPrice) {
              longTokenUsd = convertToUsd(claimableLongTokenAmount, longToken.decimals, longToken.prices.minPrice);
            }
            
            if (claimableShortTokenAmount > 0n && shortToken && shortToken.prices && shortToken.prices.minPrice) {
              shortTokenUsd = convertToUsd(claimableShortTokenAmount, shortToken.decimals, shortToken.prices.minPrice);
            }
            
            claimableFundingAmountUsd = longTokenUsd + shortTokenUsd;
            claimableFundingFeeFormatted = numbersModule.formatUsd(claimableFundingAmountUsd, { displayDecimals: 2 });
          } catch (error) {
            console.warn('Error converting claimable funding to USD:', error);
          }
        }

        return {
          positionKey: positionKeyStr,
          positionKeyRaw: contractKey,
          market: marketName,
          marketAddress: marketAddress || 'N/A',
          account: account,
          isLong: isLong,
          sizeInUsd: sizeInUsd.toString(),
          sizeInTokens: (numbers.sizeInTokens || item.sizeInTokens || 0n).toString(),
          collateralAmount: collateralAmount.toString(),
          collateralToken: collateralToken,
          claimableFundingFeeUsd: claimableFundingAmountUsd.toString(),
          claimableFundingFeeFormatted: claimableFundingFeeFormatted,
        };
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.shortMessage || '';
      if (errorMessage.includes('EmptyMarketPrice')) {
        console.warn('EmptyMarketPrice error when getting all positions');
        return [];
      }
      console.error('Error getting all positions:', error);
      throw error;
    }
  }

  getConfig(): GMXConfig {
    return this.config;
  }
}

