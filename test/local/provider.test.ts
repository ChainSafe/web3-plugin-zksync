import { Web3ZKsyncL2, ZKsyncWallet, SmartAccount } from '../../src';
import { L2Provider } from './fixtures';
import { ADDRESS2, PRIVATE_KEY1, PRIVATE_KEY2 } from '../utils';
import { EIP712_TX_TYPE } from '../../src/constants';
import { privateKeyToAccount } from 'web3-eth-accounts';
describe('EIP712Signer', () => {
	it('should different wallets be able to use different accounts, even when using the same EIP712Signer', async () => {
		const l2Provider = new Web3ZKsyncL2(L2Provider);
		const w1 = new ZKsyncWallet(PRIVATE_KEY1, l2Provider);

		const s1 = await w1.provider?.signTransaction({
			type: EIP712_TX_TYPE,
			to: ADDRESS2,
			value: 7_000_000n,
			from: w1.address,
			chainId: 1,
		});
		const w2 = new ZKsyncWallet(PRIVATE_KEY2, l2Provider);
		await w2.provider?.signTransaction({
			type: EIP712_TX_TYPE,
			to: ADDRESS2,
			value: 7_000_000n,
			from: w2.address,
			chainId: 1,
		});

		const s11 = await w1.provider?.signTransaction({
			type: EIP712_TX_TYPE,
			to: ADDRESS2,
			value: 7_000_000n,
			from: w1.address,
			chainId: 1,
		});
		expect(s11).toBe(s1);
		expect(w1.getAddress()).not.toBe(w2.getAddress());
	});

	it('should be different wallet when use the same provider', async () => {
		const l2Provider = new Web3ZKsyncL2(L2Provider);
		const acc = privateKeyToAccount(PRIVATE_KEY1);
		const acc2 = privateKeyToAccount(PRIVATE_KEY2);
		const sa1 = new SmartAccount(
			{
				secret: acc.privateKey,
				address: acc.address,
			},
			l2Provider,
		);

		const s1 = await sa1.provider?.signTransaction({
			type: EIP712_TX_TYPE,
			to: ADDRESS2,
			value: 7_000_000n,
			from: acc.address,
			chainId: 1,
		});
		const sa2 = new SmartAccount(
			{
				secret: acc2.privateKey,
				address: acc2.address,
			},
			l2Provider,
		);
		await sa2.provider?.signTransaction({
			type: EIP712_TX_TYPE,
			to: ADDRESS2,
			value: 7_000_000n,
			from: acc2.address,
			chainId: 1,
		});

		const s11 = await sa1.provider?.signTransaction({
			type: EIP712_TX_TYPE,
			to: ADDRESS2,
			value: 7_000_000n,
			from: acc.address,
			chainId: 1,
		});
		expect(s11).toBe(s1);
		expect(sa1.getAddress()).not.toBe(sa2.getAddress());
	});
});
