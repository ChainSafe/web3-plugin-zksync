import * as web3Utils from 'web3-utils';
import type { Contract } from 'web3-eth-contract';

import { TransactionFactory } from 'web3-eth-accounts';
import { ContractFactory, utils, Web3ZKsyncL2, ZKsyncWallet } from '../../src';
import { PRIVATE_KEY1, DAI_L1, L2_CHAIN_URL } from '../utils';

import Token from '../files/Token.json';
import Paymaster from '../files/Paymaster.json';
import Storage from '../files/Storage.json';
import Demo from '../files/Demo.json';
import { EIP712_TX_TYPE } from '../../src/constants';

describe('ContractFactory', () => {
	// @ts-ignore
	TransactionFactory.registerTransactionType(EIP712_TX_TYPE, utils.EIP712Transaction);
	const provider = new Web3ZKsyncL2(L2_CHAIN_URL);
	const wallet = new ZKsyncWallet(PRIVATE_KEY1, provider);

	describe('#constructor()', () => {
		it('`ContractFactory(abi, bytecode, runner)` should return a `ContractFactory` with `create` deployment', async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet);

			expect(factory.deploymentType).toBe('create');
		});

		it("`ContractFactory(abi, bytecode, runner, 'createAccount')` should return a `ContractFactory` with `createAccount` deployment", async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet, 'createAccount');

			expect(factory.deploymentType).toBe('createAccount');
		});

		it("`ContractFactory(abi, bytecode, runner, 'create2')` should return a `ContractFactory` with `create2` deployment", async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet, 'create2');

			expect(factory.deploymentType).toBe('create2');
		});

		it("`ContractFactory(abi, bytecode, runner, 'create2Account')` should return a `ContractFactory` with `create2Account` deployment", async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet, 'create2Account');

			expect(factory.deploymentType).toBe('create2Account');
		});
	});

	describe('#deploy()', () => {
		it('should deploy a contract without constructor using CREATE opcode', async () => {
			const abi = Storage.contracts['Storage.sol:Storage'].abi;
			const bytecode: string = Storage.contracts['Storage.sol:Storage'].bin;
			const factory = new ContractFactory(abi, bytecode, wallet);

			const contract = await factory.deploy();

			const code = await provider.eth.getCode(contract.options.address as string);
			expect(code).not.toBeNull();
		});

		it('should deploy a contract with a constructor using CREATE opcode', async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet);
			const contract = await factory.deploy(['Ducat', 'Ducat', 18]);

			const code = await provider.eth.getCode(contract.options.address as string);
			expect(code).not.toBeNull();
		});

		it('should deploy a contract with dependencies using CREATE opcode', async () => {
			const abi = Demo.contracts['Demo.sol:Demo'].abi;
			const bytecode: string = Demo.contracts['Demo.sol:Demo'].bin;

			const factory = new ContractFactory(abi, bytecode, wallet);
			const contract = (await factory.deploy([], {
				customData: {
					factoryDeps: [Demo.contracts['Foo.sol:Foo'].bin],
				},
			})) as Contract<typeof abi>;

			// TODO: needs double check!
			await contract.deploy().send();
			const code = await provider.eth.getCode(contract.options.address as string);
			expect(code).not.toBeNull();
		});

		it('should deploy an account using CREATE opcode', async () => {
			const paymasterAbi = Paymaster.abi;
			const paymasterBytecode = Paymaster.bytecode;
			const accountFactory = new ContractFactory(
				paymasterAbi,
				paymasterBytecode,
				wallet,
				'createAccount',
			);
			const paymasterContract = await accountFactory.deploy([
				await provider.l2TokenAddress(DAI_L1),
			]);

			const code = await provider.eth.getCode(
				(await paymasterContract.options.address) as string,
			);
			expect(code).not.toBeNull();
		});

		it('should deploy a contract without a constructor using CREATE2 opcode', async () => {
			const abi = Storage.contracts['Storage.sol:Storage'].abi;
			const bytecode: string = Storage.contracts['Storage.sol:Storage'].bin;
			const factory = new ContractFactory(abi, bytecode, wallet, 'create2');
			const contract = await factory.deploy([], {
				customData: { salt: web3Utils.randomHex(32) },
			});

			const code = await provider.eth.getCode(contract.options.address as string);
			expect(code).not.toBeNull();
		});

		it('should deploy a contract with a constructor using CREATE2 opcode', async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet, 'create2');
			const contract = await factory.deploy(['Ducat', 'Ducat', 18], {
				customData: { salt: web3Utils.randomHex(32) },
			});

			const code = await provider.eth.getCode(contract.options.address as string);
			const deploymentTx = contract.deploymentTransaction();
			expect(code).not.toBeNull();
			expect(deploymentTx).not.toBeNull();
		});

		it('should deploy a contract with dependencies using CREATE2 opcode', async () => {
			const abi = Demo.contracts['Demo.sol:Demo'].abi;
			const bytecode: string = Demo.contracts['Demo.sol:Demo'].bin;

			const factory = new ContractFactory(abi, bytecode, wallet, 'create2');
			const contract = (await factory.deploy([], {
				customData: {
					salt: web3Utils.randomHex(32),
					factoryDeps: [Demo.contracts['Foo.sol:Foo'].bin],
				},
			})) as Contract<typeof abi>;

			// TODO: needs double check!
			await contract.deploy().send();
			const code = await provider.eth.getCode(contract.options.address as string);
			expect(code).not.toBeNull();
		});

		it('should deploy an account using CREATE2 opcode', async () => {
			const paymasterAbi = Paymaster.abi;
			const paymasterBytecode = Paymaster.bytecode;
			const accountFactory = new ContractFactory(
				paymasterAbi,
				paymasterBytecode,
				wallet,
				'create2Account',
			);
			const paymasterContract = await accountFactory.deploy(
				[await provider.l2TokenAddress(DAI_L1)],
				{
					customData: { salt: web3Utils.randomHex(32) },
				},
			);

			const code = await provider.eth.getCode(paymasterContract.options.address as string);
			expect(code).not.toBeNull();
		});
	});

	describe('getDeployTransaction()', () => {
		it('should return a deployment transaction', async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet);

			const result = await factory.getDeployTransaction(['Ducat', 'Ducat', 18]);
			expect(result).not.toBeNull();
		});

		it('should throw an error when salt is not provided in CRATE2 deployment', async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet, 'create2');

			try {
				await factory.getDeployTransaction(['Ducat', 'Ducat', 18]);
			} catch (e) {
				expect((e as Error).message).toBe('Salt is required for CREATE2 deployment!');
			}
		});

		it('should throw an error when salt is not provided in hexadecimal format in CRATE2 deployment', async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet, 'create2');

			try {
				await factory.getDeployTransaction(['Ducat', 'Ducat', 18], {
					customData: { salt: '0000' },
				});
			} catch (e) {
				expect((e as Error).message).toBe('Invalid salt provided!');
			}
		});

		it('should throw an error when invalid salt length is provided in CRATE2 deployment', async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet, 'create2');

			try {
				await factory.getDeployTransaction(['Ducat', 'Ducat', 18], {
					customData: { salt: '0x000' },
				});
			} catch (e) {
				expect((e as Error).message).toBe('Invalid salt provided!');
			}
		});

		it('should throw an error when invalid factory deps are provided in CRATE2 deployment', async () => {
			const abi = Token.abi;
			const bytecode: string = Token.bytecode;
			const factory = new ContractFactory(abi, bytecode, wallet, 'create2');

			try {
				await factory.getDeployTransaction(['Ducat', 'Ducat', 18], {
					customData: {
						salt: web3Utils.randomHex(32),
						factoryDeps: '0' as unknown as string[],
					},
				});
			} catch (e) {
				expect((e as Error).message).toBe(
					"Invalid 'factoryDeps' format! It should be an array of bytecodes.",
				);
			}

			try {
				await factory.getDeployTransaction(['Ducat', 'Ducat', 18], {
					customData: {
						salt: web3Utils.randomHex(32),
						factoryDeps: '' as unknown as string[],
					},
				});
			} catch (e) {
				expect((e as Error).message).toBe(
					"Invalid 'factoryDeps' format! It should be an array of bytecodes.",
				);
			}
		});
	});
});
