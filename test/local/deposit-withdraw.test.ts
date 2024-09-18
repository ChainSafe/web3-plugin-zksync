import { Web3ZKsyncL2, Web3ZKsyncL1, ZKsyncWallet } from '../../src';
import { ETH_ADDRESS } from '../../src/constants';
import { getAccounts } from './fixtures';
import { L1_CHAIN_URL, L2_CHAIN_URL } from '../utils';

// TODO: This test needs to setup local dev nodes for L1 and L2
// and also needs to have a private key with funds in the L1
// to be able to run the test.
// Additionally, the test needs to be fixed as `wallet.deposit` throws an internal exception.

jest.setTimeout(60000);
describe('wallet', () => {
	const l1Provider = new Web3ZKsyncL1(L1_CHAIN_URL);
	const accounts = getAccounts();
	const l2Provider = new Web3ZKsyncL2(L2_CHAIN_URL);
	const PRIVATE_KEY = accounts[0].privateKey;
	const wallet = new ZKsyncWallet(PRIVATE_KEY, l2Provider, l1Provider);
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
