import type { ContractAbi } from 'web3';
import {
	// Web3APISpec,
	Web3Context,
	eth,
} from 'web3';
import { TransactionFactory } from 'web3-eth-accounts';
import * as web3Utils from 'web3-utils';
import type * as web3Types from 'web3-types';
import { Contract } from 'web3-eth-contract';

import { ContractDeployerContract, getDeployedContracts, hashBytecode } from './utils';
import {
	CONTRACT_DEPLOYER_ADDRESS,
	DEFAULT_GAS_PER_PUBDATA_LIMIT,
	EIP712_TX_TYPE,
	ZERO_HASH,
} from './constants';
import type { DeploymentType } from './types';
import { AccountAbstractionVersion } from './types';
import type { ZKsyncWallet } from './zksync-wallet';
import * as constants from './constants';
import { EIP712Transaction } from './Eip712';

interface CustomData {
	factoryDeps?: (string | { object: string })[];
	salt?: string;
}

interface Overrides {
	customData?: CustomData;
}

/**
 * A `ContractFactory` is used to deploy a `Contract` to the blockchain.
 */
export class ContractFactory<Abi extends ContractAbi> extends Web3Context {
	/**
	 *  The Contract Interface.
	 */
	readonly abi!: Abi;

	/**
	 *  The Contract deployment bytecode. Often called the initcode.
	 */
	readonly bytecode!: string;

	readonly zkWallet: ZKsyncWallet;

	/** The deployment type that is currently in use. */
	readonly deploymentType: DeploymentType;

	readonly contractToBeDeployed: Contract<Abi>;

	/**
	 * Create a new `ContractFactory` with `abi` and `bytecode`, optionally connected to `runner`.
	 * The `bytecode` may be the bytecode property within the standard Solidity JSON output.
	 *
	 * @param abi The ABI (Application Binary Interface) of the contract.
	 * @param bytecode The bytecode of the contract.
	 * @param [runner] The runner capable of interacting with a `Contract`on the network.
	 * @param [deploymentType] The deployment type, defaults to 'create'.
	 */
	constructor(
		abi: Abi,
		bytecode: web3Types.Bytes,
		zkWallet: ZKsyncWallet,
		deploymentType?: DeploymentType,
	) {
		super(zkWallet.provider);

		this.abi = abi;

		// Dereference Solidity bytecode objects and allow a missing `0x`-prefix
		if (bytecode instanceof Uint8Array) {
			this.bytecode = web3Utils.bytesToHex(bytecode);
		} else {
			if (typeof bytecode === 'object' && (bytecode as { object: web3Types.Bytes }).object) {
				bytecode = (bytecode as { object: web3Types.Bytes }).object;
			}
			if (typeof bytecode === 'string' && !bytecode.startsWith('0x')) {
				bytecode = '0x' + bytecode;
			}
			this.bytecode = web3Utils.bytesToHex(bytecode);
		}

		this.zkWallet = zkWallet;

		this.deploymentType = deploymentType || 'create';

		this.contractToBeDeployed = new Contract(this.abi, undefined, {
			provider: this.provider,
			wallet: this.zkWallet as any, //TODO: do we need to pass this.zkWallet.provider or this.zkWallet.account or non!?
		});
	}

	private encodeCalldata(
		salt: string,
		bytecodeHash: web3Types.Bytes,
		constructorCalldata: web3Types.Bytes,
	): string {
		const contractDeploymentArgs = [salt, web3Utils.bytesToHex(bytecodeHash), constructorCalldata];
		const accountDeploymentArgs = [...contractDeploymentArgs, AccountAbstractionVersion.Version1];

		switch (this.deploymentType) {
			case 'create':
				return ContractDeployerContract.methods.create(...contractDeploymentArgs).encodeABI();
			case 'createAccount':
				return ContractDeployerContract.methods.createAccount(...accountDeploymentArgs).encodeABI();
			case 'create2':
				return ContractDeployerContract.methods.create2(...contractDeploymentArgs).encodeABI();
			case 'create2Account':
				return ContractDeployerContract.methods
					.create2Account(...accountDeploymentArgs)
					.encodeABI();
			default:
				throw new Error(`Unsupported deployment type: ${this.deploymentType}!`);
		}
	}

	/**
	 * Checks if the provided overrides are appropriately configured for a specific deployment type.
	 * @param overrides The overrides to be checked.
	 *
	 * @throws {Error} If:
	 *   - `overrides.customData.salt` is not provided for `Create2` deployment type.
	 *   - Provided `overrides.customData.salt` is not 32 bytes in hex format.
	 *   - `overrides.customData.factoryDeps` is not array of bytecodes.
	 */
	protected checkOverrides(overrides?: Overrides) {
		if (this.deploymentType === 'create2' || this.deploymentType === 'create2Account') {
			if (!overrides || !overrides.customData || !overrides.customData.salt) {
				throw new Error('Salt is required for CREATE2 deployment!');
			}

			if (!overrides.customData.salt.startsWith('0x') || overrides.customData.salt.length !== 66) {
				throw new Error('Invalid salt provided!');
			}
		}

		if (
			overrides &&
			overrides.customData &&
			overrides.customData.factoryDeps !== null &&
			overrides.customData.factoryDeps !== undefined &&
			!Array.isArray(overrides.customData.factoryDeps)
		) {
			throw new Error("Invalid 'factoryDeps' format! It should be an array of bytecodes.");
		}
	}

	async getDeployTransaction(
		args: web3Types.ContractConstructorArgs<Abi> = [] as web3Types.ContractConstructorArgs<Abi>,
		overrides?: Overrides,
	): Promise<Omit<web3Types.Transaction, 'to'>> {
		let constructorArgs: any[];

		// The overrides will be popped out in this call:
		const txRequest: web3Types.TransactionCall & { customData?: any } = this.contractToBeDeployed
			.deploy({
				data: this.bytecode,
				arguments: args as any, // TODO: check this line
			})
			.populateTransaction({
				from: this.zkWallet.getAddress() ?? this.defaultAccount ?? undefined,
			});

		const deployAbi = this.contractToBeDeployed.options.jsonInterface.filter(
			item => item.type === 'constructor',
		);

		this.checkOverrides(overrides);
		let overridesCopy: Overrides = overrides ?? {
			customData: { factoryDeps: [], salt: ZERO_HASH },
		};
		if (overrides) {
			overridesCopy = overrides;
			overridesCopy.customData ??= {};
			overridesCopy.customData.salt ??= ZERO_HASH;
			overridesCopy.customData.factoryDeps = (overridesCopy.customData.factoryDeps ?? []).map(
				normalizeBytecode,
			);
		} else {
			overridesCopy = {
				customData: { factoryDeps: [], salt: ZERO_HASH },
			};
		}
		constructorArgs = args as any[];

		console.log('constructorArgs', constructorArgs);

		const bytecodeHash = hashBytecode(this.bytecode);
		const constructorCalldata = web3Utils.hexToBytes(
			eth.abi.encodeParameters(
				(this.contractToBeDeployed.options.jsonInterface
					.filter(item => item.type === 'constructor')
					.map(item => item.inputs)[0] as web3Types.AbiParameter[]) ?? [], // TOOD: check this line
				constructorArgs,
			),
		);
		const deployCalldata = this.encodeCalldata(
			overridesCopy?.customData?.salt as string,
			bytecodeHash,
			constructorCalldata,
		);

		// salt is no longer used and should not be present in customData of EIP712 transaction
		if (txRequest.customData && txRequest.customData.salt) delete txRequest.customData.salt;
		const tx = {
			...txRequest,
			to: CONTRACT_DEPLOYER_ADDRESS,
			data: deployCalldata,
			type: EIP712_TX_TYPE,
		};

		tx.customData ??= {};
		tx.customData.factoryDeps ??= overridesCopy?.customData?.factoryDeps;
		tx.customData.gasPerPubdata ??= DEFAULT_GAS_PER_PUBDATA_LIMIT;

		// The number of factory deps is relatively low, so it is efficient enough.
		if (!tx.customData || !tx.customData.factoryDeps.includes(this.bytecode)) {
			tx.customData.factoryDeps.push(this.bytecode);
		}

		const txNoUndefined = Object.entries(tx)
			.filter(([, value]) => value !== undefined)
			.reduce((obj: { [key: string]: any }, [key, value]) => {
				obj[key] = value;
				return obj;
			}, {});
		return txNoUndefined;
	}

	/**
	 * Deploys a new contract or account instance on the L2 blockchain.
	 * There is no need to wait for deployment with `waitForDeployment` method
	 * because **deploy** already waits for deployment to finish.
	 *
	 * @param args - Constructor arguments for the contract followed by optional
	 * {@link ethers.Overrides|overrides}. When deploying with Create2 method slat must be present in overrides.
	 *
	 * @example Deploy with constructor arguments only using `create` method
	 *
	 * const deployedContract = await contractFactory.deploy(arg1, arg2, ...);
	 *
	 * @example Deploy with constructor arguments, and factory dependencies using `create method
	 *
	 * const deployedContractWithSaltAndDeps = await contractFactory.deploy(arg1, arg2, ..., {
	 *   customData: {
	 *     factoryDeps: ['0x...']
	 *   }
	 * });
	 *
	 * @example Deploy with constructor arguments and custom salt using `create2` method
	 *
	 * const deployedContractWithSalt = await contractFactory.deploy(arg1, arg2, ..., {
	 *   customData: {
	 *     salt: '0x...'
	 *   }
	 * });
	 *
	 * @example Deploy with constructor arguments, custom salt, and factory dependencies using `create2` method
	 *
	 * const deployedContractWithSaltAndDeps = await contractFactory.deploy(arg1, arg2, ..., {
	 *   customData: {
	 *     salt: '0x...',
	 *     factoryDeps: ['0x...']
	 *   }
	 * });
	 */
	async deploy(
		args?: web3Types.ContractConstructorArgs<Abi>,
		overrides?: Overrides,
	): Promise<
		Contract<Abi> & {
			deploymentTransaction(): web3Types.TransactionReceipt;
		}
	> {
		const tx = await this.getDeployTransaction(args, overrides);

		// TODO: double check where to put this line
		// @ts-ignore-next-line
		TransactionFactory.registerTransactionType(constants.EIP712_TX_TYPE, EIP712Transaction);
		const receipt = await (await this.zkWallet?.sendTransaction(tx)).wait();

		const deployedAddresses = getDeployedContracts(receipt).map(info => info.deployedAddress);

		this.contractToBeDeployed.options.address = deployedAddresses[deployedAddresses.length - 1];
		const contractWithCorrectAddress: Contract<Abi> & {
			deploymentTransaction(): web3Types.TransactionReceipt;
		} = this.contractToBeDeployed.clone() as Contract<Abi> & {
			deploymentTransaction(): web3Types.TransactionReceipt;
		};
		contractWithCorrectAddress.deploymentTransaction = () => receipt;
		return contractWithCorrectAddress;
	}
}

function normalizeBytecode(bytecode: web3Types.Bytes | { object: string }): string {
	// Dereference Solidity bytecode objects and allow a missing `0x`-prefix
	if (bytecode instanceof Uint8Array) {
		bytecode = web3Utils.bytesToHex(bytecode);
	} else {
		if (typeof bytecode === 'object') {
			bytecode = bytecode.object;
		}
		if (!bytecode.startsWith('0x')) {
			bytecode = '0x' + bytecode;
		}
		bytecode = web3Utils.bytesToHex(web3Utils.hexToBytes(bytecode));
	}
	return bytecode;
}
