import type { BlockNumberOrTag } from 'web3-types';
import { Web3ZkSync } from './web3zksync';
import type { Address } from './types';
import { isETH } from './utils';

/**
 * Provides a connection to the L1 chain.
 */
export class Web3ZKsyncL1 extends Web3ZkSync {
	// TODO:  Add and possibly move some of the methods from `Web3ZkSync` class.
	async getBalance(
		address: Address,
		blockTag?: BlockNumberOrTag,
		tokenAddress?: Address,
	): Promise<bigint> {
		if (!tokenAddress || isETH(tokenAddress)) {
			return this.eth.getBalance(address, blockTag);
		} else {
			try {
				return this.getTokenBalance(tokenAddress, address);
			} catch {
				return 0n;
			}
		}
	}
}
