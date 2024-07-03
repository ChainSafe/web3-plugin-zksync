import { Web3 } from 'web3';
import * as web3Accounts from 'web3-eth-accounts';
import { TransactionFactory } from 'web3-eth-accounts';
import { Network as ZkSyncNetwork } from '../../src/types';
import { Web3ZkSyncL2, ZkSyncPlugin } from '../../src';
import { EIP712_TX_TYPE, ETH_ADDRESS } from '../../src/constants';
import * as utils from '../../src/utils';

// TODO: This test needs to setup local dev nodes for L1 and L2
// and also needs to have a private key with funds in the L1
// to be able to run the test.
// Additionally, the test needs to be fixed as `wallet.deposit` throws an internal exception.

jest.setTimeout(50000);
describe('wallet', () => {
	// @ts-ignore
	TransactionFactory.registerTransactionType(EIP712_TX_TYPE, utils.EIP712Transaction);
	const web3 = new Web3('https://eth-sepolia.g.alchemy.com/v2/VCOFgnRGJF_vdAY2ZjgSksL6-6pYvRkz');
	const l2Provider = Web3ZkSyncL2.initWithDefaultProvider(ZkSyncNetwork.Sepolia);
	const plugin = new ZkSyncPlugin(l2Provider);
	web3.registerPlugin(plugin);
	const PRIVATE_KEY = (process.env.PRIVATE_KEY as string) || web3Accounts.create().privateKey;

	const wallet = new web3.zkSync.ZKSyncWallet(PRIVATE_KEY);
	// The wallet could also be initialized as follows:
	// // const l1Provider = new Web3ZkSyncL1( // or new Web3(
	// 	'https://eth-sepolia.g.alchemy.com/v2/VCOFgnRGJF_vdAY2ZjgSksL6-6pYvRkz',
	// )
	// const wallet = new ZKSyncWallet(PRIVATE_KEY, l2Provider, l1Provider);

	it('should deposit', async () => {
		const tx = await wallet.deposit({
			token: ETH_ADDRESS,
			to: wallet.getAddress(),
			amount: 10n,
			refundRecipient: wallet.getAddress(),
		});
		const receipt = await tx.wait();

		console.log(`Tx: ${receipt.transactionHash}`);

		expect(receipt.status).toBe(1n);
		expect(receipt.transactionHash).toBeDefined();
	});

	it.only('should withdraw eth', async () => {
		const tx = await wallet.withdraw({
			token: ETH_ADDRESS,
			to: wallet.getAddress(),
			amount: 10n,
		});
		const receipt = await tx.wait();

		console.log(`Tx: ${receipt.transactionHash}`);

		expect(receipt.status).toBe(1n);
		expect(receipt.transactionHash).toBeDefined();
	});
});
