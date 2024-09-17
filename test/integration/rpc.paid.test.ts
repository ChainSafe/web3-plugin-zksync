import { Web3 } from 'web3';
import { ZKsyncPlugin } from '../../src';
import { PRIVATE_KEY1 } from '../utils';
import { privateKeyToAccount } from 'web3-eth-accounts';
const PRIVATE_KEY = (process.env.PRIVATE_KEY as string) || PRIVATE_KEY1;
const mainAccount = privateKeyToAccount(PRIVATE_KEY);
describe('ZkSyncPlugin rpc paid tests', () => {
	let web3: Web3;

	beforeAll(() => {
		web3 = new Web3();
		web3.registerPlugin(new ZKsyncPlugin('https://sepolia.era.zksync.dev'));
		web3.ZKsync.L2.eth.accounts.wallet.add(mainAccount);
	});

	it('sendRawTransactionWithDetailedOutput', async () => {
		const populated = await web3.ZKsync.L2.populateTransaction({
			from: mainAccount.address,
			to: '0x9a6de0f62aa270a8bcb1e2610078650d539b1ef9',
			value: 1n,
		});
		const signed = await web3.ZKsync.L2.signTransaction(populated);
		const res = await web3.ZKsync.rpc.sendRawTransactionWithDetailedOutput(signed);
		expect(res.transactionHash).toBeDefined();
		expect(res.storageLogs).toBeDefined();
		expect(Array.isArray(res.storageLogs)).toBeTruthy();
		expect(res.storageLogs.length).toBeGreaterThan(0);
		expect(res.events).toBeDefined();
		expect(Array.isArray(res.events)).toBeTruthy();
		expect(res.events.length).toBeGreaterThan(0);
	});
});
