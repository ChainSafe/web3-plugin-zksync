import { Web3 } from 'web3';
import { QuickNodeProvider, Network } from 'web3-rpc-providers';
import type { ZKSyncContractsCollection } from 'src/plugin';
import { ZKsyncPlugin } from '../../src';

describe('ZkSyncPlugin rpc tests', () => {
	let web3: Web3;
	let zkSync: ZKsyncPlugin;
	let contracts: ZKSyncContractsCollection;

	beforeAll(async () => {
		web3 = new Web3(new QuickNodeProvider(Network.ETH_SEPOLIA));
		zkSync = new ZKsyncPlugin('https://sepolia.era.zksync.dev');
	});

	it('contracts only works after registering the plugin', async () => {
		expect(zkSync.Contracts).rejects.toThrow();
		web3.registerPlugin(zkSync);

		// after registering the plugin, the Contracts property should be  without throwing an error
		contracts = await zkSync.Contracts;
		expect(contracts).toBeDefined();
	});

	it('should be able to call contracts methods', async () => {
		expect(await contracts.L1.ZkSyncMainContract).toBeDefined();

		// ZkSyncMainContract is a proxy contract at 0x9A6DE0f62Aa270A8bCB1e2610078650D539B1Ef9
		// that is a proxy to the actual contract at 0x550cf73F4b50aA0DF0257f2D07630D48fA00f73a
		// TODO: Need to check how to either get the actual contract address or how to call the proxy with now issues
		// current error when calling the proxy is: "ContractExecutionError: Error happened while trying to execute a function inside a smart contract"
		// related web3.js issue: https://github.com/web3/web3.js/issues/7143
		contracts.L1.ZkSyncMainContract.options.address =
			'0x550cf73F4b50aA0DF0257f2D07630D48fA00f73a';

		const contractName = await contracts.L1.ZkSyncMainContract.methods.getName().call();

		expect(contractName).toBe('MailboxFacet');
	});
});
