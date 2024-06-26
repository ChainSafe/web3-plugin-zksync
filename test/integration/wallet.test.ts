import * as web3Utils from 'web3-utils';
import { Web3Eth } from 'web3-eth';
import * as web3Accounts from 'web3-eth-accounts';

import { Network as ZkSyncNetwork } from '../../src/types';
import { Web3ZkSyncL2, constants, ZKSyncWallet } from '../../src';

// TODO: This test needs to setup local dev nodes for L1 and L2
// and also needs to have a private key with funds in the L1
// to be able to run the test.
// Additionally, the test needs to be fixed as `wallet.deposit` throws an internal exception.
describe('wallet', () => {
	const provider = Web3ZkSyncL2.initWithDefaultProvider(ZkSyncNetwork.Localhost);
	const web3Context = new Web3Eth('http://127.0.0.1:8545'); // ethereum dev net
	const PRIVATE_KEY = (process.env.PRIVATE_KEY as string) || web3Accounts.create().privateKey;
	const wallet = new ZKSyncWallet(PRIVATE_KEY, provider, web3Context);

	it.skip('should return true if correct', async () => {
		console.log(`L2 balance before deposit: ${await wallet.getBalance()}`);
		console.log(`L1 balance before deposit: ${await wallet.getBalanceL1()}`);

		const tx = await wallet.deposit({
			token: constants.ETH_ADDRESS,
			to: await wallet.getAddress(),
			amount: web3Utils.toWei('0.00020', 'ether'),
			refundRecipient: await wallet.getAddress(),
		});
		const receipt = await tx.wait();
		console.log(`Tx: ${receipt.hash}`);

		console.log(`L2 balance after deposit: ${await wallet.getBalance()}`);
		console.log(`L1 balance after deposit: ${await wallet.getBalanceL1()}`);

		// TODO: after fixing the logic, add the assertion
		// expect().toBe();
	});
});