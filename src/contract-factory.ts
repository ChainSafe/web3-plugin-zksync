import type { ContractAbi } from 'web3';
import { Web3Context, eth } from 'web3';
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
import type { DeploymentType, TransactionRequest } from './types';
import { AccountAbstractionVersion } from './types';
import type { ZKsyncWallet } from './zksync-wallet';

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
	 * Create a new `ContractFactory` for a contract with the provided ABI and bytecode.
	 *
	 * @param abi The ABI (Application Binary Interface) of the contract.
	 * @param bytecode The bytecode of the contract.
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

		this.contractToBeDeployed = new zkWallet.provider!.eth.Contract(this.abi, {
			from: this.zkWallet.getAddress() ?? this.defaultAccount ?? undefined,
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
	): Promise<TransactionRequest> {
		let constructorArgs: any[];

		// The overrides will be popped out in this call:
		const txRequest: web3Types.TransactionCall & { customData?: any } = this.contractToBeDeployed
			.deploy({
				data: this.bytecode,
				arguments: args,
			})
			.populateTransaction({
				from: this.zkWallet.getAddress() ?? this.defaultAccount ?? undefined,
			});

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
		if (txRequest.customData && txRequest.customData.salt) {
			delete txRequest.customData.salt;
		}
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
	 *
	 * @param args - Constructor arguments for the contract
	 * @param overrides - Used for providing salt to create2 and create2Account deployment types and for providing custom factoryDeps
	 *
	 * @example <caption>Deploy only with constructor arguments</caption>
	 *
	 * const deployedContract = await contractFactory.deploy(arg1, arg2, ...);
	 *
	 * @example <caption>Deploy with constructor arguments and custom factoryDeps</caption>
	 *
	 * const deployedContractWithSaltAndDeps = await contractFactory.deploy(arg1, arg2, ..., {
	 *   customData: {
	 *     factoryDeps: ['0x...']
	 *   }
	 * });
	 *
	 * @example <caption>Deploy with constructor arguments and salt for create2 or create2Account deployment types</caption>
	 *
	 * const deployedContractWithSalt = await contractFactory.deploy(arg1, arg2, ..., {
	 *   customData: {
	 *     salt: '0x...'
	 *   }
	 * });
	 *
	 * @example <caption>Deploy with constructor arguments, salt for create2 or create2Account deployment types, and custom factoryDeps</caption>
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
		let modArgs = args;
		if (!Array.isArray(args)) {
			// tolerate if there was only one parameter for deploy,
			// which was passed as-is without wrapping it inside an array.
			modArgs = [args] as any;
		}
		const tx = await this.getDeployTransaction(modArgs, overrides);

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
