import * as ethAccounts from 'web3-eth-accounts';
import * as web3Utils from 'web3-utils';
import { toBigInt } from 'web3-utils';
import type { Transaction } from 'web3-types';
import type { Address } from 'web3';
import { privateKeyToAccount } from 'web3-eth-accounts';
import { utils, Web3ZkSyncL2, ZKSyncWallet, Web3ZkSyncL1 } from '../../src';
import {
	IS_ETH_BASED,
	ADDRESS1,
	PRIVATE_KEY1,
	ADDRESS2,
	DAI_L1,
	USDC_L1,
	APPROVAL_TOKEN,
	PAYMASTER,
	deepEqualExcluding,
} from '../utils';
import type { Eip712TxData } from '../../src/types';
import { Network as ZkSyncNetwork } from '../../src/types';
import {
	ETH_ADDRESS,
	ETH_ADDRESS_IN_CONTRACTS,
	L2_BASE_TOKEN_ADDRESS,
	LEGACY_ETH_ADDRESS,
	DEFAULT_GAS_PER_PUBDATA_LIMIT,
	EIP712_TX_TYPE,
} from '../../src/constants';
import { IERC20ABI } from '../../src/contracts/IERC20';
import { getPaymasterParams } from '../../src/paymaster-utils';

jest.setTimeout(5 * 60000);

describe('Wallet', () => {
	const provider = Web3ZkSyncL2.initWithDefaultProvider(ZkSyncNetwork.Sepolia);
	const ethProvider = new Web3ZkSyncL1(
		'https://eth-sepolia.g.alchemy.com/v2/VCOFgnRGJF_vdAY2ZjgSksL6-6pYvRkz',
	);
	const PRIVATE_KEY = (process.env.PRIVATE_KEY as string) || PRIVATE_KEY1;
	const wallet = new ZKSyncWallet(PRIVATE_KEY, provider, ethProvider);
	const walletAddress = privateKeyToAccount(PRIVATE_KEY).address;
	describe('#constructor()', () => {
		it('`Wallet(privateKey, provider)` should return a `Wallet` with L2 provider', async () => {
			const wallet = new ZKSyncWallet(PRIVATE_KEY, provider);

			expect(wallet.account.privateKey).toEqual(PRIVATE_KEY);
			expect(wallet.provider).toEqual(provider);
		});

		it('`Wallet(privateKey, provider, ethProvider)` should return a `Wallet` with L1 and L2 provider', async () => {
			const wallet = new ZKSyncWallet(PRIVATE_KEY, provider, ethProvider);

			expect(wallet.account.privateKey).toEqual(PRIVATE_KEY);
			expect(wallet.provider).toEqual(provider);
			expect(wallet.providerL1).toEqual(ethProvider);
		});
	});

	describe('#getMainContract()', () => {
		it('should return the main contract', async () => {
			const result = await wallet.getMainContract();
			expect(result).not.toBeNull();
		});
	});

	describe('#getBridgehubContract()', () => {
		it('should return the bridgehub contract', async () => {
			const result = await wallet.getBridgehubContractAddress();
			expect(result).not.toBeNull();
		});
	});

	describe('#getL1BridgeContracts()', () => {
		it('should return the L1 bridge contracts', async () => {
			const result = await wallet.getL1BridgeContracts();
			expect(result).not.toBeNull();
		});
	});

	describe('#isETHBasedChain()', () => {
		it('should return whether the chain is ETH-based or not', async () => {
			const result = await wallet.isETHBasedChain();
			expect(result).toEqual(IS_ETH_BASED);
		});
	});

	describe('#getBaseToken()', () => {
		it('should return base token', async () => {
			const result = await wallet.getBaseToken();
			IS_ETH_BASED
				? expect(result).toEqual(ETH_ADDRESS_IN_CONTRACTS)
				: expect(result).not.toBeNull();
		});
	});

	describe('#getBalanceL1()', () => {
		it('should return a L1 balance', async () => {
			const result = await wallet.getBalanceL1();
			expect(result > 0n).toEqual(true);
		});
	});

	describe('#getAllowanceL1()', () => {
		it('should return an allowance of L1 token', async () => {
			const result = await wallet.getAllowanceL1(DAI_L1);
			expect(result >= 0n).toEqual(true);
		});
	});

	describe('#l2TokenAddress()', () => {
		it('should return the L2 base address', async () => {
			const baseToken = await provider.getBaseTokenContractAddress();
			const result = await wallet.l2TokenAddress(baseToken);
			expect(result).toEqual(L2_BASE_TOKEN_ADDRESS);
		});

		it('should return the L2 ETH address', async () => {
			if (!IS_ETH_BASED) {
				const result = await wallet.l2TokenAddress(LEGACY_ETH_ADDRESS);
				expect(result).not.toBeNull();
			}
		});

		it('should return the L2 DAI address', async () => {
			const result = await wallet.l2TokenAddress(DAI_L1);
			expect(result).not.toBeNull();
		});
	});

	describe('#approveERC20()', () => {
		it('should approve a L1 token', async () => {
			const result = await wallet.approveERC20(DAI_L1, 5);
			expect(result).not.toBeNull();
		});

		it('should throw an error when approving ETH token', async () => {
			try {
				await wallet.approveERC20(LEGACY_ETH_ADDRESS, 5);
			} catch (e) {
				expect((e as Error).message).toEqual(
					"ETH token can't be approved! The address of the token does not exist on L1.",
				);
			}
		});
	});

	describe('#getBaseCost()', () => {
		it('should return a base cost of L1 transaction', async () => {
			const result = await wallet.getBaseCost({ gasLimit: 100_000 });
			expect(result).not.toBeNull();
		});
	});

	describe('#getBalance()', () => {
		it('should return a `Wallet` balance', async () => {
			const result = await wallet.getBalance();
			expect(result > 0n).toEqual(true);
		});
	});

	describe('#getAllBalances()', () => {
		it('should return the all balances', async () => {
			const result = await wallet.getAllBalances();
			const expected = IS_ETH_BASED ? 2 : 3;
			expect(Object.keys(result)).toHaveLength(expected);
		});
	});

	describe('#getL2BridgeContracts()', () => {
		it('should return a L2 bridge contracts', async () => {
			const result = await wallet.getL2BridgeContracts();
			expect(result).not.toBeNull();
		});
	});

	describe('#getAddress()', () => {
		it('should return the `Wallet` address', async () => {
			const result = wallet.getAddress();
			expect(result).toEqual(walletAddress);
		});
	});

	// describe('#ethWallet()', () => {
	// 	it('should return a L1 `Wallet`', async () => {
	// 		const wallet = new ZKSyncWallet(PRIVATE_KEY, provider, ethProvider);
	// 		const ethWallet = wallet.ethWallet();
	// 		expect(ethWallet.signingKey.privateKey).toEqual(PRIVATE_KEY);
	// 		expect(ethWallet.provider).toEqual(ethProvider);
	// 	});
	//
	// 	it('should throw  an error when L1 `Provider` is not specified in constructor', async () => {
	// 		const wallet = new Wallet(PRIVATE_KEY, provider);
	// 		try {
	// 			wallet.ethWallet();
	// 		} catch (e) {
	// 			expect((e as Error).message).toEqual(
	// 				'L1 provider is missing! Specify an L1 provider using `Wallet.connectToL1()`.',
	// 			);
	// 		}
	// 	});
	// });

	describe('#connect()', () => {
		it('should return a `Wallet` with provided `provider` as L2 provider', async () => {
			const w = new ZKSyncWallet(PRIVATE_KEY);
			w.connect(provider);
			expect(w.account.privateKey).toEqual(PRIVATE_KEY);
			expect(w.provider).toEqual(provider);
		});
	});

	describe('#connectL1()', () => {
		it('should return a `Wallet` with provided `provider` as L1 provider', async () => {
			const w = new ZKSyncWallet(PRIVATE_KEY);
			w.connectToL1(ethProvider);
			expect(w.account.privateKey).toEqual(PRIVATE_KEY);
			expect(w.providerL1).toEqual(ethProvider);
		});
	});

	describe('#getDeploymentNonce()', () => {
		it('should return a deployment nonce', async () => {
			const result = await wallet.getDeploymentNonce();
			expect(result).not.toBeNull();
		});
	});

	describe('#populateTransaction()', () => {
		it('should return a populated transaction', async () => {
			const tx = {
				to: ADDRESS2,
				value: 7_000_000_000n,
				type: BigInt(EIP712_TX_TYPE),
				from: wallet.getAddress(),
				nonce: await wallet.getNonce('pending'),
				gasLimit: 154_379n,
				chainId: 300n,
				data: '0x',
				customData: { gasPerPubdata: 50_000, factoryDeps: [] },
				gasPrice: 100_000_000n,
			};

			// @ts-ignore
			const result = await wallet.populateTransaction({
				type: web3Utils.toHex(EIP712_TX_TYPE),
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000_000),
			});
			deepEqualExcluding(result, tx, [
				'gasLimit',
				'gasPrice',
				'maxFeePerGas',
				'maxPriorityFeePerGas',
			]);
			expect(toBigInt(result.gasLimit) > 0n).toEqual(true);
			expect(
				toBigInt(result.maxPriorityFeePerGas) > 0n ||
					toBigInt(result.maxFeePerGas) > 0n ||
					toBigInt(result.gasPrice) > 0n,
			).toEqual(true);
		});
		it('should return a populated transaction with default values if are omitted', async () => {
			const tx = {
				to: ADDRESS2,
				value: 7_000_000n,
				type: 2n,
				from: wallet.getAddress(),
				nonce: await wallet.getNonce('pending'),
				chainId: 300n,
				maxFeePerGas: 1_200_000_000n,
				maxPriorityFeePerGas: 1_000_000_000n,
			};
			// @ts-ignore
			const result = await wallet.populateTransaction({
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000),
			});
			deepEqualExcluding(result, tx, ['gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas']);
			expect(toBigInt(result.gasLimit) > 0n).toEqual(true);
			expect(toBigInt(result.maxFeePerGas) > 0n).toEqual(true);
			expect(toBigInt(result.maxPriorityFeePerGas) > 0n).toEqual(true);
		});
		it('should return populated transaction when `maxFeePerGas` and `maxPriorityFeePerGas` and `customData` are provided', async () => {
			const tx = {
				to: ADDRESS2,
				value: 7_000_000n,
				type: BigInt(EIP712_TX_TYPE),
				from: wallet.getAddress(),
				nonce: await wallet.getNonce('pending'),
				data: '0x',
				chainId: 300n,
				maxFeePerGas: 3_500_000_000n,
				maxPriorityFeePerGas: 2_000_000_000n,
				customData: {
					gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
					factoryDeps: [],
				},
			};
			// @ts-ignore
			const result = await wallet.populateTransaction({
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000),
				maxFeePerGas: web3Utils.toHex(3_500_000_000n),
				maxPriorityFeePerGas: web3Utils.toHex(2_000_000_000n),
				customData: {
					gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
					factoryDeps: [],
				},
			} as Eip712TxData);
			deepEqualExcluding(tx, result, ['gasLimit']);
			expect(toBigInt(result.gasLimit) > 0n).toEqual(true);
		});

		it('should return populated transaction when `maxPriorityFeePerGas` and `customData` are provided', async () => {
			const tx = {
				to: ADDRESS2,
				value: 7_000_000n,
				type: BigInt(EIP712_TX_TYPE),
				from: wallet.getAddress(),
				nonce: await wallet.getNonce('pending'),
				data: '0x',
				chainId: 300n,
				maxPriorityFeePerGas: 2_000_000_000n,
				customData: {
					gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
					factoryDeps: [],
				},
			};
			// @ts-ignore
			const result = await wallet.populateTransaction({
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000),
				maxPriorityFeePerGas: web3Utils.toHex(2_000_000_000n),
				customData: {
					gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
				},
			} as Eip712TxData);
			deepEqualExcluding(result, tx, ['gasLimit', 'maxFeePerGas']);
			expect(toBigInt(result.gasLimit) > 0n).toEqual(true);
		});

		it('should return populated transaction when `maxFeePerGas` and `customData` are provided', async () => {
			const tx = {
				to: ADDRESS2,
				value: 7_000_000n,
				type: BigInt(EIP712_TX_TYPE),
				from: wallet.getAddress(),
				nonce: await wallet.getNonce('pending'),
				data: '0x',
				chainId: 300n,
				maxFeePerGas: 3_500_000_000n,
				customData: {
					gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
					factoryDeps: [],
				},
			};
			// @ts-ignore
			const result = await wallet.populateTransaction({
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000),
				maxFeePerGas: web3Utils.toHex(3_500_000_000n),
				customData: {
					gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
				},
			} as Eip712TxData);
			deepEqualExcluding(tx, result, ['gasLimit']);
			expect(toBigInt(result.gasLimit) > 0n).toEqual(true);
		});

		it('should return populated EIP1559 transaction when `maxFeePerGas` and `maxPriorityFeePerGas` are provided', async () => {
			const tx = {
				to: ADDRESS2,
				value: 7_000_000n,
				type: 2n,
				from: wallet.getAddress(),
				nonce: await wallet.getNonce('pending'),
				chainId: 300n,
				maxFeePerGas: 3_500_000_000n,
				maxPriorityFeePerGas: 2_000_000_000n,
			};
			// @ts-ignore
			const result = await wallet.populateTransaction({
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000),
				maxFeePerGas: web3Utils.toHex(3_500_000_000n),
				maxPriorityFeePerGas: web3Utils.toHex(2_000_000_000n),
			});
			deepEqualExcluding(tx, result, ['gasLimit']);
			expect(toBigInt(result.gasLimit!) > 0n).toEqual(true);
		});

		it('should return populated EIP1559 transaction with `maxFeePerGas` and `maxPriorityFeePerGas` same as provided `gasPrice`', async () => {
			const tx = {
				to: ADDRESS2,
				value: 7_000_000n,
				type: 2,
				from: wallet.getAddress(),
				nonce: await wallet.getNonce('pending'),
				chainId: 300n,
				maxFeePerGas: 3_500_000_000n,
				maxPriorityFeePerGas: 3_500_000_000n,
			};
			// @ts-ignore
			const result = await wallet.populateTransaction({
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000),
				gasPrice: web3Utils.toHex(3_500_000_000n),
			});
			deepEqualExcluding(result, tx, ['gasLimit', 'type', 'gasPrice']);
			expect(toBigInt(result.gasLimit!) > 0n).toEqual(true);
		});

		it('should return populated legacy transaction when `type = 0`', async () => {
			const tx = {
				to: ADDRESS2,
				value: 7_000_000n,
				type: 0n,
				from: wallet.getAddress(),
				nonce: await wallet.getNonce('pending'),
				chainId: 300n,
				gasPrice: 100_000_000n,
			};
			// @ts-ignore
			const result = await wallet.populateTransaction({
				type: web3Utils.toHex(0),
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000),
			});
			deepEqualExcluding(tx, result, ['gasLimit', 'gasPrice']);
			expect(toBigInt(result.gasLimit!) > 0n).toEqual(true);
			expect(toBigInt(result.gasPrice!) > 0n).toEqual(true);
		});
	});

	describe('#sendTransaction()', () => {
		it('should send already populated transaction with provided `maxFeePerGas` and `maxPriorityFeePerGas` and `customData` fields', async () => {
			const populatedTx = (await wallet.populateTransaction({
				to: ADDRESS2 as Address,
				value: web3Utils.toHex(7_000_000),
				maxFeePerGas: web3Utils.toHex(3_500_000_000n),
				maxPriorityFeePerGas: web3Utils.toHex(2_000_000_000n),
				// @ts-ignore
				customData: {
					gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
				},
			})) as unknown as Transaction;
			const tx = await wallet.sendTransaction(populatedTx);
			const result = await tx.wait();
			expect(result).not.toBeNull();
		});

		it('should send EIP1559 transaction when `maxFeePerGas` and `maxPriorityFeePerGas` are provided', async () => {
			const tx = await wallet.sendTransaction({
				to: ADDRESS2,
				value: 7_000_000,
				maxFeePerGas: 3_500_000_000n,
				maxPriorityFeePerGas: 2_000_000_000n,
			});
			const result = await tx.wait();
			expect(result).not.toBeNull();
			expect(result.type).toEqual(2n);
		});

		it('should send already populated EIP1559 transaction with `maxFeePerGas` and `maxPriorityFeePerGas`', async () => {
			const populatedTx = await wallet.populateTransaction({
				to: ADDRESS2,
				value: web3Utils.toHex(7_000_000),
				maxFeePerGas: web3Utils.toHex(3_500_000_000n),
				maxPriorityFeePerGas: web3Utils.toHex(2_000_000_000n),
			});

			const tx = await wallet.sendTransaction(populatedTx as Transaction);
			const result = await tx.wait();
			expect(result).not.toBeNull();
			expect(result.type).toEqual(2n);
		});

		it('should send EIP1559 transaction with `maxFeePerGas` and `maxPriorityFeePerGas` same as provided `gasPrice`', async () => {
			const tx = await wallet.sendTransaction({
				to: ADDRESS2,
				value: 7_000_000,
				gasPrice: 3_500_000_000n,
			});
			const result = await tx.wait();
			expect(result).not.toBeNull();
			expect(result.type).toEqual(0n);
		});

		it('should send legacy transaction when `type = 0`', async () => {
			const tx = await wallet.sendTransaction({
				type: 0,
				to: ADDRESS2,
				value: 7_000_000,
			});
			const result = await tx.wait();
			expect(result).not.toBeNull();
			expect(result.type).toEqual(0n);
		});
	});

	// describe('#fromMnemonic()', () => {
	// 	it('should return a `Wallet` with the `provider` as L1 provider and a private key that is built from the `mnemonic` passphrase', async () => {
	// 		const wallet = Web3ZkSyncL2.fromMnemonic(MNEMONIC1, ethProvider);
	// 		expect(wallet.signingKey.privateKey).toEqual(PRIVATE_KEY);
	// 		expect(wallet.providerL1).toEqual(ethProvider);
	// 	});
	// });

	// describe('#fromEncryptedJson()', () => {
	// 	it('should return a `Wallet` from encrypted `json` file using provided `password`', async () => {
	// 		const wallet = await Wallet.fromEncryptedJson(
	// 			fs.readFileSync('tests/files/wallet.json', 'utf8'),
	// 			'password',
	// 		);
	// 		expect(wallet.signingKey.privateKey).toEqual(PRIVATE_KEY);
	// 	})
	// });

	// describe('#fromEncryptedJsonSync()', () => {
	// 	it('should return a `Wallet` from encrypted `json` file using provided `password`', async () => {
	// 		const wallet = Wallet.fromEncryptedJsonSync(
	// 			fs.readFileSync('tests/files/wallet.json', 'utf8'),
	// 			'password',
	// 		);
	// 		expect(wallet.signingKey.privateKey).toEqual(PRIVATE_KEY);
	// 	})
	// });

	describe('#createRandom()', () => {
		it('should return a random `Wallet` with L2 provider', async () => {
			const wallet = ZKSyncWallet.createRandom(provider);
			expect(wallet.account.privateKey).not.toBeNull();
			expect(wallet.provider).toEqual(provider);
		});
	});

	describe('#getDepositTx()', () => {
		if (IS_ETH_BASED) {
			it('should return ETH deposit transaction', async () => {
				const tx = {
					contractAddress: wallet.getAddress(),
					calldata: '0x',
					l2Value: 7_000_000,
					l2GasLimit: 415_035n,
					mintValue: 111_540_663_250_000n,
					token: ETH_ADDRESS_IN_CONTRACTS,
					to: wallet.getAddress(),
					amount: 7_000_000,
					refundRecipient: wallet.getAddress(),
					operatorTip: 0,
					overrides: {
						from: wallet.getAddress(),
						maxFeePerGas: 1_000_000_001n,
						maxPriorityFeePerGas: 1_000_000_000n,
						value: 111_540_663_250_000n,
					},
					gasPerPubdataByte: 800,
				};
				const result = await wallet.getDepositTx({
					token: LEGACY_ETH_ADDRESS,
					to: wallet.getAddress(),
					amount: 7_000_000,
					refundRecipient: wallet.getAddress(),
				});
				deepEqualExcluding(result, tx, ['l2GasLimit', 'mintValue', 'overrides']);
				expect(result.l2GasLimit > 0n).toEqual(true);
				expect(result.mintValue > 0n).toEqual(true);
				expect(utils.isAddressEq(result.overrides.from, wallet.getAddress())).toEqual(true);
				expect(result.overrides.maxFeePerGas > 0n).toEqual(true);
				expect(result.overrides.maxPriorityFeePerGas > 0n).toEqual(true);
				expect(result.overrides.value > 0n).toEqual(true);
			});

			it('should return a deposit transaction with `tx.to == Wallet.getAddress()` when `tx.to` is not specified', async () => {
				const tx = {
					contractAddress: wallet.getAddress(),
					calldata: '0x',
					l2Value: 7_000_000,
					l2GasLimit: 415_035n,
					mintValue: 111_540_663_250_000n,
					token: ETH_ADDRESS_IN_CONTRACTS,
					amount: 7_000_000,
					refundRecipient: wallet.getAddress(),
					operatorTip: 0,
					overrides: {
						from: wallet.getAddress(),
						maxFeePerGas: 1_000_000_001n,
						maxPriorityFeePerGas: 1_000_000_000n,
						value: 111_540_663_250_000n,
					},
					gasPerPubdataByte: 800,
				};
				const result = await wallet.getDepositTx({
					token: LEGACY_ETH_ADDRESS,
					amount: 7_000_000,
					refundRecipient: wallet.getAddress(),
				});
				deepEqualExcluding(tx, result, ['l2GasLimit', 'mintValue', 'overrides']);
				expect(result.l2GasLimit > 0n).toEqual(true);
				expect(result.mintValue > 0n).toEqual(true);
				expect(utils.isAddressEq(result.overrides.from, wallet.getAddress())).toEqual(true);
				expect(result.overrides.maxFeePerGas > 0n).toEqual(true);
				expect(result.overrides.maxPriorityFeePerGas > 0n).toEqual(true);
				expect(result.overrides.value > 0n).toEqual(true);
			});

			it('should return USDC deposit transaction', async () => {
				const transaction = {
					maxFeePerGas: 1_000_000_001n,
					maxPriorityFeePerGas: 1_000_000_000n,
					value: 105_100_275_000_000n,
					from: wallet.getAddress(),
					to: await provider.getBridgehubContractAddress(),
				};
				const result = await wallet.getDepositTx({
					token: USDC_L1,
					to: wallet.getAddress(),
					amount: 5,
					refundRecipient: wallet.getAddress(),
				});
				const tx = (await wallet.populateTransaction(
					result.tx.populateTransaction(result.overrides),
				)) as Transaction;

				expect(tx.from!.toLowerCase()).toBe(transaction.from.toLowerCase());
				expect(tx.to!.toLowerCase()).toBe(transaction.to.toLowerCase());
				expect(tx.maxFeePerGas).toBeGreaterThan(0n);
				expect(tx.maxFeePerGas).toBeGreaterThan(0n);
				expect(tx.maxPriorityFeePerGas).toBeGreaterThan(0n);
				expect(tx.value).toBeGreaterThan(0n);
			});
		} else {
			it('should return ETH deposit transaction', async () => {
				const tx = {
					from: ADDRESS1,
					to: (await provider.getBridgehubContractAddress()).toLowerCase(),
					value: 7_000_000n,
					data: '0x24fd57fb0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000010e0000000000000000000000000000000000000000000000000000bf1aaa17ee7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000062e3d000000000000000000000000000000000000000000000000000000000000032000000000000000000000000036615cf349d7f6344891b1e7ca7c72883f5dc049000000000000000000000000842deab39809094bf5e4b77a7f97ae308adc5e5500000000000000000000000000000000000000000000000000000000006acfc0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000036615cf349d7f6344891b1e7ca7c72883f5dc049',
					maxFeePerGas: 1_000_000_001n,
					maxPriorityFeePerGas: 1_000_000_000n,
				};
				const result = await wallet.getDepositTx({
					token: LEGACY_ETH_ADDRESS,
					to: wallet.getAddress(),
					amount: 7_000_000,
					refundRecipient: wallet.getAddress(),
				});
				result.to = result.to.toLowerCase();
				const { data: a, maxFeePerGas: b, maxPriorityFeePerGas: c, ...otherTx } = tx;
				const {
					data: d,
					maxFeePerGas: e,
					maxPriorityFeePerGas: f,
					...otherResult
				} = result;

				expect(otherResult).toEqual(otherTx);
				expect(toBigInt(result.maxPriorityFeePerGas) > 0n).toEqual(true);
				expect(toBigInt(result.maxFeePerGas) > 0n).toEqual(true);
			});

			it('should return a deposit transaction with `tx.to == Wallet.getAddress()` when `tx.to` is not specified', async () => {
				const tx = {
					from: ADDRESS1,
					to: (await provider.getBridgehubContractAddress()).toLowerCase(),
					value: 7_000_000n,
					maxFeePerGas: 1_000_000_001n,
					maxPriorityFeePerGas: 1000_000_000n,
				};
				const result = await wallet.getDepositTx({
					token: LEGACY_ETH_ADDRESS,
					amount: 7_000_000,
					refundRecipient: wallet.getAddress(),
				});
				result.to = result.to.toLowerCase();
				deepEqualExcluding(tx, result, ['data', 'maxFeePerGas', 'maxPriorityFeePerGas']);
				expect(toBigInt(result.maxPriorityFeePerGas) > 0n).toEqual(true);
				expect(toBigInt(result.maxFeePerGas) > 0n).toEqual(true);
			});

			it('should return DAI deposit transaction', async () => {
				const tx = {
					maxFeePerGas: 1_000_000_001n,
					maxPriorityFeePerGas: 1_000_000_000n,
					value: 0n,
					from: ADDRESS1,
					to: (await provider.getBridgehubContractAddress()).toLowerCase(),
				};
				const result = await wallet.getDepositTx({
					token: DAI_L1,
					to: wallet.getAddress(),
					amount: 5,
					refundRecipient: wallet.getAddress(),
				});
				result.to = result.to.toLowerCase();
				deepEqualExcluding(tx, result, ['data', 'maxFeePerGas', 'maxPriorityFeePerGas']);
				expect(toBigInt(result.maxPriorityFeePerGas) > 0n).toEqual(true);
				expect(toBigInt(result.maxFeePerGas) > 0n).toEqual(true);
			});
		}
	});

	describe('#estimateGasDeposit()', () => {
		if (IS_ETH_BASED) {
			it('should return a gas estimation for the ETH deposit transaction', async () => {
				const result = await wallet.estimateGasDeposit({
					token: LEGACY_ETH_ADDRESS,
					to: wallet.getAddress(),
					amount: 5,
					refundRecipient: wallet.getAddress(),
				});
				expect(result > 0n).toEqual(true);
			});

			it('should return a gas estimation for the USDC deposit transaction', async () => {
				const result = await wallet.estimateGasDeposit({
					token: USDC_L1,
					to: wallet.getAddress(),
					amount: 5,
					refundRecipient: wallet.getAddress(),
				});
				expect(result > 0n).toEqual(true);
			});
		} else {
			it('should throw an error for insufficient allowance when estimating gas for ETH deposit transaction', async () => {
				try {
					await wallet.estimateGasDeposit({
						token: LEGACY_ETH_ADDRESS,
						to: wallet.getAddress(),
						amount: 5,
						refundRecipient: wallet.getAddress(),
					});
				} catch (e: any) {
					expect(e.reason).toMatch('ERC20: insufficient allowance');
				}
			});

			it('should return gas estimation for ETH deposit transaction', async () => {
				const token = LEGACY_ETH_ADDRESS;
				const amount = 5;
				const approveParams = await wallet.getDepositAllowanceParams(token, amount);

				await wallet.approveERC20(approveParams[0].token, approveParams[0].allowance);

				const result = await wallet.estimateGasDeposit({
					token: token,
					to: wallet.getAddress(),
					amount: amount,
					refundRecipient: wallet.getAddress(),
				});
				expect(result > 0n).toEqual(true);
			});

			it('should return gas estimation for base token deposit transaction', async () => {
				const token = await wallet.getBaseToken();
				const amount = 5;
				const approveParams = await wallet.getDepositAllowanceParams(token, amount);

				await wallet.approveERC20(approveParams[0].token, approveParams[0].allowance);

				const result = await wallet.estimateGasDeposit({
					token: token,
					to: wallet.getAddress(),
					amount: amount,
					refundRecipient: wallet.getAddress(),
				});
				expect(result > 0n).toEqual(true);
			});

			it('should return gas estimation for DAI deposit transaction', async () => {
				const token = DAI_L1;
				const amount = 5;
				const approveParams = await wallet.getDepositAllowanceParams(token, amount);

				await wallet.approveERC20(approveParams[0].token, approveParams[0].allowance);
				await wallet.approveERC20(approveParams[1].token, approveParams[1].allowance);

				const result = await wallet.estimateGasDeposit({
					token: token,
					to: wallet.getAddress(),
					amount: amount,
					refundRecipient: wallet.getAddress(),
				});
				expect(result > 0n).toEqual(true);
			});
		}
	});

	describe('#deposit()', () => {
		if (IS_ETH_BASED) {
			it('should deposit ETH to L2 network', async () => {
				const amount = 7_000_000_000;
				const l2BalanceBeforeDeposit = await wallet.getBalance();
				const l1BalanceBeforeDeposit = await wallet.getBalanceL1();
				const tx = await wallet.deposit({
					token: LEGACY_ETH_ADDRESS,
					to: wallet.getAddress(),
					amount,
					refundRecipient: wallet.getAddress(),
				});
				console.log('tx', tx);
				const result = await tx.wait();
				console.log('result', result);
				const l2BalanceAfterDeposit = await wallet.getBalance();
				const l1BalanceAfterDeposit = await wallet.getBalanceL1();
				expect(result).not.toBeNull();
				expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= 0).toBe(true);
				expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= 0).toBe(true);
			});

			it('should deposit USDC to L2 network', async () => {
				const amount = 5;
				const l2USDC = await provider.l2TokenAddress(USDC_L1);
				const l2BalanceBeforeDeposit = await wallet.getBalance(l2USDC);
				const l1BalanceBeforeDeposit = await wallet.getBalanceL1(USDC_L1);
				const tx = await wallet.deposit({
					token: USDC_L1,
					to: wallet.getAddress(),
					amount: amount,
					approveERC20: true,
					refundRecipient: wallet.getAddress(),
				});
				const result = await tx.wait();
				const l2BalanceAfterDeposit = await wallet.getBalance(l2USDC);
				const l1BalanceAfterDeposit = await wallet.getBalanceL1(USDC_L1);
				expect(result).not.toBeNull();
				expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= 0).toEqual(true);
				expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= 0).toEqual(true);
			});

			it('should deposit USDC to the L2 network with approve transaction for allowance', async () => {
				const amount = 7;
				const l2USDC = await provider.l2TokenAddress(USDC_L1);
				const l2BalanceBeforeDeposit = await wallet.getBalance(l2USDC);
				const l1BalanceBeforeDeposit = await wallet.getBalanceL1(USDC_L1);
				const tx = await wallet.deposit({
					token: USDC_L1,
					to: wallet.getAddress(),
					amount,
					approveERC20: true,
					refundRecipient: wallet.getAddress(),
				});
				const result = await tx.wait();
				await tx.waitFinalize();
				const l2BalanceAfterDeposit = await wallet.getBalance(l2USDC);
				const l1BalanceAfterDeposit = await wallet.getBalanceL1(USDC_L1);
				expect(result).not.toBeNull();
				expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).toEqual(true);
				expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).toEqual(true);
			});
		} else {
			it('should deposit ETH to L2 network', async () => {
				const amount = 7_000_000_000;
				const l2EthAddress = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const l2BalanceBeforeDeposit = await wallet.getBalance(l2EthAddress);
				const l1BalanceBeforeDeposit = await wallet.getBalanceL1();
				const tx = await wallet.deposit({
					token: ETH_ADDRESS,
					to: wallet.getAddress(),
					amount: amount,
					approveBaseERC20: true,
					refundRecipient: wallet.getAddress(),
				});
				const result = await tx.wait();
				const l2BalanceAfterDeposit = await wallet.getBalance(l2EthAddress);
				const l1BalanceAfterDeposit = await wallet.getBalanceL1();
				expect(result).not.toBeNull();
				expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).toEqual(true);
				expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).toEqual(true);
			});

			it('should deposit base token to L2 network', async () => {
				const amount = 5;
				const baseTokenL1 = await wallet.getBaseToken();
				const l2BalanceBeforeDeposit = await wallet.getBalance();
				const l1BalanceBeforeDeposit = await wallet.getBalanceL1(baseTokenL1);
				const tx = await wallet.deposit({
					token: baseTokenL1,
					to: wallet.getAddress(),
					amount: amount,
					approveERC20: true,
					refundRecipient: wallet.getAddress(),
				});
				const result = await tx.wait();
				const l2BalanceAfterDeposit = await wallet.getBalance();
				const l1BalanceAfterDeposit = await wallet.getBalanceL1(baseTokenL1);
				expect(result).not.toBeNull();
				expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).toEqual(true);
				expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= 0n).toEqual(true);
			});

			it('should deposit DAI to L2 network', async () => {
				const amount = 5;
				const l2DAI = await provider.l2TokenAddress(DAI_L1);
				const l2BalanceBeforeDeposit = await wallet.getBalance(l2DAI);
				const l1BalanceBeforeDeposit = await wallet.getBalanceL1(DAI_L1);
				const tx = await wallet.deposit({
					token: DAI_L1,
					to: wallet.getAddress(),
					amount: amount,
					approveERC20: true,
					approveBaseERC20: true,
					refundRecipient: wallet.getAddress(),
				});
				const result = await tx.wait();
				const l2BalanceAfterDeposit = await wallet.getBalance(l2DAI);
				const l1BalanceAfterDeposit = await wallet.getBalanceL1(DAI_L1);
				expect(result).not.toBeNull();
				expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).toEqual(true);
				expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).toEqual(true);
			});
		}
	});

	describe('#claimFailedDeposit()', () => {
		if (IS_ETH_BASED) {
			it('should claim failed deposit', async () => {
				const response = await wallet.deposit({
					token: USDC_L1,
					to: wallet.getAddress(),
					amount: 5,
					approveERC20: true,
					refundRecipient: wallet.getAddress(),
					l2GasLimit: 300_000, // make it fail because of low gas
				});
				const receipt = await response.wait();
				expect(receipt.transactionHash).toBeDefined();
				// console.log('rr', rr);
				// try {
				// 	await response.waitFinalize();
				// } catch (error) {
				// const hash = '0x229f99f63a6fd5e90154546797c56348e8f6260808bf63769ea22e842d09750f';
				// const blockNumber = (await wallet.provider!.eth.getTransaction(hash)).blockNumber!;
				// // Now wait for block number to be executed.
				// let blockDetails: BlockDetails;
				// do {
				// 	// still not executed.
				// 	await utils.sleep(500);
				// 	blockDetails = await wallet.provider!.getBlockDetails(blockNumber);
				// } while (!blockDetails || !blockDetails.executeTxHash);
				// const result = await wallet.claimFailedDeposit(hash);
				// expect(result?.blockHash).not.toBeNull();
				// }
			});

			it('should throw an error when trying to claim successful deposit', async () => {
				const response = await wallet.deposit({
					token: LEGACY_ETH_ADDRESS,
					to: wallet.getAddress(),
					amount: 7_000_000_000,
					refundRecipient: wallet.getAddress(),
				});
				const tx = await response.waitFinalize();
				try {
					await wallet.claimFailedDeposit(tx.transactionHash);
				} catch (e) {
					expect((e as Error).message).toEqual('Cannot claim successful deposit!');
				}
			});
		} else {
			it('should throw an error when trying to claim successful deposit', async () => {
				const response = await wallet.deposit({
					token: await wallet.getBaseToken(),
					to: wallet.getAddress(),
					amount: 5,
					approveERC20: true,
					refundRecipient: wallet.getAddress(),
				});
				const tx = await response.waitFinalize();
				try {
					await wallet.claimFailedDeposit(tx.transactionHash);
				} catch (e) {
					expect((e as Error).message).toEqual('Cannot claim successful deposit!');
				}
			});
		}
	});

	describe('#getFullRequiredDepositFee()', () => {
		if (IS_ETH_BASED) {
			it('should return a fee for ETH token deposit', async () => {
				const result = await wallet.getFullRequiredDepositFee({
					token: LEGACY_ETH_ADDRESS,
					to: wallet.getAddress(),
				});
				expect(result.baseCost > 0n).toEqual(true);
				expect(result.l1GasLimit > 0n).toEqual(true);
				expect(result.l2GasLimit > 0n).toEqual(true);
				expect(result.maxPriorityFeePerGas! > 0n).toEqual(true);
				expect(result.maxFeePerGas! > 0n).toEqual(true);
			});

			it('should throw an error when there is not enough allowance to cover the deposit', async () => {
				try {
					await wallet.getFullRequiredDepositFee({
						token: USDC_L1,
						to: wallet.getAddress(),
					});
				} catch (e) {
					expect((e as Error).message).toEqual(
						'Not enough allowance to cover the deposit!',
					);
				}
			});

			it('should return a fee for DAI token deposit', async () => {
				await wallet.approveERC20(USDC_L1, 5);

				const result = await wallet.getFullRequiredDepositFee({
					token: USDC_L1,
					to: wallet.getAddress(),
				});
				expect(result.baseCost > 0n).toEqual(true);
				expect(result.l1GasLimit > 0n).toEqual(true);
				expect(result.l2GasLimit > 0n).toEqual(true);
				expect(result.maxPriorityFeePerGas! > 0n).toEqual(true);
				expect(result.maxFeePerGas! > 0n).toEqual(true);
			});

			it('should throw Not enough balance for deposit!', async () => {
				//Not enough allowance to cover the deposit!
				expect(async () => {
					const randomWallet = new ZKSyncWallet(
						wallet.providerL1!.eth.accounts.create().privateKey,
						provider,
						ethProvider,
					);

					await randomWallet.getFullRequiredDepositFee({
						token: USDC_L1,
						to: wallet.getAddress(),
					});
				}).rejects.toThrow('Not enough balance for deposit!');
			});
		} else {
			it('should throw an error when there is not enough base token allowance to cover the deposit', async () => {
				try {
					await new ZKSyncWallet(
						ethAccounts.create().privateKey,
						provider,
						ethProvider,
					).getFullRequiredDepositFee({
						token: LEGACY_ETH_ADDRESS,
						to: wallet.getAddress(),
					});
				} catch (e) {
					expect((e as Error).message).toEqual(
						'Not enough base token allowance to cover the deposit!',
					);
				}
			});

			it('should return fee for ETH token deposit', async () => {
				const token = LEGACY_ETH_ADDRESS;
				const approveParams = await wallet.getDepositAllowanceParams(token, 1);

				await wallet.approveERC20(approveParams[0].token, approveParams[0].allowance);

				const result = await wallet.getFullRequiredDepositFee({
					token: token,
					to: wallet.getAddress(),
				});
				expect(result.baseCost > 0n).toEqual(true);
				expect(result.l1GasLimit > 0n).toEqual(true);
				expect(result.l2GasLimit > 0n).toEqual(true);
				expect(result.maxPriorityFeePerGas! > 0n).toEqual(true);
				expect(result.maxFeePerGas! > 0n).toEqual(true);
			});

			it('should return fee for base token deposit', async () => {
				const token = await wallet.getBaseToken();
				const approveParams = await wallet.getDepositAllowanceParams(token, 1);

				await wallet.approveERC20(approveParams[0].token, approveParams[0].allowance);

				const result = await wallet.getFullRequiredDepositFee({
					token: token,
					to: wallet.getAddress(),
				});
				expect(result).not.toBeNull();
			});

			it('should return fee for DAI token deposit', async () => {
				const token = DAI_L1;
				const approveParams = await wallet.getDepositAllowanceParams(token, 1);

				await wallet.approveERC20(approveParams[0].token, approveParams[0].allowance);
				await wallet.approveERC20(approveParams[1].token, approveParams[1].allowance);

				const result = await wallet.getFullRequiredDepositFee({
					token: token,
					to: wallet.getAddress(),
				});
				expect(result.baseCost > 0n).toEqual(true);
				expect(result.l1GasLimit > 0n).toEqual(true);
				expect(result.l2GasLimit > 0n).toEqual(true);
				expect(result.maxPriorityFeePerGas! > 0n).toEqual(true);
				expect(result.maxFeePerGas! > 0n).toEqual(true);
			});

			it('should throw an error when there is not enough token allowance to cover the deposit', async () => {
				const token = DAI_L1;
				const randomWallet = new ZKSyncWallet(
					ethAccounts.create().privateKey,
					provider,
					ethProvider,
				);

				// mint base token to random wallet
				const baseToken = new ethProvider.eth.Contract(
					IERC20ABI,
					await wallet.getBaseToken(),
				);

				await baseToken.methods
					.mint(randomWallet.getAddress(), web3Utils.toWei('0.5', 'ether'))
					.send({ from: wallet.getAddress() });

				// transfer ETH to random wallet so that base token approval tx can be performed
				await ethProvider.eth.sendTransaction({
					from: wallet.getAddress(),
					to: randomWallet.getAddress(),
					value: web3Utils.toWei('0.1', 'ether'),
				});

				const approveParams = await randomWallet.getDepositAllowanceParams(token, 1);
				// only approve base token
				await randomWallet.approveERC20(approveParams[0].token, approveParams[0].allowance);
				try {
					await randomWallet.getFullRequiredDepositFee({
						token: token,
						to: wallet.getAddress(),
					});
				} catch (e) {
					expect((e as Error).message).toEqual(
						'Not enough token allowance to cover the deposit!',
					);
				}
			});
		}
	});

	describe('#withdraw()', () => {
		if (IS_ETH_BASED) {
			it('should withdraw ETH to the L1 network', async () => {
				const amount = 7n;
				// const l2BalanceBeforeWithdrawal = await wallet.getBalance();
				const withdrawTx = await wallet.withdraw({
					token: LEGACY_ETH_ADDRESS,
					to: wallet.getAddress(),
					amount: amount,
				});
				const receipt = await withdrawTx.wait();
				expect(receipt.transactionHash).toBeDefined();
				// works but in sepolia we need to wait few hours to finalize block
				// const txHash = '0xd638355396984ae5f94660ad5b803890f952e036e846b5ea23213d8335e8aef6';
				// expect(await wallet.isWithdrawalFinalized(txHash)).toEqual(false);
				//
				// const result = await wallet.finalizeWithdrawal(txHash);
				// // const l2BalanceAfterWithdrawal = await wallet.getBalance();
				// expect(result).not.toBeNull();
				// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toEqual(
				// 	true,
				// );
			});

			it.skip('should withdraw ETH to the L1 network using paymaster to cover fee', async () => {
				const amount = 7n;
				const minimalAllowance = 1n;
				// const paymasterBalanceBeforeWithdrawal = await provider.eth.getBalance(PAYMASTER);
				// const paymasterTokenBalanceBeforeWithdrawal = await provider.getTokenBalance(
				// 	APPROVAL_TOKEN,
				// 	PAYMASTER,
				// );
				// const l2BalanceBeforeWithdrawal = await wallet.getBalance();
				// const l2ApprovalTokenBalanceBeforeWithdrawal =
				// 	await wallet.getBalance(APPROVAL_TOKEN);

				const tx = await wallet.withdraw({
					token: ETH_ADDRESS_IN_CONTRACTS,
					to: wallet.getAddress(),
					amount: amount,
					paymasterParams: getPaymasterParams(PAYMASTER, {
						type: 'ApprovalBased',
						token: APPROVAL_TOKEN,
						minimalAllowance,
						innerInput: new Uint8Array(),
					}),
				});
				const receipt = await tx.wait();

				expect(receipt).toBeDefined();
				// const withdrawTx = await tx.waitFinalize();
				// expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(
				// 	false,
				// );
				//
				// const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);
				//
				// const paymasterBalanceAfterWithdrawal = await provider.eth.getBalance(PAYMASTER);
				// const paymasterTokenBalanceAfterWithdrawal = await provider.getTokenBalance(
				// 	APPROVAL_TOKEN,
				// 	PAYMASTER,
				// );
				// const l2BalanceAfterWithdrawal = await wallet.getBalance();
				// const l2ApprovalTokenBalanceAfterWithdrawal =
				// 	await wallet.getBalance(APPROVAL_TOKEN);
				//
				// expect(
				// 	paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
				// ).toEqual(true);
				// expect(
				// 	paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
				// ).toEqual(minimalAllowance);
				//
				// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toEqual(amount);
				// expect(
				// 	l2ApprovalTokenBalanceAfterWithdrawal ===
				// 		l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
				// ).toEqual(true);
				//
				// expect(result).not.toBeNull();
			});
		} else {
			it('should withdraw ETH to the L1 network', async () => {
				const amount = 7_000_000_000n;
				const token = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const l2BalanceBeforeWithdrawal = await wallet.getBalance(token);
				const tx = await wallet.withdraw({
					token: token,
					to: wallet.getAddress(),
					amount: amount,
				});
				const withdrawTx = await tx.waitFinalize();
				expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(
					false,
				);

				const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);
				const l2BalanceAfterWithdrawal = await wallet.getBalance(token);
				expect(result).not.toBeNull();
				expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toEqual(
					true,
				);
			});

			it('should withdraw base token to the L1 network', async () => {
				const amount = 7_000_000_000n;
				const baseToken = await wallet.getBaseToken();
				const l2BalanceBeforeWithdrawal = await wallet.getBalance();
				const tx = await wallet.withdraw({
					token: baseToken,
					to: wallet.getAddress(),
					amount: amount,
				});
				const withdrawTx = await tx.waitFinalize();
				expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(
					false,
				);

				const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);
				const l2BalanceAfterWithdrawal = await wallet.getBalance();
				expect(result).not.toBeNull();
				expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toEqual(
					true,
				);
			});

			it('should withdraw ETH to the L1 network using paymaster to cover fee', async () => {
				const amount = 7_000_000_000n;
				const minimalAllowance = 1n;

				const token = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const paymasterBalanceBeforeWithdrawal = await provider.eth.getBalance(PAYMASTER);
				const paymasterTokenBalanceBeforeWithdrawal = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const l2BalanceBeforeWithdrawal = await wallet.getBalance(token);
				const l2ApprovalTokenBalanceBeforeWithdrawal =
					await wallet.getBalance(APPROVAL_TOKEN);

				const tx = await wallet.withdraw({
					token: token,
					to: wallet.getAddress(),
					amount: amount,
					paymasterParams: getPaymasterParams(PAYMASTER, {
						type: 'ApprovalBased',
						token: APPROVAL_TOKEN,
						minimalAllowance: minimalAllowance,
						innerInput: new Uint8Array(),
					}),
				});
				const withdrawTx = await tx.waitFinalize();
				expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(
					false,
				);

				const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);

				const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
				const paymasterTokenBalanceAfterWithdrawal = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const l2BalanceAfterWithdrawal = await wallet.getBalance(token);
				const l2ApprovalTokenBalanceAfterWithdrawal =
					await wallet.getBalance(APPROVAL_TOKEN);

				expect(
					paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
				).toEqual(true);
				expect(
					paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
				).toEqual(minimalAllowance);

				expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toEqual(amount);
				expect(
					l2ApprovalTokenBalanceAfterWithdrawal ===
						l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
				).toEqual(true);

				expect(result).not.toBeNull();
			});
		}

		it('should withdraw USDC to the L1 network', async () => {
			const amount = 5n;
			const l2USDC = await provider.l2TokenAddress(USDC_L1);
			const l2BalanceBeforeWithdrawal = await wallet.getBalance(l2USDC);
			const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(USDC_L1);
			expect(l2BalanceBeforeWithdrawal).toBeGreaterThan(0n);
			expect(l1BalanceBeforeWithdrawal).toBeDefined();
			const tx = await wallet.withdraw({
				token: l2USDC,
				to: wallet.getAddress(),
				amount: amount,
			});
			const receipt = await tx.wait();
			expect(receipt.transactionHash).toBeDefined();
			// const withdrawTx = await tx.waitFinalize();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(false);
			//
			// const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);
			// const l2BalanceAfterWithdrawal = await wallet.getBalance(l2USDC);
			// const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);

			// expect(result).not.toBeNull();
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toEqual(amount);
			// expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toEqual(amount);
		});

		it.skip('should withdraw USDC to the L1 network using paymaster to cover fee', async () => {
			const amount = 5n;
			const minimalAllowance = 1n;
			const l2USDC = await provider.l2TokenAddress(USDC_L1);

			const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeWithdrawal = await provider.getTokenBalance(
				APPROVAL_TOKEN,
				PAYMASTER,
			);
			const l2BalanceBeforeWithdrawal = await wallet.getBalance(l2USDC);
			const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(USDC_L1);
			const l2ApprovalTokenBalanceBeforeWithdrawal = await wallet.getBalance(APPROVAL_TOKEN);

			const tx = await wallet.withdraw({
				token: l2USDC,
				to: wallet.getAddress(),
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const withdrawTx = await tx.waitFinalize();
			expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(false);

			const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);

			const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
				APPROVAL_TOKEN,
				PAYMASTER,
			);
			const l2BalanceAfterWithdrawal = await wallet.getBalance(l2USDC);
			const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(USDC_L1);
			const l2ApprovalTokenBalanceAfterWithdrawal = await wallet.getBalance(APPROVAL_TOKEN);

			expect(
				paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
			).toEqual(true);
			expect(
				paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
			).toEqual(minimalAllowance);
			expect(
				l2ApprovalTokenBalanceAfterWithdrawal ===
					l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
			).toEqual(true);

			expect(result).not.toBeNull();
			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toEqual(amount);
			expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toEqual(amount);
		});
	});

	describe('#getRequestExecuteTx()', () => {
		const amount = 7_000_000_000;
		if (IS_ETH_BASED) {
			it('should return request execute transaction', async () => {
				const result = await wallet.getRequestExecuteTx({
					contractAddress: await provider.getBridgehubContractAddress(),
					calldata: '0x',
					l2Value: amount,
				});
				expect(result).not.toBeNull();
			});
		} else {
			it('should return request execute transaction', async () => {
				const result = await wallet.getRequestExecuteTx({
					contractAddress: wallet.getAddress(),
					calldata: '0x',
					l2Value: amount,
					overrides: { nonce: 0 },
				});
				expect(result).not.toBeNull();
			});
		}
	});

	describe('#estimateGasRequestExecute()', () => {
		if (IS_ETH_BASED) {
			it('should return gas estimation for request execute transaction', async () => {
				const result = await wallet.estimateGasRequestExecute({
					contractAddress: await provider.getBridgehubContractAddress(),
					calldata: '0x',
					l2Value: 7_000_000_000,
				});
				expect(result > 0n).toEqual(true);
			});
		} else {
			it('should return gas estimation for request execute transaction', async () => {
				const tx = {
					contractAddress: wallet.getAddress(),
					calldata: '0x',
					l2Value: 7_000_000_000,
					overrides: { value: 0 },
				};

				const approveParams = await wallet.getRequestExecuteAllowanceParams(tx);
				await wallet.approveERC20(approveParams.token, approveParams.allowance);

				const result = await wallet.estimateGasRequestExecute(tx);
				expect(result > 0n).toEqual(true);
			});
		}
	});

	describe('#requestExecute()', () => {
		if (IS_ETH_BASED) {
			it('should request transaction execution on L2 network', async () => {
				const amount = 7_000_000_000;
				const l2BalanceBeforeExecution = await wallet.getBalance();
				const l1BalanceBeforeExecution = await wallet.getBalanceL1();
				const tx = await wallet.requestExecute({
					contractAddress: await provider.getBridgehubContractAddress(),
					calldata: '0x',
					l2Value: amount,
					l2GasLimit: 900_000,
				});
				const result = await tx.waitFinalize();
				const l2BalanceAfterExecution = await wallet.getBalance();
				const l1BalanceAfterExecution = await wallet.getBalanceL1();
				expect(result).not.toBeNull();
				expect(l2BalanceAfterExecution - l2BalanceBeforeExecution >= amount).toEqual(true);
				expect(l1BalanceBeforeExecution - l1BalanceAfterExecution >= amount).toEqual(true);
			});
		} else {
			it('should request transaction execution on L2 network', async () => {
				const amount = 7_000_000_000;
				const request = {
					contractAddress: wallet.getAddress(),
					calldata: '0x',
					l2Value: amount,
					l2GasLimit: 1_319_957n,
					operatorTip: 0,
					gasPerPubdataByte: 800,
					refundRecipient: wallet.getAddress(),
					overrides: {
						maxFeePerGas: 1_000_000_010n,
						maxPriorityFeePerGas: 1_000_000_000n,
						gasLimit: 238_654n,
						value: 0,
					},
				};

				const approveParams = await wallet.getRequestExecuteAllowanceParams(request);
				await wallet.approveERC20(approveParams.token, approveParams.allowance);

				const l2BalanceBeforeExecution = await wallet.getBalance();
				const l1BalanceBeforeExecution = await wallet.getBalanceL1();

				const tx = await wallet.requestExecute(request);
				const result = await tx.wait();
				const l2BalanceAfterExecution = await wallet.getBalance();
				const l1BalanceAfterExecution = await wallet.getBalanceL1();
				expect(result).not.toBeNull();
				expect(l2BalanceAfterExecution - l2BalanceBeforeExecution >= amount).toEqual(true);
				expect(l1BalanceBeforeExecution - l1BalanceAfterExecution >= amount).toEqual(true);
			});
		}
	});

	describe('#transfer()', () => {
		it('should transfer ETH or base token depending on chain type', async () => {
			const amount = 7n;
			const balanceBeforeTransfer = await provider.getBalance(ADDRESS1);
			const result = await wallet.transfer({
				token: await wallet.getBaseToken(),
				to: ADDRESS1,
				amount: amount,
			});
			await result.wait();
			const balanceAfterTransfer = await provider.getBalance(ADDRESS1);
			expect(result).not.toBeNull();
			expect(balanceAfterTransfer - balanceBeforeTransfer).toEqual(amount);
		});

		it.skip('should transfer ETH or base token depending on chain using paymaster to cover fee', async () => {
			const amount = 7_000_000_000n;
			const minimalAllowance = 1n;

			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeTransfer = await provider.getTokenBalance(
				APPROVAL_TOKEN,
				PAYMASTER,
			);
			const senderBalanceBeforeTransfer = await wallet.getBalance();
			const senderApprovalTokenBalanceBeforeTransfer =
				await wallet.getBalance(APPROVAL_TOKEN);
			const receiverBalanceBeforeTransfer = await provider.getBalance(ADDRESS2, 'latest');

			const result = await wallet.transfer({
				to: ADDRESS2,
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});

			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceAfterTransfer = await provider.getBalance(
				APPROVAL_TOKEN,
				PAYMASTER,
			);
			const senderBalanceAfterTransfer = await wallet.getBalance();
			const senderApprovalTokenBalanceAfterTransfer = await wallet.getBalance(APPROVAL_TOKEN);
			const receiverBalanceAfterTransfer = await provider.getBalance(ADDRESS2);

			expect(paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n).toEqual(
				true,
			);
			expect(
				paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer,
			).toEqual(minimalAllowance);

			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toEqual(amount);
			expect(
				senderApprovalTokenBalanceAfterTransfer ===
					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
			).toEqual(true);

			expect(result).not.toBeNull();
			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toEqual(amount);
		});

		if (!IS_ETH_BASED) {
			it('should transfer ETH on non eth based chain', async () => {
				const amount = 7_000_000_000n;
				const token = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const balanceBeforeTransfer = await provider.getTokenBalance(token, ADDRESS2);
				const result = await wallet.transfer({
					token: LEGACY_ETH_ADDRESS,
					to: ADDRESS2,
					amount: amount,
				});
				const balanceAfterTransfer = await provider.getTokenBalance(token, ADDRESS2);
				expect(result).not.toBeNull();
				expect(balanceAfterTransfer - balanceBeforeTransfer).toEqual(amount);
			});

			it('should transfer ETH using paymaster to cover fee', async () => {
				const amount = 7_000_000_000n;
				const minimalAllowance = 1n;

				const token = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
				const paymasterTokenBalanceBeforeTransfer = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const senderBalanceBeforeTransfer = await wallet.getBalance(token);
				const senderApprovalTokenBalanceBeforeTransfer =
					await wallet.getBalance(APPROVAL_TOKEN);
				const receiverBalanceBeforeTransfer = await provider.getTokenBalance(
					token,
					ADDRESS2,
				);

				const result = await wallet.transfer({
					token: token,
					to: ADDRESS2,
					amount: amount,
					paymasterParams: getPaymasterParams(PAYMASTER, {
						type: 'ApprovalBased',
						token: APPROVAL_TOKEN,
						minimalAllowance: minimalAllowance,
						innerInput: new Uint8Array(),
					}),
				});

				const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
				const paymasterTokenBalanceAfterTransfer = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const senderBalanceAfterTransfer = await wallet.getBalance(token);
				const senderApprovalTokenBalanceAfterTransfer =
					await wallet.getBalance(APPROVAL_TOKEN);
				const receiverBalanceAfterTransfer = await provider.getTokenBalance(
					token,
					ADDRESS2,
				);

				expect(
					paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
				).toEqual(true);
				expect(
					paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer,
				).toEqual(minimalAllowance);

				expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toEqual(amount);
				expect(
					senderApprovalTokenBalanceAfterTransfer ===
						senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
				).toEqual(true);

				expect(result).not.toBeNull();
				expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toEqual(
					amount,
				);
			});
		}

		it('should transfer USDC', async () => {
			const amount = 5n;
			const l2USDC = await provider.l2TokenAddress(USDC_L1);
			const balanceBeforeTransfer = await provider.getTokenBalance(l2USDC, ADDRESS2);
			const result = await wallet.transfer({
				token: l2USDC,
				to: ADDRESS2,
				amount: amount,
			});
			const receipt = await result.wait();
			console.log('receipt', receipt);
			const balanceAfterTransfer = await provider.getTokenBalance(l2USDC, ADDRESS2);
			expect(result).not.toBeNull();
			expect(balanceAfterTransfer - balanceBeforeTransfer).toEqual(amount);
		});

		it.skip('should transfer DAI using paymaster to cover fee', async () => {
			const amount = 5n;
			const minimalAllowance = 1n;
			const l2DAI = await provider.l2TokenAddress(DAI_L1);

			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeTransfer = await provider.getTokenBalance(
				APPROVAL_TOKEN,
				PAYMASTER,
			);
			const senderBalanceBeforeTransfer = await wallet.getBalance(l2DAI);
			const senderApprovalTokenBalanceBeforeTransfer =
				await wallet.getBalance(APPROVAL_TOKEN);
			const receiverBalanceBeforeTransfer = await provider.getTokenBalance(l2DAI, ADDRESS2);

			const result = await wallet.transfer({
				token: l2DAI,
				to: ADDRESS2,
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});

			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceAfterTransfer = await provider.getTokenBalance(
				APPROVAL_TOKEN,
				PAYMASTER,
			);
			const senderBalanceAfterTransfer = await wallet.getBalance(l2DAI);
			const senderApprovalTokenBalanceAfterTransfer = await wallet.getBalance(APPROVAL_TOKEN);
			const receiverBalanceAfterTransfer = await provider.getTokenBalance(l2DAI, ADDRESS2);

			expect(paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n).toEqual(
				true,
			);
			expect(
				paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer,
			).toEqual(minimalAllowance);

			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toEqual(amount);
			expect(
				senderApprovalTokenBalanceAfterTransfer ===
					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
			).toEqual(true);

			expect(result).not.toBeNull();
			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toEqual(amount);
		});

		if (!IS_ETH_BASED) {
			it('should transfer base token', async () => {
				const amount = 7_000_000_000n;
				const balanceBeforeTransfer = await provider.getBalance(ADDRESS2);
				const result = await wallet.transfer({
					token: await wallet.getBaseToken(),
					to: ADDRESS2,
					amount: amount,
				});
				const balanceAfterTransfer = await provider.getBalance(ADDRESS2);
				expect(result).not.toBeNull();
				expect(balanceAfterTransfer - balanceBeforeTransfer).toEqual(amount);
			});
		}
	});

	describe('#signTransaction()', () => {
		it('should return a signed type EIP1559 transaction', async () => {
			const result = await wallet.signTransaction({
				type: 2,
				to: ADDRESS2,
				value: 7_000_000_000n,
			});
			expect(result).not.toBeNull();
		});

		it('should return a signed EIP712 transaction', async () => {
			const result = await wallet.signTransaction({
				type: EIP712_TX_TYPE,
				to: ADDRESS2,
				value: 1,
			});
			expect(result).not.toBeNull();
		});

		it('should throw an error when `tx.from` is mismatched from private key', async () => {
			try {
				await wallet.signTransaction({
					type: EIP712_TX_TYPE,
					from: ADDRESS2,
					to: ADDRESS2,
					value: 1,
				});
			} catch (e) {
				expect((e as Error).message).toMatch('Transaction from mismatch');
			}
		});
	});
});
