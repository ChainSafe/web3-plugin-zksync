import { TransactionReceipt } from 'web3-types';

type TxInfo = {
	hash?: string;
	receipt?: TransactionReceipt;
};
export class ReceiptError extends Error {
	private info: TxInfo;
	constructor(message: string, info: TxInfo) {
		super(message);
		this.info = info;
		this.name = 'DepositError';
	}
	get hash() {
		return this.info?.hash;
	}
	get receipt() {
		return this.info?.receipt;
	}
}
