import axios from "axios";
import { getTokenSymbol } from "../infrastructure/utils";
import DatabaseClient from "../infrastructure/DatabaseClient";
import TzktProvider from "../infrastructure/TzktProvider";
import {
  Config,
  Dependecies,
  Contracts,
  PoolsApiResponse,
  BigMapUpdateResponseType,
  AmmData,
  BribeApiResponse,
  Token,
} from "../types";
import BribesProcessor from "./BribesProcessor";
import PositionsProcessor from "./PositionsProcessor";

export default class PoolsProcessor {
  private _config: Config;
  private _dbClient: DatabaseClient;
  private _tkztProvider: TzktProvider;
  private _contracts: Contracts;
  private _bribesProcessor: BribesProcessor;
  private _positionProcessor: PositionsProcessor;
  private _getPools: () => Promise<any>;
  private _getTokens: () => Promise<Token[]>;
  constructor(
    { config, dbClient, tzktProvider, contracts, getPools, getTokens }: Dependecies,
    bribesProcessor: BribesProcessor,
    positionProcessor: PositionsProcessor
  ) {
    this._config = config;
    this._dbClient = dbClient;
    this._tkztProvider = tzktProvider;
    this._contracts = contracts;
    this._bribesProcessor = bribesProcessor;
    this._positionProcessor = positionProcessor;
    this._getPools = getPools;
    this._getTokens = getTokens;
  }

  async process(): Promise<void> {
    try {
      const pools: PoolsApiResponse[] = await this._tkztProvider.getPools(
        this._contracts.bigMaps.amm_to_gauge_bribe.toString()
      );
      console.log(pools);
      for (const pool of pools) {
        const existingEntry = await this._dbClient.get({
          select: "*",
          table: "pools",
          where: `amm='${pool.key}'`,
        });
        if (existingEntry.rowCount === 0) {
          await this._processPool(pool);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
  private async _processPool(pool: PoolsApiResponse): Promise<void> {
    try {
      //get Token Data
      const tokens = await this._getTokens();
      //get AMM data (lqtTokenAddress, token1Address and token2Address)
      const ammData = await this.getAmmData(pool.key);
      //get gaugeBigMap
      const { gaugeBigMap, derivedBigMap, attachBigMap } = await this._tkztProvider.getGaugeBigMap(pool.value.gauge);
      //get bribeBigMap
      const { bribeBigMap, bribeClaimLedgerBigMap } = await this._tkztProvider.getBribeBigMap(pool.value.bribe);
      //process all bribes
      await this._bribesProcessor.process(bribeBigMap, pool.key, tokens);
      //process all position
      await this._positionProcessor.process(pool.key, gaugeBigMap, derivedBigMap, attachBigMap, ammData.lqtBigMap);

      //save in db
      console.log(`Inseting Pool ${pool.key}`);
      this._dbClient.insert({
        table: "pools",
        columns:
          "(amm, type, lqt_decimals, lqt_Token, token1, token2, token1_variant, token2_variant, token1_decimals, token2_decimals, token1_Id, token2_Id, token1_symbol, token2_symbol, lqt_Token_BigMap, gauge, bribe, gauge_BigMap, attach_BigMap, derived_BigMap, bribe_BigMap, bribe_claim_ledger)",
        values: `('${pool.key}', '${ammData.type}', ${ammData.lqtDecimals}, '${ammData.lqtAddress}', '${
          ammData.token1.address
        }', '${ammData.token2.address}', '${ammData.token1.variant}', '${ammData.token2.variant}', '${
          ammData.token1.decimals
        }', '${ammData.token2.decimals}', ${ammData.token1.tokenId || null}, ${ammData.token2.tokenId || null}, '${
          ammData.token1.symbol
        }', '${ammData.token2.symbol}', '${ammData.lqtBigMap}', '${pool.value.gauge}', '${
          pool.value.bribe
        }', '${gaugeBigMap}', '${attachBigMap}', '${derivedBigMap}', '${bribeBigMap}', '${bribeClaimLedgerBigMap}')`,
      });
    } catch (e) {
      console.log(e);
    }
  }

  private async getAmmData(amm: string): Promise<AmmData> {
    try {
      const result = (await this._getPools())[amm];

      const lqtBigMap = await this._tkztProvider.getLqtBigMap(result.lpToken.address);

      return {
        token1: {
          address: result.token1.address,
          symbol: result.token1.symbol,
          variant: result.token1.standard,
          tokenId: result.token1.tokenId ?? null,
          decimals: result.token1.decimals,
        },
        token2: {
          address: result.token2.address,
          symbol: result.token2.symbol,
          variant: result.token2.standard,
          tokenId: result.token2.tokenId ?? null,
          decimals: result.token2.decimals,
        },
        address: result.address,
        type: result.type,
        lqtAddress: result.lpToken.address,
        lqtBigMap: lqtBigMap,
        lqtDecimals: result.lpToken.decimals,
      };
    } catch (err) {
      throw err;
    }
  }

  async updatePools(level: string): Promise<void> {
    try {
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.amm_to_gauge_bribe.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          updates.forEach(async (update) => {
            if (update.action === "add_key") {
              await this._processPool({
                key: update.content.key,
                value: update.content.value,
              });
            } else {
              console.log("Removing poool", update.content.key);
              await this._dbClient.delete({
                table: "pools",
                where: `amm='${update.content.key}'`,
              });
            }
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error b:", err);
      throw err;
    }
  }
}
