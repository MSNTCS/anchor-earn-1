import { BlockTxBroadcastResult, Dec, isTxError } from '@terra-money/terra.js';
import { CHAINS, Output, STATUS, TxDetails, TxType } from './types';
import { Parse } from '../utils/parse-input';
import { JSONSerializable } from '../utils/json';
import getNaturalDecimals = Parse.getNaturalDecimals;
import processLog = Parse.processLog;
import subNaturalDecimals = Parse.subNaturalDecimals;

const DEFAULT_DEDUCTED_TAX = '0';

export interface OperationError {
  type: TxType;
  chain: CHAINS;
  status: STATUS;
  error_msg: string;
}

export class OutputImpl
  extends JSONSerializable<OutputImpl.Data>
  implements Output {
  chain: string;
  network: string;
  status: STATUS;
  type: TxType;
  currency: string;
  amount: string;
  txDetails: TxDetails[];
  txFee: string;
  deductedTax?: string;

  constructor(
    txResult: BlockTxBroadcastResult,
    type: TxType,
    chain: string,
    network: string,
    taxFee: string,
    gasPrice: number,
    requestedAmount?: string,
  ) {
    super();
    this.type = type === TxType.SENDAUST ? TxType.SEND : type;
    this.network = network;
    this.chain = chain;

    if (isTxError(txResult)) {
      this.status = STATUS.UNSUCCESSFUL;
    } else {
      this.status = STATUS.SUCCESSFUL;
      this.txDetails = [
        {
          chain: chain,
          height: txResult.height,
          timestamp: new Date(),
          txHash: txResult.txhash,
        },
      ];
      this.txFee = computeTax(gasPrice, txResult.gas_wanted, taxFee);
      const processedLog = processLog(txResult.logs, type);
      this.amount = processedLog[0];
      this.currency = processedLog[1];
      this.deductedTax = requestedAmount
        ? subNaturalDecimals(requestedAmount, this.amount)
        : DEFAULT_DEDUCTED_TAX;
    }
  }

  public toData(): OutputImpl.Data {
    return {
      type: this.type,
      status: this.status,
      currency: this.currency,
      tx_details: this.txDetails,
      amount: this.amount,
      tx_fee: this.txFee,
      deducted_tax: this.deductedTax ? this.deductedTax : '0',
      chain: this.chain,
      network: this.network,
    };
  }
}

export namespace OutputImpl {
  export interface Data {
    type: string;
    status: string;
    tx_details: TxDetails[];
    currency: string;
    amount: string;
    tx_fee: string;
    deducted_tax?: string;
    chain: string;
    network: string;
  }
}

function computeTax(
  gasPrice: number,
  gasWanted: number,
  taxFee: string,
): string {
  return getNaturalDecimals(
    new Dec(taxFee)
      .mul(1000000)
      .add(gasPrice * gasWanted + 1)
      .toString(),
  ).concat(' UST');
}
