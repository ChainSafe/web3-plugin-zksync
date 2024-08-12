import { TransactionFactory } from 'web3-eth-accounts';
import { Web3ZkSyncL2, Web3ZkSyncL1, ZKSyncWallet } from '../../src';
import { EIP712_TX_TYPE, ETH_ADDRESS } from '../../src/constants';
import * as utils from '../../src/utils';
import { getAccounts, L1Provider, L2Provider } from './fixtures';

// TODO: This test needs to setup local dev nodes for L1 and L2
// and also needs to have a private key with funds in the L1
// to be able to run the test.
// Additionally, the test needs to be fixed as `wallet.deposit` throws an internal exception.

jest.setTimeout(10000);
describe('wallet', () => {
	// @ts-ignore
	TransactionFactory.registerTransactionType(EIP712_TX_TYPE, utils.EIP712Transaction);
	const l1Provider = new Web3ZkSyncL1(L1Provider);
	const accounts = getAccounts();
	const l2Provider = new Web3ZkSyncL2(L2Provider);
	const PRIVATE_KEY = accounts[0].privateKey;
	const wallet = new ZKSyncWallet(PRIVATE_KEY, l2Provider, l1Provider);
	it('should deposit', async () => {
		const tx = await wallet.deposit({
			token: ETH_ADDRESS,
			to: wallet.getAddress(),
			amount: 10000_000000_000000n,
			refundRecipient: wallet.getAddress(),
		});
		const receipt = await tx.wait();

		expect(receipt.status).toBe(1n);
		expect(receipt.transactionHash).toBeDefined();
	});

	it('should withdraw eth', async () => {
		const tx = await wallet.withdraw({
			token: ETH_ADDRESS,
			to: wallet.getAddress(),
			amount: 10n,
		});
		const receipt = await tx.wait();

		expect(receipt.status).toBe(1n);
		expect(receipt.transactionHash).toBeDefined();
	});
});
