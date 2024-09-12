import { transactionReceiptSchema, transactionSchema } from 'web3-eth';

export const AddressSchema = { format: 'address' };
export const IntSchema = { format: 'int' };
export const UintSchema = { format: 'uint' };
export const BytesSchema = { format: 'bytes' };
export const BytesArraySchema = { type: 'array', items: { format: 'bytes' } };
export const EIP712TransactionSchema = {
	...transactionSchema,
	properties: {
		...transactionSchema.properties,
		customData: {
			type: 'object',
			properties: {
				customSignature: {
					format: 'bytes',
				},
				paymasterParams: {
					type: 'object',
					properties: {
						paymaster: {
							format: 'address',
						},
						paymasterInput: {
							format: 'bytes',
						},
					},
				},
				salt: {
					format: 'bytes',
				},
				gasPerPubdata: {
					format: 'uint',
				},
				factoryDeps: {
					type: 'array',
					items: {
						format: 'bytes',
					},
				},
			},
		},
	},
};
export const BlockDetailsSchema = {
	type: 'object',
	properties: {
		number: {
			format: 'uint',
		},
		timestamp: {
			type: 'number',
		},
		l1BatchNumber: {
			format: 'uint',
		},
		l1TxCount: {
			format: 'uint',
		},
		l2TxCount: {
			format: 'uint',
		},
		rootHash: {
			format: 'string',
		},
		status: {
			format: 'string',
		},
		commitTxHash: {
			format: 'string',
		},
		committedAt: {
			format: 'uint',
		},
		proveTxHash: {
			format: 'string',
		},
		provenAt: {
			format: 'uint',
		},
		executeTxHash: {
			format: 'string',
		},
		executedAt: {
			format: 'string',
		},
	},
};
export const BatchDetailsSchema = {
	type: 'object',
	properties: {
		number: {
			format: 'uint',
		},
		timestamp: {
			type: 'number',
		},
		l1TxCount: { format: 'uint' },
		l2TxCount: { format: 'uint' },
		rootHash: {
			format: 'bytes32',
		},
		status: { format: 'string' },
		commitTxHash: {
			format: 'bytes32',
		},
		committedAt: { format: 'string' },
		proveTxHash: {
			format: 'bytes32',
		},
		provenAt: { format: 'string' },
		executeTxHash: {
			format: 'bytes32',
		},
		executedAt: { format: 'string' },
		l1GasPrice: { format: 'uint' },
		l2FairGasPrice: { format: 'uint' },
		baseSystemContractsHashes: {
			type: 'object',
			properties: {
				bootloader: {
					format: 'bytes32',
				},
				default_aa: {
					format: 'bytes32',
				},
			},
		},
	},
};
export const TransactionDetailsSchema = {
	type: 'object',
	properties: {
		isL1Originated: { type: 'boolean' },
		status: { format: 'string' },
		fee: { format: 'uint' },
		initiatorAddress: { format: 'address' },
		receivedAt: { format: 'string' },
		ethCommitTxHash: { format: 'bytes32' },
		ethProveTxHash: { format: 'bytes32' },
		ethExecuteTxHash: { format: 'bytes32' },
	},
};
export const RawBlockTransactionSchema = {
	type: 'object',
	properties: {
		common_data: {
			type: 'object',
			properties: {
				L2: {
					type: 'object',
					properties: {
						nonce: { format: 'uint' },
						fee: {
							type: 'object',
							properties: {
								gas_limit: { format: 'uint' },
								max_fee_per_gas: { format: 'uint' },
								max_priority_fee_per_gas: { format: 'uint' },
								gas_per_pubdata_limit: { format: 'uint' },
							},
						},
						initiatorAddress: { format: 'address' },
						signature: { type: 'array', items: { format: 'bytes' } },
						transactionType: { format: 'string' },
						input: {
							type: 'object',
							properties: {
								hash: { format: 'string' },
								data: { type: 'array', items: { format: 'bytes' } },
							},
						},
						paymasterParams: {
							type: 'object',
							properties: {
								paymaster: { format: 'address' },
								paymasterInput: { type: 'array', items: { format: 'bytes' } },
							},
						},
					},
				},
			},
		},
		execute: {
			type: 'object',
			properties: {
				calldata: { format: 'string' },
				contractAddress: { format: 'address' },
				factoryDeps: { type: 'array', items: { format: 'bytes' } },
				value: { format: 'uint' },
			},
		},
		received_timestamp_ms: { format: 'number' },
		raw_bytes: { format: 'string' },
	},
};

export const RawBlockTransactionListSchema = {
	type: 'array',
	items: {
		...RawBlockTransactionSchema,
	},
};

export const BridgeAddressesSchema = {
	type: 'object',
	properties: {
		l1Erc20DefaultBridge: { format: 'address' },
		l2Erc20DefaultBridge: { format: 'address' },
		l1WethBridge: { format: 'address' },
		l2WethBridge: { format: 'address' },
		l2SharedDefaultBridge: { format: 'address' },
		l1SharedDefaultBridge: { format: 'address' },
	},
};

export const L2ToL1ProofSchema = {
	type: 'object',
	properties: {
		proof: {
			type: 'array',
			items: { format: 'bytes32' },
		},
		id: { format: 'uint' },
		root: { format: 'bytes32' },
	},
};

export const ProofSchema = {
	type: 'object',
	properties: {
		address: { format: 'address' },
		storageProof: {
			type: 'array',
			properties: {
				key: { format: 'bytes' },
				proof: {
					type: 'array',
					items: { format: 'bytes32' },
				},
				value: { format: 'bytes' },
				index: { format: 'uint' },
			},
		},
	},
};

export const EstimateFeeSchema = {
	type: 'object',
	properties: {
		gas_limit: { format: 'uint' },
		max_fee_per_gas: { format: 'uint' },
		max_priority_fee_per_gas: { format: 'uint' },
		gas_per_pubdata_limit: { format: 'uint' },
	},
};

export const ZKTransactionReceiptSchema = {
	type: 'object',
	properties: {
		...transactionReceiptSchema.properties,
		l1BatchNumber: { format: 'uint' },
		l1BatchTxIndex: { format: 'uint' },
		logs: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					...transactionReceiptSchema.properties.logs.items.properties,
					l1BatchNumber: { format: 'string' },
				},
			},
		},
		l2ToL1Logs: {
			type: 'array',

			items: {
				type: 'object',
				properties: {
					blockNumber: { format: 'uint' },
					blockHash: { format: 'string' },
					l1BatchNumber: { format: 'string' },
					transactionIndex: { format: 'uint' },
					shardId: { format: 'uint' },
					isService: { format: 'string' },
					sender: { format: 'address' },
					key: { format: 'string' },
					value: { format: 'bytes' },
					transactionHash: { format: 'string' },
					logIndex: { format: 'string' },
				},
			},
		},
	},
};

export const RawTransactionWithDetailedOutputSchema = {
	type: 'object',
	properties: {
		transactionHash: 'bytes32',
		storageLogs: {
			type: 'array',
			items: {
				address: 'address',
				key: 'bytes32',
				writtenValue: 'bytes32',
			},
			events: {
				type: 'array',
				items: {
					address: 'address',
					topics: {
						type: 'array',
						items: {
							topic: 'bytes32',
						},
					},
					data: 'bytes',
					blockHash: 'bytes32',
					blockNumber: 'uint',
					l1BatchNumber: 'uint',
					transactionHash: 'bytes32',
					transactionIndex: 'uint',
					logIndex: 'uint',
					transactionLogIndex: 'uint',
					logType: 'string',
					removed: 'bool',
				},
			},
		},
	},
};

export const ProtocolVersionSchema = {
	type: 'object',
	properties: {
		version_id: { format: 'uint' },
		timestamp: { format: 'uint' },
		verification_keys_hashes: {
			type: 'object',
			properties: {
				params: {
					type: 'object',
					properties: {
						recursion_node_level_vk_hash: { format: 'bytes32' },
						recursion_leaf_level_vk_hash: { format: 'bytes32' },
						recursion_circuits_set_vks_hash: { format: 'bytes32' },
					},
				},
				recursion_scheduler_level_vk_hash: { format: 'bytes32' },
			},
		},
		base_system_contracts: {
			type: 'object',
			properties: {
				bootloader: { format: 'bytes32' },
				default_aa: { format: 'bytes32' },
			},
		},
		l2_system_upgrade_tx_hash: { format: 'bytes32' },
	},
};

export const FeeParamsSchema = {
	type: 'object',
	properties: {
		V2: {
			type: 'object',
			properties: {
				config: {
					type: 'object',
					properties: {
						minimal_l2_gas_price: { format: 'uint' },
						compute_overhead_part: { format: 'uint' },
						pubdata_overhead_part: { format: 'uint' },
						batch_overhead_l1_gas: { format: 'uint' },
						max_gas_per_batch: { format: 'uint' },
						max_pubdata_per_batch: { format: 'uint' },
					},
				},
				l1_gas_price: { format: 'uint' },
				l1_pubdata_price: { format: 'uint' },
			},
		},
	},
};

export const ConfirmedTokensSchema = {
	type: 'array',
	items: {
		type: 'object',
		properties: {
			l1Address: { format: 'address' },
			l2Address: { format: 'address' },
			name: { format: 'string' },
			symbol: { format: 'string' },
			decimals: { format: 'uint' },
		},
	},
};
