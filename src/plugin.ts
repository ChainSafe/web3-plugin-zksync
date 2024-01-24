import {Web3PluginBase, Contract, Address, Web3} from "web3";
import {ERC20TokenAbi} from "./contracts/ERC20Token";
import {ERC721TokenAbi} from "./contracts/ERC721Token";
import {RpcMethods} from "./rpc.methods";
import {Web3RequestManager} from "web3-core";
import {ETH_ADDRESS, ZERO_ADDRESS} from "./constants";
import {L2BridgeAbi} from "./contracts/L2Bridge";

export class ZkSyncPlugin extends Web3PluginBase {
    public pluginNamespace = "zkSync";
    public web3: Web3;
    public erc20BridgeL1: string
    public erc20BridgeL2: string
    public wethBridgeL1: string
    public wethBridgeL2: string
    public _rpc?: RpcMethods
    public _l2BridgeContracts: Record<Address, Contract<typeof L2BridgeAbi>>
    public _erc20Contracts: Record<Address, Contract<typeof ERC20TokenAbi>>
    public _erc721Contracts: Record<Address, Contract<typeof ERC721TokenAbi>>

    constructor() {
        super();
        this.web3 = new Web3();
        this.web3.link(this)

        this.erc20BridgeL1 = ''
        this.erc20BridgeL2 = ''
        this.wethBridgeL1 = ''
        this.wethBridgeL2 = ''
        this._l2BridgeContracts = {}
        this._erc20Contracts = {}
        this._erc721Contracts = {}
    }

    get rpc() {
        if (!this._rpc) {
            this._rpc = new RpcMethods(this.requestManager as unknown as Web3RequestManager<unknown>)
        }
        return this._rpc
    }

    getL2BridgeContract(address: Address) {
        if (!this._l2BridgeContracts[address]) {
            this._l2BridgeContracts[address] = new Contract(L2BridgeAbi, address)
            this._l2BridgeContracts[address].link(this)
        }
        return this._l2BridgeContracts[address]
    }

    erc20(address: string) {
        if (!this._erc20Contracts[address]) {
            this._erc20Contracts[address] = new Contract(ERC20TokenAbi, address)
            this._erc20Contracts[address].link(this)
        }
        return this._erc20Contracts[address]
    }

    erc721(address: string) {
        if (!this._erc721Contracts[address]) {
            this._erc721Contracts[address] = new Contract(ERC721TokenAbi, address)
            this._erc721Contracts[address].link(this)
        }
        return this._erc721Contracts[address]
    }


    async getDefaultBridgeAddresses() {
        if (!this.erc20BridgeL1) {
            const addresses = await this.rpc.getBridgeContracts();
            this.erc20BridgeL1 = addresses.l1Erc20DefaultBridge;
            this.erc20BridgeL2 = addresses.l2Erc20DefaultBridge;
            this.wethBridgeL1 = addresses.l1WethBridge;
            this.wethBridgeL2 = addresses.l2WethBridge;
        }
        return {
            erc20L1: this.erc20BridgeL1,
            erc20L2: this.erc20BridgeL2,
            wethL1: this.wethBridgeL1,
            wethL2: this.wethBridgeL2,
        };
    }

    async getL1Address(token: Address): Promise<string> {
        if (token == ETH_ADDRESS) {
            return ETH_ADDRESS;
        } else {
            const bridgeAddresses = await this.getDefaultBridgeAddresses();
            const l2WethBridge = this.getL2BridgeContract(bridgeAddresses.wethL2);
            try {
                const l1WethToken = await l2WethBridge.methods.l1TokenAddress(token).call();
                if (l1WethToken !== ZERO_ADDRESS) {
                    return l1WethToken;
                }
            } catch (e) {
            }
            const erc20Bridge = this.getL2BridgeContract(bridgeAddresses.erc20L2);
            return erc20Bridge.methods.l1TokenAddress(token).call();
        }
    }

    async getL2Address(token: Address): Promise<string> {
        if (token == ETH_ADDRESS) {
            return ETH_ADDRESS;
        } else {
            const bridgeAddresses = await this.getDefaultBridgeAddresses();
            const l2WethBridge = this.getL2BridgeContract(bridgeAddresses.wethL2);
            try {
                const l2WethToken = await l2WethBridge.methods.l2TokenAddress(token).call();
                if (l2WethToken !== ZERO_ADDRESS) {
                    return l2WethToken;
                }
            } catch (e) {
            }

            const erc20Bridge = this.getL2BridgeContract(bridgeAddresses.erc20L2)
            return erc20Bridge.methods.l2TokenAddress(token).call();
        }
    }

    async accountBalances(address: Address): Promise<{ [key: string]: bigint }> {
        let balances = await this.rpc.getAllAccountBalances(address);
        for (let token in balances) {
            balances[token] = BigInt(balances[token]);
        }
        return balances;
    }

    getERC20BalanceByAddress(tokenAddress: Address, address: Address) {
        return this.erc20(tokenAddress).methods.balanceOf(address).call()
    }

    async getErc20TokenInfo(tokenAddress: Address) {
        const erc20Contract = this.erc20(tokenAddress)
        const [name, symbol, decimals, totalSupply] = await Promise.all([
            erc20Contract.methods.name().call(),
            erc20Contract.methods.symbol().call(),
            erc20Contract.methods.decimals().call(),
            erc20Contract.methods.totalSupply().call(),
        ]);
        return {
            name,
            symbol,
            decimals,
            totalSupply
        }
    }
}

// Module Augmentation
declare module "web3" {
    interface Web3Context {
        zkSync: ZkSyncPlugin;
    }
}
